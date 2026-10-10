// 五步流程：解析 → 检索 → 算价 → 初稿 → 合规检查。浏览器和 server.mjs 共用这一份。
import { parseInquiry } from './parser.js';
import { searchHistory } from './retriever.js';
import { calculateQuote } from './pricing.js';
import { buildDraft, buildQuestions } from './drafter.js';
import { checkCompliance, desensitize } from './compliance.js';

export const DEFAULT_SETTINGS = {
  signature: 'Lucy Chen\nSales, Hengchuan Housewares (demo)',
  aiFooter: true,
};

export function computeMissing(fields, product) {
  const missing = [];
  if (!fields.productSku) missing.push('product');
  if (!fields.quantity) missing.push('quantity');
  if ((fields.incoterm === 'CIF' || fields.incoterm === 'CFR') && !fields.destinationPort) missing.push('port');
  if (product?.allowLogo && fields.logo === 'unspecified') missing.push('logo_detail');
  return missing;
}

export function runPipeline(inquiry, ctx) {
  const { rules, products, history, company } = ctx;
  const settings = { ...DEFAULT_SETTINGS, ...(ctx.settings || {}) };
  const extraction = inquiry.extracted || parseInquiry(inquiry.text, { products, rules });
  const fields = { ...extraction.fields, ...(inquiry.overrides || {}) };
  const product = products.find((p) => p.sku === fields.productSku) || null;

  const missing = computeMissing(fields, product);
  const quote = calculateQuote(fields, rules, products, { discount: inquiry.discount || 0 });
  const references = searchHistory(inquiry.text, history);
  const questions = buildQuestions(fields, product, missing);
  const generated = buildDraft({ fields, product, quote, questions, company, products, rules, settings });

  let draftSource = 'template';
  let draftText = generated.text;
  if (inquiry.modelDraft) {
    draftSource = 'model';
    draftText = inquiry.modelDraft;
  }
  if (inquiry.draftEdited != null) {
    draftSource = 'edited';
    draftText = inquiry.draftEdited;
  }

  const compliance = checkCompliance({ text: inquiry.text, fields, quote, draftText, rules, company, aiFooter: settings.aiFooter });

  const approvalReasons = [...(quote.approvalReasons || [])];
  if (!quote.ok && quote.reason === 'incoterm') approvalReasons.push(quote.message);
  for (const c of compliance) if (c.level === 'block') approvalReasons.push(`${c.label}：${c.detail}`);

  return {
    extraction,
    fields,
    product,
    missing,
    quote,
    references,
    questions,
    generatedDraft: generated.text,
    draftText,
    draftSource,
    lang: generated.lang,
    compliance,
    masked: desensitize(inquiry.text),
    approvalReasons,
    needsApproval: approvalReasons.length > 0,
    priceBlocked: compliance.some((c) => c.level === 'block' && c.label.startsWith('草稿价格')),
  };
}
