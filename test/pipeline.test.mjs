import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../src/core/pipeline.js';
import { desensitize } from '../src/core/compliance.js';
import { checkDraftPrices } from '../src/core/pricing.js';
import { RULES } from '../src/data/rules.js';
import { PRODUCTS, HISTORY, COMPANY } from '../src/data/catalog.js';
import { SAMPLE_INQUIRIES } from '../src/data/inquiries.js';

const ctx = { rules: RULES, products: PRODUCTS, history: HISTORY, company: COMPANY };
const run = (id, extra = {}) => runPipeline({ ...SAMPLE_INQUIRIES.find((q) => q.id === id), ...extra }, ctx);

test('Hamburg 初稿与 PPT 设计稿一致', () => {
  const r = run('Q-1009-01');
  assert.match(r.draftText, /^Dear Jonas Weber,/);
  assert.match(r.draftText, /our price is USD 3\.85\/pc FOB Shanghai, including one-color logo printing and a color gift box\./);
  assert.match(r.draftText, /The quote is valid for 15 days\./);
  assert.match(r.draftText, /Could you please confirm the logo color and artwork\?/);
  assert.match(r.draftText, /Lead time is 25–30 days/);
  assert.equal(r.needsApproval, false);
});

test('所有示例询盘的系统初稿都能通过价格校验', () => {
  for (const q of SAMPLE_INQUIRIES) {
    const r = runPipeline(q, ctx);
    assert.equal(checkDraftPrices(r.draftText, r.quote).ok, true, q.id);
    assert.equal(r.priceBlocked, false, q.id);
  }
});

test('Lyon：法语阶梯参考价 + 追问数量', () => {
  const r = run('Q-1009-02');
  assert.deepEqual(r.missing, ['quantity']);
  assert.match(r.draftText, /1 000–2 999 pièces : 4,73 EUR la pièce/);
  assert.match(r.draftText, /10 000 pièces et plus : 4,03 EUR la pièce/);
  assert.match(r.draftText, /la quantité souhaitée/);
  assert.match(r.draftText, /rapport d'essai LFGB/);
});

test('Rotterdam：没有的认证不作承诺', () => {
  const r = run('Q-1009-04');
  assert.match(r.draftText, /Zu BSCI meldet sich unser Vertriebsleiter separat/);
  assert.doesNotMatch(r.draftText, /BSCI[^\n]*(senden|verfügbar)/);
  assert.ok(r.compliance.some((c) => c.level === 'warn' && c.label.includes('BSCI')));
  assert.match(r.draftText, /^Guten Tag Sanne de Vries,\n\nvielen Dank/);
});

test('Madrid：杯盖交期按订单确认计算，不提 logo', () => {
  const r = run('Q-1008-07');
  assert.match(r.draftText, /0,54 USD por unidad, EXW Suzhou/);
  assert.match(r.draftText, /10–15 días tras la confirmación del pedido/);
});

test('人工改价后被拦截，且不能发送', () => {
  const r0 = run('Q-1009-01');
  const r = run('Q-1009-01', { draftEdited: r0.draftText.replace('USD 3.85', 'USD 3.65') });
  assert.equal(r.priceBlocked, true);
  assert.equal(r.needsApproval, true);
});

test('人工修改字段会重新算价', () => {
  const r = run('Q-1009-01', { overrides: { quantity: 12000 } });
  assert.equal(r.quote.unit, 3.65);
  assert.match(r.draftText, /12,000 pcs/);
});

test('受限地区转人工复核', () => {
  const r = runPipeline({ id: 'x', text: 'Please quote 3,000 pcs of 750ml vacuum flask FOB Shanghai. Delivery to Sevastopol, Crimea.' }, ctx);
  assert.equal(r.needsApproval, true);
  assert.ok(r.compliance.some((c) => c.level === 'block' && c.label === '受限地区'));
});

test('脱敏：邮箱和电话替换为占位符', () => {
  const m = desensitize('mail jonas.weber@weber-hw.example or call +49 40 5550 1234, qty 5,000 pcs');
  assert.equal(m.text, 'mail [EMAIL_1] or call [PHONE_1], qty 5,000 pcs');
  assert.equal(m.replacements.length, 2);
});

test('关闭 AI 说明后邮件末尾不再附加', () => {
  const r = runPipeline(SAMPLE_INQUIRIES[0], { ...ctx, settings: { aiFooter: false } });
  assert.doesNotMatch(r.draftText, /AI assistance/);
});
