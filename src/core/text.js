// 文本工具：去重音、小写化，长度与原文保持一致，方便把命中位置映射回原文做高亮。
export function fold(text) {
  return String(text)
    .normalize('NFC')
    .split('')
    .map((ch) => {
      const lower = ch.normalize('NFD')[0].toLowerCase();
      return lower.length === 1 ? lower : ch;
    })
    .join('');
}

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsTerm(folded, term) {
  const t = fold(term);
  if (/[\u4e00-\u9fff]/.test(t)) return folded.includes(t);
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(t)}([^a-z0-9]|$)`).test(folded);
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function unique(list) {
  return [...new Set(list)];
}

const GROUP_SEP = { en: ',', fr: ' ', es: '.', de: '.' };
const DEC_SEP = { en: '.', fr: ',', es: ',', de: ',' };

export function formatInt(n, lang = 'en') {
  const sep = GROUP_SEP[lang] ?? ',';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatPrice(value, currency, lang = 'en') {
  const [intPart, dec] = value.toFixed(2).split('.');
  const num = `${formatInt(Number(intPart), lang)}${DEC_SEP[lang] ?? '.'}${dec}`;
  return lang === 'en' ? `${currency} ${num}` : `${num} ${currency}`;
}

export function formatMoney(value, currency = 'USD') {
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
