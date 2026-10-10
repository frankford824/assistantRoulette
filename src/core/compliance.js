import { checkDraftPrices } from './pricing.js';
import { fold, containsTerm } from './text.js';

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /\+?\d[\d\s\-()]{7,}\d/g;

// 送模型前的脱敏：邮箱、电话替换成占位符，原值只留在本地。
export function desensitize(text) {
  const replacements = [];
  const n = { EMAIL: 0, PHONE: 0 };
  const swap = (type) => (match) => {
    n[type] += 1;
    const token = `[${type}_${n[type]}]`;
    replacements.push({ type, original: match, token });
    return token;
  };
  const out = String(text).replace(EMAIL, swap('EMAIL')).replace(PHONE, swap('PHONE'));
  return { text: out, replacements };
}

export function checkCompliance({ text, fields, quote, draftText, rules, company, aiFooter }) {
  const items = [];
  const masked = desensitize(text);

  items.push({
    level: 'ok',
    label: '个人信息脱敏',
    detail: masked.replacements.length
      ? `替换了 ${masked.replacements.length} 处邮箱/电话，送模型的是脱敏后的文本`
      : '原文没有邮箱或电话',
  });

  if (quote.ok) {
    items.push({ level: 'ok', label: '价格来源', detail: `按规则表 ${quote.ruleVersion} 计算，模型不参与定价` });
  } else if (quote.reason === 'no_quantity') {
    items.push({ level: 'ok', label: '价格来源', detail: `数量未知，草稿只给规则表 ${quote.ruleVersion} 的阶梯参考价` });
  } else {
    items.push({ level: 'warn', label: '价格来源', detail: quote.message });
  }

  const priceCheck = checkDraftPrices(draftText, quote);
  if (priceCheck.ok) {
    items.push({ level: 'ok', label: '草稿价格一致', detail: '草稿中的价格都能在报价明细里找到' });
  } else {
    const parts = [];
    if (priceCheck.unknown.length) parts.push(`出现报价明细之外的价格：${priceCheck.unknown.map((v) => v.toFixed(2)).join('、')}`);
    if (priceCheck.missingUnit) parts.push(`草稿里找不到单价 ${quote.unit.toFixed(2)}`);
    items.push({ level: 'block', label: '草稿价格不一致', detail: `${parts.join('；')}。请改回或恢复系统初稿` });
  }

  for (const cert of fields.certsRequested || []) {
    if (company.certsHeld.includes(cert)) {
      items.push({ level: 'ok', label: `认证：${cert}`, detail: '企业资料里有，可在回复中提供' });
    } else {
      items.push({ level: 'warn', label: `认证：${cert}`, detail: '企业资料里没有，草稿未作承诺，改为负责人单独回复' });
    }
  }

  const folded = fold(text);
  const hit = rules.restrictedKeywords.find((k) => containsTerm(folded, k));
  if (hit) {
    items.push({ level: 'block', label: '受限地区', detail: `询盘提到 “${hit}”，需负责人人工复核后再回复` });
  }

  items.push({
    level: 'ok',
    label: 'AI 生成标识',
    detail: aiFooter ? '工作台标注“AI 生成”，发出的邮件末尾附 AI 辅助说明' : '工作台标注“AI 生成”；邮件末尾说明已关闭',
  });

  return items;
}
