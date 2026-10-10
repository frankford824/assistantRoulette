// 模型接入（可选）：只负责“读懂询盘”和“改写措辞”，价格仍由规则引擎给出。
// 兼容 OpenAI Chat Completions 格式的国产模型接口，如 DeepSeek、通义千问兼容模式、智谱 GLM。
import { matchProducts } from './retriever.js';
import { formatPrice, formatInt } from './text.js';
import { LANG_LABEL, leadTimeFor } from './drafter.js';

const KNOWN_CERTS = ['LFGB', 'FDA', 'BSCI', 'Sedex', 'ISO 9001'];

const QUESTION_TEXT = {
  quantity: '订单数量',
  product: '具体要哪款产品（型号或容量）',
  port: '目的港',
  logo_detail: 'logo 的印刷工艺和颜色数（目前按单色丝印估价）',
  logo_artwork: 'logo 颜色和设计文件',
};

export const PARSE_SYSTEM_PROMPT = `你是外贸工厂的询盘录入员。阅读买家询盘，只输出一个 JSON 对象，不要输出其他文字。
字段：
- language: 询盘语言，取值 en / fr / es / de / other
- buyer_name: 买家姓名，没有则为 null
- company: 买家公司，没有则为 null
- product_description: 买家要的产品，原文短语
- sku: 询盘里写到的型号，没有则为 null
- capacity_ml: 容量（毫升，整数），没有则为 null
- quantity: 数量（整数），没写或写得含糊则为 null，不要猜
- incoterm: FOB / CIF / CFR / EXW / DDP / DAP，没写则为 null
- port: 询盘中出现的港口名（英文），没有则为 null
- currency: USD 或 EUR，没写则为 null
- logo: none / silk1（单色丝印）/ silk2（双色丝印）/ laser / unspecified（要印 logo 但没说工艺）
- packaging: none / white（白盒）/ color（彩盒或礼盒）
- certifications: 买家提到的认证名称数组
- lead_time_asked: 是否询问交期，true / false
邮箱、电话已被替换为 [EMAIL_n]、[PHONE_n]，忽略即可。`;

export function draftSystemPrompt(lang) {
  return `你是外贸工厂的业务员，用 ${LANG_LABEL[lang] || 'English'} 给买家写回复邮件。
要求：
- 只使用“事实”里给出的价格、数量、条款，原样照抄价格写法，不得新增、修改或估算任何价格和折扣。
- 不得承诺“事实”中未列出的认证、交期或样品政策。
- 需要追问的问题全部问到。
- 语气专业、简洁，像真人业务员写的，不要客套堆砌，不要使用 emoji。
- 以问候语开头，以落款结束，只输出邮件正文。`;
}

function str(v, max = 80) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && s.toLowerCase() !== 'null' ? s.slice(0, max) : null;
}

function int(v) {
  const n = typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function normalizeModelFields(raw, { products, rules }) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const lang = ['en', 'fr', 'es', 'de'].includes(r.language) ? r.language : null;
  const capacityMl = int(r.capacity_ml);
  const productText = [str(r.sku), str(r.product_description, 200)].filter(Boolean).join(' ');
  const productSku = productText ? matchProducts(productText, capacityMl, products)[0]?.sku ?? null : null;

  const incoterm = typeof r.incoterm === 'string' && rules.incoterms[r.incoterm.toUpperCase()] ? r.incoterm.toUpperCase() : null;
  const port = str(r.port);
  const findPort = (list) => list.find((p) => port && p.toLowerCase() === port.toLowerCase()) || null;

  const logoKeys = ['none', 'silk1', 'silk2', 'laser', 'unspecified'];
  const packKeys = ['none', 'white', 'color'];

  return {
    language: lang,
    buyerName: str(r.buyer_name),
    company: str(r.company),
    productSku,
    capacityMl,
    quantity: int(r.quantity),
    incoterm,
    loadingPort: findPort(rules.loadingPorts),
    destinationPort: findPort(Object.keys(rules.ports)),
    currency: ['USD', 'EUR'].includes(r.currency) ? r.currency : null,
    logo: logoKeys.includes(r.logo) ? r.logo : null,
    packaging: packKeys.includes(r.packaging) ? r.packaging : null,
    certsRequested: Array.isArray(r.certifications) ? KNOWN_CERTS.filter((c) => r.certifications.some((x) => String(x).toUpperCase().includes(c.toUpperCase()))) : null,
    leadTimeAsked: typeof r.lead_time_asked === 'boolean' ? r.lead_time_asked : null,
  };
}

// 模型字段优先，模型给不出的字段用本地解析结果补齐；原文高亮仍沿用本地命中位置。
export function mergeExtraction(local, modelFields, model) {
  const fields = { ...local.fields };
  for (const [k, v] of Object.entries(modelFields)) {
    if (v !== null && v !== undefined) fields[k] = v;
  }
  return { ...local, method: 'model', model, fields };
}

export function parseJsonContent(content) {
  const s = String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('模型没有返回 JSON');
  return JSON.parse(s.slice(start, end + 1));
}

export function draftFacts(result, { rules, company, settings }) {
  const { fields, product, quote, questions, lang } = result;
  const certs = fields.certsRequested || [];
  const facts = {
    buyer_name: fields.buyerName,
    product: product ? `${product.names[lang]} (${product.sku})` : null,
    quote_validity_days: rules.quoteValidityDays,
    lead_time: fields.leadTimeAsked && product ? `${leadTimeFor(product, rules)} days` : null,
    certificates_we_can_provide: certs.filter((c) => company.certsHeld.includes(c)),
    certificates_manager_will_answer_separately: certs.filter((c) => !company.certsHeld.includes(c)),
    questions_to_ask: questions.map((q) => QUESTION_TEXT[q] || q),
    signature: settings.signature,
  };
  if (quote.ok) {
    facts.quote = {
      quantity: formatInt(quote.pricedQty, lang),
      unit_price: formatPrice(quote.unit, quote.currency, lang),
      terms: `${quote.incoterm} ${quote.place}`,
      includes: [quote.logoKey !== 'none' ? rules.options.logo[quote.logoKey].label : null, quote.packagingKey !== 'none' ? rules.options.packaging[quote.packagingKey].label : null].filter(Boolean),
      moq_note: quote.moqApplied ? `MOQ ${formatInt(quote.moq, lang)}` : null,
    };
  } else if (quote.reason === 'no_quantity') {
    facts.reference_prices = quote.tierTable.map((r) => ({ quantity: r.label, unit_price: formatPrice(r.unit, r.currency, lang) }));
    facts.terms = `${quote.incoterm} ${quote.place}`;
  } else {
    facts.note = '暂不报价，说明由负责人跟进';
  }
  return facts;
}
