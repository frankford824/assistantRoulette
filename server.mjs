// 本地服务：提供静态页面；配置了模型接口时，额外提供 /api/parse 和 /api/draft。
// 不配置模型也能完整演示，页面会自动使用本地解析。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { RULES } from './src/data/rules.js';
import { PRODUCTS, HISTORY, COMPANY } from './src/data/catalog.js';
import { parseInquiry } from './src/core/parser.js';
import { runPipeline, DEFAULT_SETTINGS } from './src/core/pipeline.js';
import { desensitize } from './src/core/compliance.js';
import { checkDraftPrices } from './src/core/pricing.js';
import { aiFooterText } from './src/core/drafter.js';
import { PARSE_SYSTEM_PROMPT, draftSystemPrompt, normalizeModelFields, mergeExtraction, parseJsonContent, draftFacts } from './src/core/model.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CTX = { rules: RULES, products: PRODUCTS, history: HISTORY, company: COMPANY };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};
const PUBLIC = ['/index.html', '/styles.css', '/favicon.svg'];
const PUBLIC_DIRS = ['/src/'];

export function loadEnv(file = path.join(ROOT, '.env')) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req, limit = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('请求内容过大'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('请求不是合法 JSON'), { status: 400 });
  }
}

async function chat(llm, messages, { json = false } = {}) {
  const res = await fetch(`${llm.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${llm.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llm.model,
      messages,
      temperature: 0.2,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(llm.timeoutMs || 30000),
  });
  if (!res.ok) throw new Error(`模型接口返回 ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型没有返回内容');
  return content;
}

export function createApp({ llm = null, root = ROOT } = {}) {
  const enabled = Boolean(llm?.baseUrl && llm?.apiKey && llm?.model);

  async function handleApi(req, res, pathname) {
    if (pathname === '/api/status' && req.method === 'GET') {
      return send(res, 200, { llm: enabled, model: enabled ? llm.model : null });
    }
    if (req.method !== 'POST') return send(res, 405, { error: '只支持 POST' });
    if (!enabled) return send(res, 503, { error: '未配置模型接口' });

    const body = await readBody(req);
    const text = String(body.text || '').normalize('NFC');
    if (!text.trim()) return send(res, 400, { error: '询盘内容为空' });

    if (pathname === '/api/parse') {
      const masked = desensitize(text);
      const content = await chat(llm, [
        { role: 'system', content: PARSE_SYSTEM_PROMPT },
        { role: 'user', content: masked.text },
      ], { json: true });
      const modelFields = normalizeModelFields(parseJsonContent(content), CTX);
      const local = parseInquiry(text, CTX);
      return send(res, 200, { extraction: mergeExtraction(local, modelFields, llm.model), maskedText: masked.text });
    }

    if (pathname === '/api/draft') {
      const settings = { ...DEFAULT_SETTINGS, ...(body.settings || {}) };
      const inquiry = { text, extracted: body.extracted || null, overrides: body.overrides || {}, discount: body.discount || 0 };
      const result = runPipeline(inquiry, { ...CTX, settings });
      const facts = draftFacts(result, { rules: RULES, company: COMPANY, settings });
      let draft = (await chat(llm, [
        { role: 'system', content: draftSystemPrompt(result.lang) },
        { role: 'user', content: `事实（JSON）：\n${JSON.stringify(facts, null, 2)}` },
      ])).trim();
      if (settings.aiFooter) draft = `${draft}\n\n${aiFooterText(result.lang)}`;
      const check = checkDraftPrices(draft, result.quote);
      if (!check.ok) {
        const reason = check.unknown.length
          ? `模型初稿出现报价明细之外的价格 ${check.unknown.map((v) => v.toFixed(2)).join('、')}`
          : '模型初稿漏写了单价';
        return send(res, 200, { ok: false, reason });
      }
      return send(res, 200, { ok: true, text: draft, model: llm.model });
    }

    return send(res, 404, { error: '接口不存在' });
  }

  async function handleStatic(res, pathname) {
    const rel = pathname === '/' ? '/index.html' : pathname;
    if (!PUBLIC.includes(rel) && !PUBLIC_DIRS.some((d) => rel.startsWith(d))) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(path.normalize(root + path.sep))) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    try {
      const data = await readFile(file);
      send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
    } catch {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    }
  }

  return http.createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, { error: '路径无效' });
    }
    try {
      if (pathname.startsWith('/api/')) await handleApi(req, res, pathname);
      else await handleStatic(res, pathname);
    } catch (err) {
      send(res, err.status || 502, { error: err.message || '服务出错' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const llm = {
    baseUrl: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
  };
  const port = Number(process.env.PORT) || 5173;
  createApp({ llm }).listen(port, () => {
    const mode = llm.baseUrl && llm.apiKey && llm.model ? `模型解析（${llm.model}）` : '本地规则解析（未配置模型）';
    console.log(`询盘快答演示版：http://localhost:${port}  当前模式：${mode}`);
  });
}
