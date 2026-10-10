// 本地解析器：不依赖模型，用规则和词表从询盘里抽字段。
// 接入模型后由 model.js 产出字段，这里的结果仍用于原文高亮和缺省兜底。
import { fold, escapeRegExp } from './text.js';
import { matchProducts } from './retriever.js';

const LANG_WORDS = {
  en: ['the', 'and', 'we', 'you', 'please', 'our', 'your', 'with', 'for', 'price', 'quote', 'thanks', 'regards', 'hello', 'hi', 'can', 'would', 'need', 'are', 'is', 'of'],
  fr: ['nous', 'vous', 'les', 'pour', 'avec', 'bonjour', 'merci', 'prix', 'votre', 'notre', 'des', 'une', 'est', 'cordialement', 'pourriez', 'sommes', 'cherchons', 'aussi'],
  es: ['hola', 'somos', 'para', 'con', 'precio', 'gracias', 'saludos', 'necesitamos', 'unidades', 'cual', 'los', 'las', 'una', 'vuestros', 'plazo', 'entrega', 'nuestro', 'quisieramos', 'el'],
  de: ['wir', 'sie', 'und', 'fur', 'mit', 'bitte', 'ihnen', 'ein', 'eine', 'angebot', 'haben', 'das', 'ist', 'aus', 'den', 'der', 'die', 'guten', 'tag', 'stuck', 'unseren', 'grußen'],
};

export function detectLanguage(text) {
  const words = fold(text).match(/[a-zß]+/g) || [];
  let best = 'en';
  let bestScore = 0;
  for (const [lang, list] of Object.entries(LANG_WORDS)) {
    const set = new Set(list);
    const score = words.filter((w) => set.has(w)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
}

const NUM = '(\\d{1,3}(?:[.,\\u0020\\u00a0\\u202f]\\d{3})+|\\d+(?:[.,]\\d+)?\\s?k|\\d+)';
const UNIT = '(?:pcs|pc|pieces|piece|units|unit|unites|unite|unidades|unidad|piezas|uds|stuck|stk|sets|只|个|件)';
const QTY_WITH_UNIT = new RegExp(`${NUM}\\s*${UNIT}(?![a-z])`, 'i');
const QTY_WITH_LABEL = new RegExp(`(?:quantity|qty|quantite|cantidad|menge|数量)\\s*[:：]?\\s*${NUM}`, 'i');
// 数量后面直接跟产品名（如 “para 4.000 termos”），排除容量、尺寸、天数等。
const QTY_BEFORE_NOUN = new RegExp(`(?:for|of|order|quote|need|pour|para|necesitamos|fur|von)\\s+${NUM}\\s+(?!(?:ml|l|cl|cm|mm|kg|g|days?|dias|jours|tage|weeks?|semanas|%)(?![a-z]))[a-z]`, 'i');

export function parseNumber(raw) {
  const s = raw.trim().toLowerCase().replace(/\s+(?=k$)/, '');
  if (s.endsWith('k')) return Math.round(parseFloat(s.slice(0, -1).replace(',', '.')) * 1000);
  if (/^\d{1,3}([.,\u0020\u00a0\u202f]\d{3})+$/.test(s)) return Number(s.replace(/[.,\u0020\u00a0\u202f]/g, ''));
  return Math.round(parseFloat(s.replace(',', '.')));
}

const CERTS = [
  { key: 'LFGB', re: /\blfgb\b/ },
  { key: 'FDA', re: /\bfda\b/ },
  { key: 'BSCI', re: /\bbsci\b/ },
  { key: 'Sedex', re: /\bsedex\b/ },
  { key: 'ISO 9001', re: /iso\s?9001/ },
];

const LOGO_PATTERNS = [
  { key: 'silk2', re: /(two|2)[\s-]?colou?rs?|deux couleurs|2 couleurs|dos (colores|tintas)|2 (colores|tintas)|zweifarbig|2-farbig|双色/ },
  { key: 'silk1', re: /(one|1|single)[\s-]?colou?r|une couleur|1 couleur|(un|1) color|una tinta|1 tinta|einfarbig|1-farbig|单色/ },
  { key: 'laser', re: /laser|lasergravur|grabado|gravure|engrav|激光/ },
];
const LOGO_WORD = /\blogos?\b|logotipo|bedruck|imprim|printed|printing|impres|镭雕|印/;

const PACKAGING_PATTERNS = [
  { key: 'color', re: /(colou?r|gift)\s?(gift\s)?box|boite (cadeau|couleur)|caja (de )?(regalo|color)|geschenk(box|karton)|farbkarton|彩盒/ },
  { key: 'white', re: /white box|boite blanche|caja blanca|weißer? (karton|box)|neutral(er)? karton|白盒/ },
];

const CLOSINGS = /^(best regards|kind regards|warm regards|regards|best|thanks|thank you|many thanks|cheers|cordialement|bien cordialement|salutations|bien a vous|saludos|saludos cordiales|un saludo|atentamente|mit freundlichen gru(ß|ss)en|viele gru(ß|ss)e|beste gru(ß|ss)e|gru(ß|ss)|此致|谢谢)[,!.]?\s*$/i;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /\+?\d[\d\s\-()]{7,}\d/g;

const PORT_ALIASES = { hambourg: 'Hamburg', amberes: 'Antwerp', anvers: 'Antwerp', antwerpen: 'Antwerp', 'el havre': 'Le Havre', genova: 'Genoa', genes: 'Genoa' };

function find(folded, source, re, field, evidence) {
  const m = re.exec(folded);
  if (!m) return null;
  evidence[field] = { text: source.slice(m.index, m.index + m[0].length), index: m.index };
  return m;
}

export function parseInquiry(text, { products, rules }) {
  const source = String(text).normalize('NFC');
  const folded = fold(source);
  const evidence = {};

  const language = detectLanguage(source);

  let quantity = null;
  const qm = find(folded, source, QTY_WITH_UNIT, 'quantity', evidence)
    || find(folded, source, QTY_WITH_LABEL, 'quantity', evidence)
    || find(folded, source, QTY_BEFORE_NOUN, 'quantity', evidence);
  if (qm) {
    quantity = parseNumber(qm[1]);
    const index = qm.index + qm[0].indexOf(qm[1]);
    if (index > evidence.quantity.index) evidence.quantity = { text: source.slice(index, index + qm[1].length), index };
  }

  let capacityMl = null;
  const cm = find(folded, source, /(\d{2,4})\s?(ml|毫升)(?![a-z])/, 'capacityMl', evidence);
  if (cm) capacityMl = Number(cm[1]);
  else {
    const lm = find(folded, source, /(\d(?:[.,]\d{1,2})?)\s?(l|liter|litre|litro)s?(?![a-z])/, 'capacityMl', evidence);
    if (lm) capacityMl = Math.round(parseFloat(lm[1].replace(',', '.')) * 1000);
  }

  const matches = matchProducts(source, capacityMl, products);
  const productSku = matches[0]?.sku ?? null;
  if (productSku) {
    const hit = matches[0].hits.find((h) => !/ml$/.test(h));
    if (hit) {
      const idx = folded.indexOf(fold(hit));
      if (idx >= 0) evidence.productSku = { text: source.slice(idx, idx + hit.length), index: idx };
    }
  }

  let incoterm = null;
  const im = find(folded, source, /\b(fob|cif|cfr|exw|ddp|dap)\b/, 'incoterm', evidence);
  if (im) incoterm = im[1].toUpperCase();

  let loadingPort = null;
  let destinationPort = null;
  const portNames = [
    ...rules.loadingPorts.map((p) => [fold(p), p, 'loading']),
    ...Object.keys(rules.ports).map((p) => [fold(p), p, 'destination']),
    ...Object.entries(PORT_ALIASES).map(([alias, p]) => [alias, p, 'destination']),
  ];
  for (const [needle, name, kind] of portNames) {
    const m = new RegExp(`(^|[^a-z])(${escapeRegExp(needle)})(?![a-z])`).exec(folded);
    if (!m) continue;
    const index = m.index + m[1].length;
    if (kind === 'loading' && !loadingPort) {
      loadingPort = name;
      evidence.loadingPort = { text: source.slice(index, index + needle.length), index };
    }
    if (kind === 'destination' && !destinationPort) {
      destinationPort = name;
      evidence.destinationPort = { text: source.slice(index, index + needle.length), index };
    }
  }

  let currency = 'USD';
  let currencySource = 'default';
  if (find(folded, source, /\b(eur|euros?)\b|€/, 'currency', evidence)) {
    currency = 'EUR';
    currencySource = 'text';
  } else if (find(folded, source, /\busd\b|us\s?dollars?|\$/, 'currency', evidence)) {
    currencySource = 'text';
  }

  let logo = 'none';
  for (const p of LOGO_PATTERNS) {
    if (find(folded, source, p.re, 'logo', evidence)) {
      logo = p.key;
      break;
    }
  }
  if (logo === 'none' && find(folded, source, LOGO_WORD, 'logo', evidence)) logo = 'unspecified';

  let packaging = 'none';
  for (const p of PACKAGING_PATTERNS) {
    if (find(folded, source, p.re, 'packaging', evidence)) {
      packaging = p.key;
      break;
    }
  }

  const certsRequested = CERTS.filter((c) => c.re.test(folded)).map((c) => c.key);
  const leadTimeAsked = /lead time|delivery time|production time|delai|plazo|lieferzeit|交期|货期/.test(folded);

  const lines = source.split(/\r?\n/).map((l) => l.trim());
  let buyerName = null;
  let company = null;
  const closingIdx = lines.findIndex((l) => CLOSINGS.test(fold(l)));
  if (closingIdx >= 0) {
    const tail = lines.slice(closingIdx + 1).filter((l) => l && !l.match(EMAIL) && !/^\+?[\d\s\-()]{7,}$/.test(l));
    buyerName = tail[0] || null;
    company = tail[1] || null;
    if (buyerName) evidence.buyerName = { text: buyerName, index: source.indexOf(buyerName, source.indexOf(lines[closingIdx])) };
  }

  return {
    method: 'local',
    fields: {
      language,
      buyerName,
      company,
      productSku,
      capacityMl,
      quantity,
      incoterm,
      loadingPort,
      destinationPort,
      currency,
      logo,
      packaging,
      certsRequested,
      leadTimeAsked,
    },
    currencySource,
    productMatches: matches.slice(0, 3),
    contacts: {
      emails: source.match(EMAIL) || [],
      phones: source.match(PHONE) || [],
    },
    evidence,
  };
}
