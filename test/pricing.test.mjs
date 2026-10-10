import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, checkDraftPrices, extractPrices } from '../src/core/pricing.js';
import { RULES } from '../src/data/rules.js';
import { PRODUCTS } from '../src/data/catalog.js';

const base = { productSku: 'VF-500', quantity: 5000, incoterm: 'FOB', loadingPort: 'Shanghai', currency: 'USD', logo: 'silk1', packaging: 'color' };
const quote = (f, opts) => calculateQuote({ ...base, ...f }, RULES, PRODUCTS, opts);

test('与 PPT 设计稿一致：VF-500 5000 只 单色丝印 彩盒 FOB Shanghai = USD 3.85', () => {
  const q = quote({});
  assert.equal(q.ok, true);
  assert.deepEqual(q.lines.map((l) => l.usd), [3.6, 0.15, 0.1]);
  assert.equal(q.unit, 3.85);
  assert.equal(q.total, 19250);
  assert.equal(q.floorUsd, 3.52);
  assert.equal(q.needsApproval, false);
});

test('同样的输入得到同样的价格', () => {
  assert.deepEqual(quote({}), quote({}));
});

test('阶梯边界：4999 和 5000 落在不同档', () => {
  assert.equal(quote({ quantity: 4999 }).tier.price, 3.85);
  assert.equal(quote({ quantity: 5000 }).tier.price, 3.6);
  assert.equal(quote({ quantity: 10000 }).tier.price, 3.4);
});

test('低于起订量按起订量报价并标记', () => {
  const q = quote({ quantity: 600 });
  assert.equal(q.pricedQty, 1000);
  assert.equal(q.moqApplied, true);
  assert.equal(q.tier.price, 4.1);
});

test('CIF 加运费和保险，保险按 110% 投保', () => {
  const q = calculateQuote({ productSku: 'TB-600', quantity: 20000, incoterm: 'CIF', destinationPort: 'Los Angeles', currency: 'USD', logo: 'silk2', packaging: 'white' }, RULES, PRODUCTS);
  const byKey = Object.fromEntries(q.lines.map((l) => [l.key, l.usd]));
  assert.equal(byKey.freight, 0.26);
  assert.equal(byKey.insurance, 0.01);
  assert.equal(q.unit, 3.62);
  assert.equal(q.totalUsd, 72400);
});

test('订单金额超过 5 万美元需要审批', () => {
  const q = calculateQuote({ productSku: 'TB-600', quantity: 20000, incoterm: 'CIF', destinationPort: 'Los Angeles', logo: 'silk2', packaging: 'white' }, RULES, PRODUCTS);
  assert.equal(q.needsApproval, true);
  assert.match(q.approvalReasons[0], /超过 50,000/);
});

test('欧元报价含 2% 汇率缓冲', () => {
  const q = quote({ currency: 'EUR' });
  assert.equal(q.fxRate, 0.9384);
  assert.equal(q.unit, 3.61);
  assert.equal(q.unitUsd, 3.85);
});

test('折让在 3% 以内不需要审批，超过则需要', () => {
  assert.equal(quote({}, { discount: 0.03 }).needsApproval, false);
  const q = quote({}, { discount: 0.05 });
  assert.equal(q.needsApproval, true);
  assert.match(q.approvalReasons.join(), /超过业务员权限/);
});

test('低于利润底线必须审批', () => {
  const q = quote({}, { discount: 0.15 });
  assert.equal(q.aboveFloor, false);
  assert.ok(q.approvalReasons.some((r) => r.includes('低于利润底线')));
});

test('EXW 在 FOB 基础上下调 2%', () => {
  const q = calculateQuote({ productSku: 'LID-01', quantity: 3000, incoterm: 'EXW', logo: 'none', packaging: 'none' }, RULES, PRODUCTS);
  assert.equal(q.unit, 0.54);
  assert.equal(q.place, 'Suzhou');
});

test('杯盖不能印 logo，即使询盘要求', () => {
  const q = calculateQuote({ productSku: 'LID-01', quantity: 3000, logo: 'silk1', packaging: 'color' }, RULES, PRODUCTS);
  assert.equal(q.logoKey, 'none');
  assert.equal(q.packagingKey, 'none');
});

test('没写数量时返回逐档参考价', () => {
  const q = calculateQuote({ productSku: 'VF-750', quantity: null, incoterm: 'CIF', destinationPort: 'Le Havre', currency: 'EUR', logo: 'laser' }, RULES, PRODUCTS);
  assert.equal(q.ok, false);
  assert.equal(q.reason, 'no_quantity');
  assert.deepEqual(q.tierTable.map((t) => t.unit), [4.73, 4.45, 4.21, 4.03]);
});

test('DDP 不自动报价', () => {
  const q = quote({ incoterm: 'DDP' });
  assert.equal(q.ok, false);
  assert.equal(q.reason, 'incoterm');
});

test('CIF 没有目的港时不报价', () => {
  const q = quote({ incoterm: 'CIF', destinationPort: null });
  assert.equal(q.reason, 'no_port');
});

test('从草稿中提取价格：识别各语言写法，忽略数量', () => {
  assert.deepEqual(extractPrices('USD 3.85/pc, 5,000 pcs, 3,85 EUR, 2.000 Stück, total 19,250.00'), [3.85, 3.85, 19250]);
});

test('草稿价格校验：改价会被拦截', () => {
  const q = quote({});
  assert.equal(checkDraftPrices('our price is USD 3.85/pc', q).ok, true);
  const bad = checkDraftPrices('our price is USD 3.65/pc', q);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.unknown, [3.65]);
  assert.equal(bad.missingUnit, true);
});
