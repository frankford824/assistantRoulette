// 用一个本地假模型服务验证 /api/parse 和 /api/draft，包括“模型改价被拦截”的情况。
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.mjs';
import { SAMPLE_INQUIRIES } from '../src/data/inquiries.js';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

function fakeModel(reply) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const payload = JSON.parse(body);
    calls.push({ auth: req.headers.authorization, payload });
    const content = typeof reply === 'function' ? reply(payload) : reply;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  return { server, calls };
}

const HAMBURG = SAMPLE_INQUIRIES[0].text;

const parseReply = JSON.stringify({
  language: 'en', buyer_name: 'Jonas Weber', company: 'Weber Haushaltswaren GmbH', product_description: '500ml double wall vacuum flask',
  sku: 'VF-500', capacity_ml: 500, quantity: 5000, incoterm: 'FOB', port: 'Shanghai', currency: null, logo: 'silk1', packaging: 'color',
  certifications: [], lead_time_asked: true,
});

async function withServers(reply, fn) {
  const model = fakeModel(reply);
  const modelUrl = await listen(model.server);
  const app = createApp({ llm: { baseUrl: modelUrl, apiKey: 'test-key', model: 'fake-model' } });
  const appUrl = await listen(app);
  try {
    await fn(appUrl, model.calls);
  } finally {
    app.close();
    model.server.close();
  }
}

const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, data: await r.json() }));

test('未配置模型：状态接口返回 llm=false，解析接口 503', async () => {
  const app = createApp({ llm: null });
  const url = await listen(app);
  try {
    const status = await fetch(`${url}/api/status`).then((r) => r.json());
    assert.deepEqual(status, { llm: false, model: null });
    const res = await post(`${url}/api/parse`, { text: HAMBURG });
    assert.equal(res.status, 503);
  } finally {
    app.close();
  }
});

test('静态文件可访问，目录穿越和未公开文件被拒绝', async () => {
  const app = createApp({ llm: null });
  const url = await listen(app);
  try {
    assert.equal((await fetch(`${url}/`)).status, 200);
    assert.equal((await fetch(`${url}/src/core/pricing.js`)).status, 200);
    assert.equal((await fetch(`${url}/package.json`)).status, 404);
    assert.equal((await fetch(`${url}/.env`)).status, 404);
    assert.ok([403, 404].includes((await fetch(`${url}/src/..%2f..%2fpackage.json`)).status));
  } finally {
    app.close();
  }
});

test('/api/parse：送给模型的是脱敏文本，返回合并后的字段', async () => {
  await withServers(parseReply, async (url, calls) => {
    const res = await post(`${url}/api/parse`, { text: HAMBURG });
    assert.equal(res.status, 200);
    assert.equal(res.data.extraction.method, 'model');
    assert.equal(res.data.extraction.fields.productSku, 'VF-500');
    assert.equal(res.data.extraction.fields.quantity, 5000);
    assert.equal(res.data.extraction.fields.destinationPort, 'Hamburg');
    const sent = calls[0].payload.messages[1].content;
    assert.doesNotMatch(sent, /weber-hw\.example|5550 1234/);
    assert.match(sent, /\[EMAIL_1\]/);
    assert.equal(calls[0].auth, 'Bearer test-key');
  });
});

test('/api/draft：价格照抄的模型初稿被接受，并追加 AI 说明', async () => {
  const draft = 'Dear Jonas Weber,\n\nThanks for reaching out. For 5,000 pcs of VF-500 the price is USD 3.85/pc FOB Shanghai with one-color logo and color gift box, valid for 15 days.\n\nCould you send the logo color and artwork?\n\nBest regards,\nLucy Chen';
  await withServers(draft, async (url) => {
    const res = await post(`${url}/api/draft`, { text: HAMBURG });
    assert.equal(res.data.ok, true);
    assert.match(res.data.text, /USD 3\.85\/pc/);
    assert.match(res.data.text, /AI assistance/);
  });
});

test('/api/draft：模型擅自改价或给折扣会被拦截', async () => {
  const draft = 'Dear Jonas, our price is USD 3.85/pc, or USD 3.70/pc if you order today.';
  await withServers(draft, async (url) => {
    const res = await post(`${url}/api/draft`, { text: HAMBURG });
    assert.equal(res.data.ok, false);
    assert.match(res.data.reason, /3\.70/);
  });
});

test('/api/draft：模型漏写单价会被拦截', async () => {
  await withServers('Dear Jonas, thanks, we will send the price soon.', async (url) => {
    const res = await post(`${url}/api/draft`, { text: HAMBURG });
    assert.equal(res.data.ok, false);
    assert.match(res.data.reason, /漏写了单价/);
  });
});
