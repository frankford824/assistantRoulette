import { fold, containsTerm, unique } from './text.js';

const STOP = new Set([
  'the', 'and', 'for', 'with', 'our', 'your', 'you', 'are', 'please', 'can', 'we', 'of', 'to', 'in', 'is', 'a',
  'nous', 'vous', 'les', 'des', 'pour', 'avec', 'une', 'est', 'de', 'la', 'le',
  'para', 'con', 'los', 'las', 'una', 'el', 'en', 'que', 'por',
  'und', 'fur', 'mit', 'wir', 'sie', 'der', 'die', 'das', 'ein', 'eine', 'ist',
]);

export function tokenize(text) {
  const t = fold(text);
  const latin = (t.match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w));
  const grams = [];
  for (const run of t.match(/[\u4e00-\u9fff]+/g) || []) {
    if (run.length === 1) grams.push(run);
    for (let i = 0; i < run.length - 1; i += 1) grams.push(run.slice(i, i + 2));
  }
  return [...latin, ...grams];
}

// 产品匹配：型号直中 > 多词关键词 > 单词关键词，容量一致加分、不一致扣分。
export function matchProducts(text, capacityMl, products) {
  const folded = fold(text);
  return products
    .map((p) => {
      let score = 0;
      const hits = [];
      if (containsTerm(folded, p.sku)) {
        score += 10;
        hits.push(p.sku);
      }
      for (const k of p.keywords) {
        if (containsTerm(folded, k)) {
          score += k.includes(' ') ? 3 : 2;
          hits.push(k);
        }
      }
      if (score > 0 && capacityMl && p.capacityMl) {
        if (p.capacityMl === capacityMl) {
          score += 4;
          hits.push(`${capacityMl} ml`);
        } else {
          score -= 3;
        }
      }
      return { sku: p.sku, name: p.name, score, hits: unique(hits) };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

// 历史回复检索：简化的 TF-IDF 打分，返回可引用的范例。
export function searchHistory(text, history, limit = 2) {
  const q = unique(tokenize(text));
  const docs = history.map((h) => ({ h, tokens: tokenize(`${h.title} ${h.text}`) }));
  const df = new Map();
  for (const d of docs) for (const tok of new Set(d.tokens)) df.set(tok, (df.get(tok) || 0) + 1);
  const n = docs.length;
  return docs
    .map(({ h, tokens }) => {
      let score = 0;
      const matched = [];
      for (const tok of q) {
        const tf = tokens.filter((x) => x === tok).length;
        if (tf) {
          score += tf * Math.log(1 + n / df.get(tok));
          matched.push(tok);
        }
      }
      return { id: h.id, title: h.title, text: h.text, score: Math.round(score * 100) / 100, matched };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
