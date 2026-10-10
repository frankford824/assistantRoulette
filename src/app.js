import { RULES } from './data/rules.js';
import { PRODUCTS, HISTORY, COMPANY } from './data/catalog.js';
import { SAMPLE_INQUIRIES } from './data/inquiries.js';
import { parseInquiry } from './core/parser.js';
import { runPipeline, DEFAULT_SETTINGS } from './core/pipeline.js';
import { LANG_LABEL } from './core/drafter.js';
import { formatInt, formatMoney } from './core/text.js';

const STORE_KEY = 'xpkd-demo-v1';
const ROLES = { sales: '业务员 · 陈璐', manager: '负责人 · 王建' };
const CTX = { rules: RULES, products: PRODUCTS, history: HISTORY, company: COMPANY };

const LOGO_LABEL = { none: '不印', silk1: '单色丝印', silk2: '双色丝印', laser: '激光雕刻', unspecified: '要印，工艺未写' };
const PACK_LABEL = { none: '中性内盒', white: '单只白盒', color: '单只彩盒' };
const MISSING_LABEL = { quantity: '数量', product: '产品', port: '目的港', logo_detail: 'logo 工艺' };
const SOURCE_LABEL = { template: '系统模板', model: '模型改写', edited: '已人工修改' };
const FIELD_LABEL = {
  language: '语言', buyerName: '买家', company: '公司', productSku: '产品', quantity: '数量', incoterm: '贸易条款',
  loadingPort: '装运港', destinationPort: '目的港', currency: '币种', logo: 'Logo', packaging: '包装', capacityMl: '容量',
};

const EXAMPLES = {
  moq: `Hi there,

We run a small gift shop in the UK. Could you quote 600 pcs of the 500ml vacuum flask with laser engraved logo, FOB Shanghai? We would ship to Felixstowe.

Thanks,
Oliver Grant
Grant & Co Gifts
oliver@grantgifts.example`,
  ddp: `Buenos días:

Quisiéramos recibir precio DDP Valencia para 4.000 termos de 500 ml con caja blanca individual.
¿Pueden enviarnos también el plazo de entrega?

Un saludo,
Javier Ruiz
Casa Ruiz Distribución S.L.`,
  restricted: `Hello,

Please quote 3,000 pcs of 750ml vacuum flask, one color logo, FOB Shanghai. Final delivery address is in Sevastopol, Crimea.

Regards,
Ivan Petrov
Black Sea Trading`,
};

let state;
let view = 'desk';
let selectedId;
let filter = 'all';
let server = { llm: false, model: null, reachable: false };

const $ = (sel, root = document) => root.querySelector(sel);
const viewEl = $('#view');

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const fullFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmtTime = (iso) => timeFmt.format(new Date(iso)).replace('/', '-');
const fmtFull = (iso) => fullFmt.format(new Date(iso)).replace(/\//g, '-');

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- 数据 ---------- */

function freshInquiry(base) {
  return {
    ...base,
    text: base.text.normalize('NFC'),
    overrides: {},
    discount: 0,
    extracted: null,
    modelTried: false,
    modelDraft: null,
    draftEdited: null,
    approval: null,
    rejectNote: null,
    sentAt: null,
    sentBy: null,
    sentText: null,
  };
}

function seed() {
  const s = { version: 1, role: 'sales', settings: { ...DEFAULT_SETTINGS }, inquiries: SAMPLE_INQUIRIES.map(freshInquiry), audit: [] };
  for (const inq of s.inquiries) {
    if (inq.status !== 'sent') continue;
    inq.extracted = parseInquiry(inq.text, CTX);
    inq.modelTried = true;
    const r = runPipeline(inq, { ...CTX, settings: s.settings });
    inq.sentAt = '2026-10-08T17:41:00+08:00';
    inq.sentBy = ROLES.sales;
    inq.sentText = r.draftText;
    s.audit.push(makeEntry('send', inq, r, { at: inq.sentAt, actor: ROLES.sales }));
  }
  return s;
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    return s && s.version === 1 && Array.isArray(s.inquiries) ? s : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式下无法保存，演示照常进行 */
  }
}

function titleOf(inq, r) {
  const parts = [inq.city, r.fields.company || r.fields.buyerName].filter(Boolean);
  return [...new Set(parts)].join(' · ') || '新询盘';
}

const ctxWithSettings = () => ({ ...CTX, settings: state.settings });
const resultOf = (inq) => runPipeline(inq, ctxWithSettings());
const current = () => state.inquiries.find((q) => q.id === selectedId);

function quoteSummary(r) {
  const q = r.quote;
  if (q.ok) return `${q.sku} × ${formatInt(q.pricedQty)}，${q.currency} ${q.unit.toFixed(2)}/pc ${q.incoterm} ${q.place}，合计 ${formatMoney(q.total, q.currency)}`;
  if (q.reason === 'no_quantity') return `${q.sku} 数量未知，回复阶梯参考价`;
  return q.message;
}

function makeEntry(action, inq, r, extra = {}) {
  const summaries = {
    send: () => `发送给 ${r?.fields.buyerName || '买家'}：${quoteSummary(r)}`,
    submit: () => `提交负责人审批：${r.approvalReasons.join('；')}`,
    approve: () => `批准并发送：${quoteSummary(r)}`,
    reject: () => `退回业务员：${extra.note || '未填写原因'}`,
    edit: () => extra.summary,
    discount: () => extra.summary,
    create: () => `新建询盘（${inq.source}）`,
    model_parse: () => `模型解析完成（${extra.model}）`,
    model_draft: () => `模型改写初稿，已通过价格校验（${extra.model}）`,
    model_fallback: () => `模型调用未成功，已改用本地结果：${extra.reason}`,
  };
  const detail = r && ['send', 'approve'].includes(action)
    ? {
        quote: r.quote.ok
          ? { lines: r.quote.lines, unitUsd: r.quote.unitUsd, unit: r.quote.unit, currency: r.quote.currency, fxRate: r.quote.fxRate, quantity: r.quote.pricedQty, total: r.quote.total, floorUsd: r.quote.floorUsd, steps: r.quote.steps }
          : { reason: r.quote.reason, message: r.quote.message, tierTable: r.quote.tierTable || null },
        fields: r.fields,
        draftSource: SOURCE_LABEL[r.draftSource],
        aiLabel: state?.settings?.aiFooter ?? true,
        text: r.draftText,
      }
    : extra.detail || null;
  return {
    id: uid(),
    at: extra.at || new Date().toISOString(),
    actor: extra.actor || ROLES[state?.role || 'sales'],
    action,
    inquiryId: inq.id,
    ruleVersion: RULES.version,
    summary: summaries[action](),
    detail,
  };
}

function log(action, inq, r, extra) {
  state.audit.push(makeEntry(action, inq, r, extra));
}

/* ---------- 模型（可选） ---------- */

async function detectServer() {
  try {
    const res = await fetch('api/status', { cache: 'no-store' });
    if (res.ok) server = { ...(await res.json()), reachable: true };
  } catch {
    server = { llm: false, model: null, reachable: false };
  }
  const chip = $('#mode-chip');
  if (server.llm) {
    chip.textContent = `解析：模型 ${server.model}`;
    chip.classList.add('is-model');
    chip.title = '询盘解析和初稿措辞由模型完成；价格仍由规则引擎计算，模型初稿须通过价格校验';
  } else {
    chip.textContent = '解析：本地规则';
    chip.title = '未连接模型接口，询盘由本地规则解析，初稿使用系统模板。配置方法见 README';
  }
}

async function postJSON(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `接口返回 ${res.status}`);
  return data;
}

async function ensureExtracted(inq) {
  if (!inq.extracted) inq.extracted = parseInquiry(inq.text, CTX);
  if (!server.llm || inq.modelTried || inq.status === 'sent') return;
  inq.modelTried = true;
  inq.pending = '模型正在解析询盘…';
  render();
  try {
    const data = await postJSON('api/parse', { text: inq.text });
    inq.extracted = data.extraction;
    log('model_parse', inq, null, { model: server.model, detail: { maskedText: data.maskedText } });
  } catch (err) {
    log('model_fallback', inq, null, { reason: `解析：${err.message}` });
  }
  await requestModelDraft(inq);
}

async function requestModelDraft(inq) {
  if (!server.llm) return;
  inq.pending = '模型正在改写初稿…';
  render();
  try {
    const data = await postJSON('api/draft', { text: inq.text, extracted: inq.extracted, overrides: inq.overrides, discount: inq.discount, settings: state.settings });
    if (data.ok) {
      inq.modelDraft = data.text;
      log('model_draft', inq, null, { model: data.model });
    } else {
      inq.modelDraft = null;
      log('model_fallback', inq, null, { reason: data.reason });
      toast(`${data.reason}，已改用系统模板`);
    }
  } catch (err) {
    log('model_fallback', inq, null, { reason: `改写：${err.message}` });
  }
  inq.pending = null;
  save();
  render();
}

/* ---------- 渲染：工作台 ---------- */

function statusOf(inq, r) {
  if (inq.status === 'sent') return { key: 'sent', label: '已发送' };
  if (inq.status === 'approval') return { key: 'wait', label: '待负责人审批' };
  if (r.needsApproval) return { key: 'warn', label: '需审批' };
  if (r.missing.length) return { key: 'info', label: `缺${r.missing.map((m) => MISSING_LABEL[m]).join('、')}` };
  return { key: 'ready', label: '待确认' };
}

function renderInbox() {
  const rows = state.inquiries
    .map((inq) => ({ inq, r: resultOf(inq) }))
    .filter(({ inq }) => (filter === 'all' ? true : filter === 'sent' ? inq.status === 'sent' : inq.status !== 'sent'))
    .sort((a, b) => b.inq.receivedAt.localeCompare(a.inq.receivedAt));
  const open = state.inquiries.filter((q) => q.status !== 'sent').length;
  return `
    <aside class="inbox" aria-label="询盘列表">
      <div class="inbox-head">
        <h2>询盘 <span class="count">${open} 待处理</span></h2>
        <button type="button" class="btn-small" data-action="new">粘贴询盘</button>
      </div>
      <div class="filters" role="tablist">
        ${[['all', '全部'], ['open', '待处理'], ['sent', '已发送']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${filter === k}" data-filter="${k}">${l}</button>`).join('')}
      </div>
      <ul class="inbox-list">
        ${rows.length ? rows.map(({ inq, r }) => {
          const st = statusOf(inq, r);
          return `<li><button type="button" class="inbox-item${inq.id === selectedId ? ' is-selected' : ''}" data-id="${esc(inq.id)}">
            <span class="inbox-title">${esc(inq.city || r.fields.company || '新询盘')} · ${esc(r.product?.name || '未识别产品')}</span>
            <span class="inbox-meta"><span class="lang">${esc(r.lang.toUpperCase())}</span>${esc(inq.source)} · ${fmtTime(inq.receivedAt)}</span>
            <span class="status status-${st.key}">${esc(st.label)}</span>
          </button></li>`;
        }).join('') : '<li class="empty">这个分类下没有询盘。</li>'}
      </ul>
    </aside>`;
}

function renderFlow(inq, r) {
  const q = r.quote;
  const steps = [
    { label: '询盘解析', st: r.missing.length ? 'warn' : 'done', note: r.missing.length ? `缺${r.missing.map((m) => MISSING_LABEL[m]).join('、')}` : `${LANG_LABEL[r.lang]}，字段齐全` },
    { label: '知识库检索', st: r.product ? 'done' : 'warn', note: r.product ? `${r.product.sku} · ${r.references.length} 条历史回复` : '没有匹配到产品' },
    { label: '报价计算', st: q.ok ? (q.needsApproval ? 'warn' : 'done') : q.reason === 'no_quantity' ? 'info' : 'warn', note: q.ok ? `${q.currency} ${q.unit.toFixed(2)}/pc` : q.reason === 'no_quantity' ? '给出阶梯参考价' : '需人工报价' },
    { label: '回复初稿', st: 'done', note: `${LANG_LABEL[r.lang]} · ${SOURCE_LABEL[r.draftSource]}` },
    { label: '人工确认', st: inq.status === 'sent' ? 'done' : inq.status === 'approval' ? 'info' : 'current', note: inq.status === 'sent' ? '已发送' : inq.status === 'approval' ? '等待负责人' : r.needsApproval ? '需负责人审批' : '等待业务员确认' },
  ];
  return `<ol class="flow">${steps.map((s, i) => `<li class="flow-step is-${s.st}"><span class="flow-n">${i + 1}</span><span class="flow-label">${s.label}</span><span class="flow-note">${esc(s.note)}</span></li>`).join('')}</ol>`;
}

function highlightOriginal(text, evidence) {
  const spans = Object.entries(evidence)
    .filter(([, e]) => e && e.index >= 0 && e.text)
    .map(([field, e]) => ({ field, start: e.index, end: e.index + e.text.length }))
    .sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    out += esc(text.slice(pos, s.start));
    out += `<mark title="${esc(FIELD_LABEL[s.field] || s.field)}">${esc(text.slice(s.start, s.end))}</mark>`;
    pos = s.end;
  }
  return out + esc(text.slice(pos));
}

function opt(value, label, selected) {
  return `<option value="${esc(value)}"${String(selected ?? '') === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
}

function fieldRow(inq, r, key, control) {
  const ev = r.extraction.evidence?.[key];
  const edited = Object.prototype.hasOwnProperty.call(inq.overrides, key);
  const note = edited
    ? `<span class="tag tag-edit">已人工修改</span> <button type="button" class="link" data-action="revert-field" data-key="${key}">恢复</button>`
    : ev ? `原文 “${esc(ev.text)}”` : '';
  return `<div class="field"><label for="f-${key}">${FIELD_LABEL[key]}</label><div class="field-control">${control}</div><div class="field-note">${note}</div></div>`;
}

function renderParsed(inq, r) {
  const f = r.fields;
  const locked = inq.status !== 'open';
  const dis = locked ? ' disabled' : '';
  const method = r.extraction.method === 'model' ? `模型解析 · ${esc(r.extraction.model)}` : '本地规则解析';
  const destPorts = Object.keys(RULES.ports);
  return `
    <article class="card">
      <header class="card-head"><h3>解析结果</h3><span class="muted">${method} · 可修改</span></header>
      <div class="fields">
        ${fieldRow(inq, r, 'language', `<select id="f-language" data-field="language"${dis}>${Object.entries(LANG_LABEL).map(([k, l]) => opt(k, l, f.language)).join('')}</select>`)}
        ${fieldRow(inq, r, 'buyerName', `<input id="f-buyerName" data-field="buyerName" value="${esc(f.buyerName || '')}" placeholder="未识别"${dis} />`)}
        ${fieldRow(inq, r, 'productSku', `<select id="f-productSku" data-field="productSku"${dis}>${opt('', '未匹配', f.productSku)}${PRODUCTS.map((p) => opt(p.sku, `${p.sku} ${p.name}`, f.productSku)).join('')}</select>`)}
        ${fieldRow(inq, r, 'quantity', `<input id="f-quantity" data-field="quantity" type="number" min="1" step="1" value="${f.quantity ?? ''}" placeholder="询盘未写"${dis} />`)}
        ${fieldRow(inq, r, 'incoterm', `<select id="f-incoterm" data-field="incoterm"${dis}>${opt('', '未写（按 FOB）', f.incoterm)}${Object.keys(RULES.incoterms).map((k) => opt(k, k, f.incoterm)).join('')}</select>`)}
        ${(f.incoterm || 'FOB') === 'FOB'
          ? fieldRow(inq, r, 'loadingPort', `<select id="f-loadingPort" data-field="loadingPort"${dis}>${opt('', `未写（按 ${RULES.loadingPorts[0]}）`, f.loadingPort)}${RULES.loadingPorts.map((p) => opt(p, p, f.loadingPort)).join('')}</select>`)
          : fieldRow(inq, r, 'destinationPort', `<select id="f-destinationPort" data-field="destinationPort"${dis}>${opt('', '未写', f.destinationPort)}${destPorts.map((p) => opt(p, p, f.destinationPort)).join('')}</select>`)}
        ${fieldRow(inq, r, 'currency', `<select id="f-currency" data-field="currency"${dis}>${opt('USD', 'USD', f.currency)}${opt('EUR', 'EUR', f.currency)}</select>`)}
        ${fieldRow(inq, r, 'logo', `<select id="f-logo" data-field="logo"${dis || (r.product && !r.product.allowLogo ? ' disabled' : '')}>${Object.entries(LOGO_LABEL).map(([k, l]) => opt(k, l, f.logo)).join('')}</select>`)}
        ${fieldRow(inq, r, 'packaging', `<select id="f-packaging" data-field="packaging"${dis || (r.product && !r.product.allowPackaging ? ' disabled' : '')}>${Object.entries(PACK_LABEL).map(([k, l]) => opt(k, l, f.packaging)).join('')}</select>`)}
      </div>
      <div class="field-extra">
        <span>认证要求：${f.certsRequested?.length ? f.certsRequested.map((c) => `<span class="tag ${COMPANY.certsHeld.includes(c) ? 'tag-ok' : 'tag-warn'}">${esc(c)}</span>`).join(' ') : '无'}</span>
        <span>询问交期：${f.leadTimeAsked ? '是' : '否'}</span>
        <span>公司：${esc(f.company || '未识别')}</span>
      </div>
    </article>`;
}

function renderOriginal(inq, r) {
  return `
    <article class="card original">
      <header class="card-head"><h3>询盘原文</h3><span class="muted">${esc(inq.source)} · ${fmtTime(inq.receivedAt)} · 底色为抽取依据</span></header>
      <pre class="mail">${highlightOriginal(inq.text, r.extraction.evidence || {})}</pre>
    </article>`;
}

function renderSources(r) {
  const matches = r.extraction.productMatches || [];
  return `
    <article class="card">
      <header class="card-head"><h3>检索依据</h3><span class="muted">本厂产品库 + 历史回复</span></header>
      ${r.product ? `<div class="source-block">
        <div class="source-title">${esc(r.product.sku)} ${esc(r.product.name)}</div>
        <p>${esc(r.product.spec)}</p>
        ${matches.length ? `<p class="muted">命中：${matches.map((m) => `${esc(m.sku)}（${m.score} 分：${esc(m.hits.join('、'))}）`).join('；')}</p>` : ''}
      </div>` : '<p class="muted">没有匹配到产品，可在左侧“产品”里手动选择。</p>'}
      ${r.references.map((h) => `<div class="source-block">
        <div class="source-title">${esc(h.id)} · ${esc(h.title)}</div>
        <p>${esc(h.text)}</p>
      </div>`).join('')}
    </article>`;
}

function renderQuote(inq, r) {
  const q = r.quote;
  const stamp = inq.approval ? `<div class="stamp${inq.approval.fresh ? ' is-fresh' : ''}" aria-label="负责人已审批"><span>已审批</span><small>${esc(inq.approval.by.replace('负责人 · ', ''))} ${fmtTime(inq.approval.at)}</small></div>` : '';
  let body;
  if (q.ok) {
    const editable = inq.status === 'open';
    body = `
      <table class="slip-table">
        <thead><tr><th>项目</th><th>依据</th><th class="num">USD/pc</th></tr></thead>
        <tbody>
          ${q.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(l.basis)}</td><td class="num">${l.usd < 0 ? '−' : ''}${Math.abs(l.usd).toFixed(2)}</td></tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="2">单价 · ${esc(q.incoterm)} ${esc(q.place)}</td><td class="num strong">${q.unitUsd.toFixed(2)}</td></tr>
          ${q.currency === 'EUR' ? `<tr><td colspan="2">折合欧元（${q.fxRate} = 汇率 ${RULES.fx.USDEUR} + ${RULES.fx.eurBuffer * 100}% 缓冲）</td><td class="num strong">EUR ${q.unit.toFixed(2)}</td></tr>` : ''}
        </tfoot>
      </table>
      <dl class="slip-summary">
        <div><dt>数量</dt><dd>${formatInt(q.pricedQty)} pcs${q.moqApplied ? `<small>询盘 ${formatInt(q.quantity)}，按起订量</small>` : ''}</dd></div>
        <div><dt>合计</dt><dd>${formatMoney(q.total, q.currency)}</dd></div>
        <div><dt>利润底线</dt><dd class="${q.aboveFloor ? 'ok' : 'bad'}">USD ${q.floorUsd.toFixed(2)} ${q.aboveFloor ? '✓' : '✗'}<small>毛利率 ${(q.marginRate * 100).toFixed(1)}%</small></dd></div>
        <div><dt>业务员折让</dt><dd><input type="number" id="discount" min="0" max="20" step="0.5" value="${(inq.discount * 100).toString()}" ${editable ? '' : 'disabled'} aria-label="折让百分比" /> %<small>权限 ≤ ${RULES.authority.salesMaxDiscount * 100}%</small></dd></div>
      </dl>
      <details class="steps"><summary>计算过程</summary><ul>${q.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></details>`;
  } else if (q.reason === 'no_quantity') {
    body = `
      <p class="slip-note">询盘没写数量，按当前产品、选项和条款逐档计算参考价，草稿会一并追问数量。</p>
      <table class="slip-table">
        <thead><tr><th>数量区间</th><th>条款</th><th class="num">单价（${esc(q.tierTable[0].currency)}）</th></tr></thead>
        <tbody>${q.tierTable.map((t) => `<tr><td>${esc(t.label)} pcs</td><td>${esc(q.incoterm)} ${esc(q.place)}</td><td class="num">${t.unit.toFixed(2)}</td></tr>`).join('')}</tbody>
      </table>`;
  } else {
    body = `<p class="slip-note is-warn">${esc(q.message)}</p>`;
  }
  const reasons = r.approvalReasons.length && inq.status !== 'sent'
    ? `<div class="approval-box"><strong>需要负责人审批</strong><ul>${r.approvalReasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`
    : '';
  return `
    <article class="card slip">
      <header class="card-head"><h3>报价明细</h3><span class="engine-tag">规则表 ${esc(RULES.version)} · 引擎计算</span></header>
      ${stamp}
      ${body}
      ${reasons}
    </article>`;
}

function renderReply(inq, r) {
  const isSent = inq.status === 'sent';
  const readonly = isSent || inq.status === 'approval';
  const text = isSent ? inq.sentText : r.draftText;
  const checks = renderChecks(r);
  return `
    <section class="reply" aria-label="回复与确认">
      <article class="card draft">
        <header class="card-head">
          <h3>回复初稿</h3>
          <span class="chips"><span class="tag">${esc(LANG_LABEL[r.lang])}</span><span class="tag tag-ai">AI 生成</span><span class="tag">${SOURCE_LABEL[r.draftSource]}</span></span>
        </header>
        ${inq.pending ? `<p class="pending">${esc(inq.pending)}</p>` : ''}
        <textarea id="draft-text" spellcheck="false" ${readonly ? 'readonly' : ''} aria-label="回复初稿">${esc(text)}</textarea>
        <div class="draft-tools">
          <label class="check"><input type="checkbox" id="ai-footer" ${state.settings.aiFooter ? 'checked' : ''} ${readonly ? 'disabled' : ''} /> 邮件末尾附 AI 辅助说明</label>
          <span class="draft-tool-btns">
            ${server.llm && !readonly ? '<button type="button" class="link" data-action="model-draft">让模型重写措辞</button>' : ''}
            ${r.draftSource !== 'template' && !readonly ? '<button type="button" class="link" data-action="reset-draft">恢复系统初稿</button>' : ''}
          </span>
        </div>
      </article>
      <article class="card">
        <header class="card-head"><h3>合规检查</h3><span class="muted">发送前自动执行</span></header>
        <ul class="checks" id="checks">${checks}</ul>
      </article>
      ${renderActions(inq, r)}
      <details class="card masked">
        <summary>送模型的内容（已脱敏）</summary>
        <pre>${esc(r.masked.text)}</pre>
        <p class="muted">${server.llm ? `当前连接模型 ${esc(server.model)}，只发送上面这段脱敏文本。` : '当前未连接模型，询盘没有离开这台电脑。'}</p>
      </details>
    </section>`;
}

function renderChecks(r) {
  const icon = { ok: '通过', warn: '注意', block: '拦截' };
  return r.compliance.map((c) => `<li class="check-${c.level}"><span class="check-level">${icon[c.level]}</span><span><strong>${esc(c.label)}</strong>${esc(c.detail)}</span></li>`).join('');
}

function renderActions(inq, r) {
  const role = state.role;
  if (inq.status === 'sent') {
    return `<div class="actions is-done"><p>已于 ${fmtTime(inq.sentAt)} 由 ${esc(inq.sentBy)} 发送给 ${esc(r.fields.buyerName || '买家')}。<span class="muted">（演示，未真实发出）</span></p></div>`;
  }
  if (inq.status === 'approval') {
    if (role === 'manager') {
      return `<div class="actions">
        <p class="actions-note">${esc(inq.submittedBy || ROLES.sales)} 提交审批：${esc(r.approvalReasons.join('；') || '无')}</p>
        <input type="text" id="reject-note" placeholder="退回原因（选填）" />
        <div class="btn-row">
          <button type="button" class="btn-ghost" data-action="reject">退回修改</button>
          <button type="button" class="btn-primary" data-action="approve" ${r.priceBlocked ? 'disabled' : ''}>批准并发送</button>
        </div>
      </div>`;
    }
    return `<div class="actions"><p class="actions-note">已提交负责人审批，等待处理。可在右上角切换为“负责人”继续演示。</p></div>`;
  }
  const sendLabel = r.quote.ok ? '确认发送' : '确认发送追问';
  const reject = inq.rejectNote ? `<p class="actions-note is-warn">负责人退回：${esc(inq.rejectNote)}</p>` : '';
  if (r.priceBlocked) {
    return `<div class="actions">${reject}<p class="actions-note is-warn">草稿价格与报价明细不一致，不能发送。</p><div class="btn-row"><button type="button" class="btn-primary" disabled>${sendLabel}</button></div></div>`;
  }
  if (r.needsApproval && role === 'sales') {
    return `<div class="actions">${reject}<p class="actions-note">超出业务员权限，需负责人审批后发送。</p><div class="btn-row"><button type="button" class="btn-ghost" disabled title="需负责人审批">${sendLabel}</button><button type="button" class="btn-primary" data-action="submit">提交负责人审批</button></div></div>`;
  }
  return `<div class="actions">${reject}<div class="btn-row"><button type="button" class="btn-primary" data-action="send">${r.needsApproval ? '批准并发送' : sendLabel}</button></div></div>`;
}

function renderDesk() {
  const inq = current();
  if (!inq) {
    viewEl.innerHTML = `<section class="desk">${renderInbox()}<section class="work empty-work"><p>左侧还没有询盘。点“粘贴询盘”新建一封。</p></section></section>`;
    return;
  }
  const r = resultOf(inq);
  viewEl.innerHTML = `
    <section class="desk">
      ${renderInbox()}
      <section class="work" aria-label="询盘处理">
        <div class="work-head">
          <div>
            <h1>${esc(titleOf(inq, r))}</h1>
            <p class="muted">${esc(inq.id)} · ${esc(inq.source)} · 收到于 ${fmtTime(inq.receivedAt)}（北京时间）</p>
          </div>
        </div>
        ${renderFlow(inq, r)}
        <div class="work-grid">
          ${renderOriginal(inq, r)}
          ${renderParsed(inq, r)}
        </div>
        ${renderQuote(inq, r)}
        ${renderSources(r)}
      </section>
      ${renderReply(inq, r)}
    </section>`;
  if (inq.approval?.fresh) {
    inq.approval.fresh = false;
    save();
  }
}

/* ---------- 渲染：规则 / 日志 / 说明 ---------- */

function renderRules() {
  const R = RULES;
  const opts = (group) => Object.values(R.options[group]).filter((o) => o.price > 0).map((o) => `<tr><td>${esc(o.label)}</td><td class="num">${o.price.toFixed(2)}</td><td class="num">${o.cost.toFixed(2)}</td></tr>`).join('');
  viewEl.innerHTML = `
    <section class="page">
      <header class="page-head">
        <h1>报价规则表 ${esc(R.version)}</h1>
        <p class="muted">更新于 ${esc(R.updatedAt)} · 修改需负责人确认 · 每次报价都会记录所用版本。以下均为演示数据。</p>
      </header>
      <div class="page-grid">
        <article class="card wide">
          <header class="card-head"><h3>数量阶梯价（USD/pc，${esc(R.baseIncoterm)} ${esc(R.loadingPorts.join(' / '))}）</h3></header>
          <table class="data-table">
            <thead><tr><th>产品</th><th>起订量</th><th>阶梯与单价</th><th class="num">成本（CNY）</th></tr></thead>
            <tbody>${PRODUCTS.map((p) => `<tr><td>${esc(p.sku)} ${esc(p.name)}</td><td>${formatInt(R.tiers[p.sku][0].min)}</td><td>${R.tiers[p.sku].map((t) => `${formatInt(t.min)}${t.max ? `–${formatInt(t.max)}` : '+'}：<b>${t.price.toFixed(2)}</b>`).join('　')}</td><td class="num">${R.unitCostCny[p.sku].toFixed(2)}</td></tr>`).join('')}</tbody>
          </table>
        </article>
        <article class="card">
          <header class="card-head"><h3>Logo 与包装加价（USD/pc）</h3></header>
          <table class="data-table"><thead><tr><th>选项</th><th class="num">报价</th><th class="num">成本</th></tr></thead><tbody>${opts('logo')}${opts('packaging')}</tbody></table>
        </article>
        <article class="card">
          <header class="card-head"><h3>贸易条款与运保</h3></header>
          <table class="data-table"><tbody>
            <tr><td>FOB</td><td>${esc(R.loadingPorts.join(' / '))} 同价</td></tr>
            <tr><td>EXW</td><td>在 FOB 基础上 ${(R.incoterms.EXW.priceAdjustRate * 100).toFixed(1)}%</td></tr>
            <tr><td>CFR / CIF 海运费</td><td>${Object.entries(R.freightPerUnit).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('，')}（USD/pc）</td></tr>
            <tr><td>CIF 保险</td><td>CIF 价 × 110% × ${(R.incoterms.CIF.insuranceRate * 100).toFixed(2)}%</td></tr>
            <tr><td>DDP / DAP</td><td>不自动报价，转负责人</td></tr>
          </tbody></table>
        </article>
        <article class="card">
          <header class="card-head"><h3>汇率、底线与权限</h3></header>
          <table class="data-table"><tbody>
            <tr><td>USD/CNY</td><td>${R.fx.USDCNY}（${esc(R.fx.setAt)} 设定）</td></tr>
            <tr><td>USD/EUR</td><td>${R.fx.USDEUR}，欧元报价加 ${R.fx.eurBuffer * 100}% 汇率缓冲</td></tr>
            <tr><td>利润底线</td><td>成本 × (1 + ${R.minMarginRate * 100}%)，低于底线必须审批</td></tr>
            <tr><td>业务员折让权限</td><td>≤ ${R.authority.salesMaxDiscount * 100}%</td></tr>
            <tr><td>大单审批</td><td>订单金额 &gt; USD ${formatInt(R.authority.approvalOrderValueUsd)}</td></tr>
            <tr><td>报价有效期</td><td>${R.quoteValidityDays} 天</td></tr>
          </tbody></table>
        </article>
        <article class="card">
          <header class="card-head"><h3>转人工复核的关键词</h3></header>
          <p>${R.restrictedKeywords.map((k) => `<span class="tag">${esc(k)}</span>`).join(' ')}</p>
          <p class="muted">演示用的简化名单。正式使用时应对接企业自己的出口管制与制裁筛查流程。</p>
        </article>
      </div>
    </section>`;
}

function renderAudit() {
  const ACTION = { send: '发送', submit: '提交审批', approve: '审批通过', reject: '退回', edit: '修改字段', discount: '调整折让', create: '新建', model_parse: '模型解析', model_draft: '模型改写', model_fallback: '模型降级' };
  const rows = [...state.audit].reverse();
  viewEl.innerHTML = `
    <section class="page">
      <header class="page-head row">
        <div>
          <h1>审计日志</h1>
          <p class="muted">记录每次报价的输入、规则版本、计算过程和确认人。数据只保存在本浏览器。</p>
        </div>
        <button type="button" class="btn-small" data-action="export-audit" ${rows.length ? '' : 'disabled'}>导出 JSON</button>
      </header>
      <article class="card wide">
        ${rows.length ? `<table class="data-table audit-table">
          <thead><tr><th>时间（北京）</th><th>操作人</th><th>动作</th><th>询盘</th><th>内容</th></tr></thead>
          <tbody>${rows.map((e) => `<tr>
            <td class="nowrap">${fmtFull(e.at)}</td>
            <td class="nowrap">${esc(e.actor)}</td>
            <td class="nowrap"><span class="tag">${esc(ACTION[e.action] || e.action)}</span></td>
            <td class="nowrap">${esc(e.inquiryId)}</td>
            <td>${esc(e.summary)}${e.detail ? `<details><summary>详情 · 规则表 ${esc(e.ruleVersion)}</summary><pre>${esc(JSON.stringify(e.detail, null, 2))}</pre></details>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table>` : '<p class="muted">还没有记录。在工作台处理一封询盘后，这里会出现对应条目。</p>'}
      </article>
    </section>`;
}

function renderAbout() {
  viewEl.innerHTML = `
    <section class="page about">
      <header class="page-head">
        <h1>关于这个演示</h1>
        <p class="muted">询盘快答 · 江苏省 OPC 创新创业大赛 · 创新赛道 AI+出海</p>
      </header>
      <article class="card">
        <h3>它解决什么问题</h3>
        <p>外贸工厂的询盘常在夜里到达，报价要查阶梯价、算条款、换汇率，还常要等老板拍板；小语种回复质量也不稳定。这个工作台把一封询盘变成一份可以直接确认的报价回复：系统先解析、查产品、按企业自己的规则算价、写好初稿，业务员看过依据后再发送。</p>
      </article>
      <article class="card">
        <h3>分工</h3>
        <ul class="plain">
          <li><b>模型</b>负责读懂询盘和组织措辞。</li>
          <li><b>规则引擎</b>负责算价。同样的输入永远得到同样的价格，每一项都能追溯到规则表的哪一行。</li>
          <li><b>人</b>负责最终决定。系统不会自动对外发送；超出折让权限、低于利润底线、大额订单、不支持的条款，都要负责人审批。</li>
        </ul>
      </article>
      <article class="card">
        <h3>演示里哪些是真的</h3>
        <ul class="plain">
          <li>解析、检索、算价、初稿、合规检查、审批和审计日志的流程都是真实运行的代码，可以粘贴新的询盘自己试。</li>
          <li>企业、产品、成本、价格、历史回复和示例询盘全部是虚构的，不对应任何真实工厂或买家。</li>
          <li>“确认发送”只会写入审计日志，不会发出邮件。</li>
          <li>当前运行模式：${server.llm ? `已连接模型 ${esc(server.model)}，解析和措辞由模型完成，价格仍由规则引擎计算。` : '未连接模型，使用本地规则解析和系统模板。接入国产备案模型的方法见 README。'}</li>
        </ul>
      </article>
      <article class="card">
        <h3>建议的演示顺序（约 3 分钟）</h3>
        <ol class="plain">
          <li>Hamburg：字段齐全的英文询盘，看原文高亮、报价明细和初稿，直接确认发送。</li>
          <li>Lyon：法语询盘没写数量，系统给出欧元阶梯参考价并追问。</li>
          <li>Chicago：订单金额超过 5 万美元，业务员只能提交审批；切换到负责人，批准后报价单盖章。</li>
          <li>Rotterdam：买家要 BSCI 认证，企业资料里没有，草稿不作承诺。</li>
          <li>把折让改到 5%，或者在草稿里手动改价格，看系统如何拦截。</li>
          <li>打开“审计日志”，查看每次发送的规则版本和计算过程。</li>
        </ol>
      </article>
    </section>`;
}

function render() {
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
  $('#role-select').value = state.role;
  if (view === 'desk') renderDesk();
  else if (view === 'rules') renderRules();
  else if (view === 'audit') renderAudit();
  else renderAbout();
}

/* ---------- 交互 ---------- */

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

function setOverride(inq, key, raw) {
  let value = raw;
  if (key === 'quantity') value = raw === '' ? null : Math.max(1, Math.round(Number(raw)));
  else if (raw === '') value = null;
  const before = resultOf(inq).fields[key];
  const original = inq.extracted?.fields?.[key] ?? null;
  if (String(value ?? '') === String(original ?? '')) delete inq.overrides[key];
  else inq.overrides[key] = value;
  if (key === 'incoterm' && !['CIF', 'CFR'].includes(value) && 'destinationPort' in inq.overrides && !inq.overrides.destinationPort) delete inq.overrides.destinationPort;
  inq.modelDraft = null;
  inq.draftEdited = null;
  log('edit', inq, null, { summary: `修改${FIELD_LABEL[key]}：${before ?? '空'} → ${value ?? '空'}` });
  save();
  render();
}

function sendInquiry(inq, r, { approvedBy } = {}) {
  inq.status = 'sent';
  inq.sentAt = new Date().toISOString();
  inq.sentBy = ROLES[state.role];
  inq.sentText = r.draftText;
  if (approvedBy) inq.approval = { by: approvedBy, at: inq.sentAt, fresh: true };
  log(approvedBy ? 'approve' : 'send', inq, r);
  save();
  render();
  toast(`已发送给 ${r.fields.buyerName || '买家'}（演示，未真实发出）`);
}

function nextId() {
  const now = new Date();
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let n = 1;
  while (state.inquiries.some((q) => q.id === `Q-${md}-${String(n).padStart(2, '0')}`)) n += 1;
  return `Q-${md}-${String(n).padStart(2, '0')}`;
}

viewEl.addEventListener('click', (e) => {
  const item = e.target.closest('.inbox-item');
  if (item) {
    selectedId = item.dataset.id;
    render();
    ensureExtracted(current()).then(() => { save(); render(); });
    return;
  }
  const tab = e.target.closest('[data-filter]');
  if (tab) {
    filter = tab.dataset.filter;
    render();
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const inq = current();
  const action = btn.dataset.action;
  if (action === 'new') {
    $('#new-dialog').showModal();
    return;
  }
  if (action === 'export-audit') {
    const blob = new Blob([JSON.stringify(state.audit, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  if (!inq) return;
  const r = resultOf(inq);
  if (action === 'revert-field') {
    delete inq.overrides[btn.dataset.key];
    inq.modelDraft = null;
    inq.draftEdited = null;
    save();
    render();
  } else if (action === 'reset-draft') {
    inq.draftEdited = null;
    inq.modelDraft = null;
    save();
    render();
  } else if (action === 'model-draft') {
    inq.draftEdited = null;
    requestModelDraft(inq);
  } else if (action === 'send') {
    sendInquiry(inq, r, { approvedBy: r.needsApproval && state.role === 'manager' ? ROLES.manager : null });
  } else if (action === 'submit') {
    inq.status = 'approval';
    inq.submittedBy = ROLES[state.role];
    inq.rejectNote = null;
    log('submit', inq, r);
    save();
    render();
    toast('已提交负责人审批');
  } else if (action === 'approve') {
    sendInquiry(inq, r, { approvedBy: ROLES.manager });
  } else if (action === 'reject') {
    const note = $('#reject-note')?.value.trim() || '';
    inq.status = 'open';
    inq.rejectNote = note || '请调整后重新提交';
    log('reject', inq, r, { note: inq.rejectNote });
    save();
    render();
    toast('已退回业务员');
  }
});

viewEl.addEventListener('change', (e) => {
  const inq = current();
  if (!inq) return;
  const el = e.target;
  if (el.dataset.field) {
    setOverride(inq, el.dataset.field, el.value.trim());
  } else if (el.id === 'discount') {
    const pct = Math.min(Math.max(Number(el.value) || 0, 0), 20);
    const before = inq.discount;
    inq.discount = Math.round(pct * 10) / 1000;
    inq.modelDraft = null;
    inq.draftEdited = null;
    log('discount', inq, null, { summary: `折让 ${(before * 100).toFixed(1)}% → ${pct.toFixed(1)}%` });
    save();
    render();
  } else if (el.id === 'ai-footer') {
    state.settings.aiFooter = el.checked;
    if (inq.modelDraft) inq.modelDraft = null;
    save();
    render();
  }
});

viewEl.addEventListener('input', (e) => {
  if (e.target.id !== 'draft-text') return;
  const inq = current();
  inq.draftEdited = e.target.value;
  save();
  const r = resultOf(inq);
  $('#checks').innerHTML = renderChecks(r);
  const actions = viewEl.querySelector('.actions');
  if (actions) actions.outerHTML = renderActions(inq, r);
});

document.querySelector('.nav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  view = b.dataset.view;
  render();
  viewEl.focus({ preventScroll: true });
});

$('#role-select').addEventListener('change', (e) => {
  state.role = e.target.value;
  save();
  render();
  toast(`已切换为 ${ROLES[state.role]}`);
});

$('#reset-demo').addEventListener('click', () => {
  if (!confirm('清空本浏览器里的演示记录，恢复到初始的 5 封询盘？')) return;
  state = seed();
  selectedId = state.inquiries.find((q) => q.status !== 'sent')?.id;
  view = 'desk';
  filter = 'all';
  save();
  render();
  ensureExtracted(current()).then(() => { save(); render(); });
});

const dialog = $('#new-dialog');
const form = $('#new-form');
$('#new-cancel').addEventListener('click', () => dialog.close());
form.addEventListener('click', (e) => {
  const ex = e.target.closest('[data-example]');
  if (ex) form.elements.text.value = EXAMPLES[ex.dataset.example];
});
form.addEventListener('submit', (e) => {
  const text = form.elements.text.value.trim().normalize('NFC');
  if (!text) {
    e.preventDefault();
    return;
  }
  const extracted = parseInquiry(text, CTX);
  const inq = freshInquiry({
    id: nextId(),
    source: form.elements.source.value,
    receivedAt: new Date().toISOString(),
    city: extracted.fields.destinationPort || '',
    status: 'open',
    text,
  });
  inq.extracted = extracted;
  state.inquiries.push(inq);
  selectedId = inq.id;
  view = 'desk';
  filter = 'all';
  log('create', inq, null);
  save();
  form.reset();
  render();
  ensureExtracted(inq).then(() => { save(); render(); });
});

state = load() || seed();
selectedId = state.inquiries.find((q) => q.status !== 'sent')?.id || state.inquiries[0]?.id;
save();
render();
detectServer().then(() => {
  render();
  const inq = current();
  if (inq) ensureExtracted(inq).then(() => { save(); render(); });
});
