// 报价规则引擎：输入结构化询盘字段 + 规则表，输出可追溯的报价明细。
// 同样的输入永远得到同样的价格；模型不参与这里的任何计算。
import { round2, formatInt } from './text.js';

function tierLabel(t) {
  return t.max == null ? `${formatInt(t.min)}+` : `${formatInt(t.min)}–${formatInt(t.max)}`;
}

function resolveLogo(fields, product) {
  if (!product.allowLogo) return 'none';
  if (fields.logo === 'unspecified') return 'silk1';
  return fields.logo || 'none';
}

export function calculateQuote(fields, rules, products, opts = {}) {
  const discount = Math.min(Math.max(Number(opts.discount) || 0, 0), 0.5);
  const product = products.find((p) => p.sku === fields.productSku);
  if (!product) {
    return { ok: false, reason: 'no_product', message: '没有匹配到产品，无法计算价格', ruleVersion: rules.version };
  }

  const sku = product.sku;
  const tiers = rules.tiers[sku];
  const incoterm = fields.incoterm || rules.baseIncoterm;
  const inc = rules.incoterms[incoterm];
  const base = { product, sku, incoterm, ruleVersion: rules.version };

  if (!inc || !inc.supported) {
    return { ...base, ok: false, reason: 'incoterm', message: `${incoterm} 不在报价规则支持范围内，需负责人人工报价` };
  }

  let place;
  if (incoterm === 'EXW') place = inc.place;
  else if (incoterm === 'FOB') place = rules.loadingPorts.includes(fields.loadingPort) ? fields.loadingPort : rules.loadingPorts[0];
  else place = fields.destinationPort;

  const region = rules.ports[fields.destinationPort];
  if ((incoterm === 'CIF' || incoterm === 'CFR') && !region) {
    return { ...base, place, ok: false, reason: 'no_port', message: `${incoterm} 需要目的港，询盘没写或不在运费表里` };
  }

  if (!fields.quantity) {
    const tierTable = tiers.map((t) => {
      const q = calculateQuote({ ...fields, quantity: t.min }, rules, products, { discount: 0 });
      return { label: tierLabel(t), min: t.min, max: t.max, unit: q.unit, currency: q.currency };
    });
    return { ...base, place, ok: false, reason: 'no_quantity', message: '询盘没写数量，先回复阶梯价并追问数量', tierTable };
  }

  const moq = tiers[0].min;
  const pricedQty = Math.max(fields.quantity, moq);
  const tier = tiers.find((t) => pricedQty >= t.min && (t.max == null || pricedQty <= t.max));

  const lines = [];
  const steps = [];
  let cost = rules.unitCostCny[sku] / rules.fx.USDCNY;
  steps.push(`单只成本 ${rules.unitCostCny[sku]} CNY ÷ 汇率 ${rules.fx.USDCNY} = USD ${cost.toFixed(4)}`);

  lines.push({ key: 'base', label: '基础价', basis: `${sku} 阶梯 ${tierLabel(tier)}`, usd: tier.price });

  const logoKey = resolveLogo(fields, product);
  if (logoKey !== 'none') {
    const o = rules.options.logo[logoKey];
    const note = fields.logo === 'unspecified' ? '（工艺未写，按单色丝印预估）' : '';
    lines.push({ key: 'logo', label: 'Logo', basis: o.label + note, usd: o.price });
    cost += o.cost;
  }

  const packagingKey = product.allowPackaging ? fields.packaging || 'none' : 'none';
  if (packagingKey !== 'none') {
    const o = rules.options.packaging[packagingKey];
    lines.push({ key: 'packaging', label: '包装', basis: o.label, usd: o.price });
    cost += o.cost;
  }

  const sum = () => round2(lines.reduce((s, l) => s + l.usd, 0));

  if (incoterm === 'EXW') {
    const adj = round2(sum() * inc.priceAdjustRate);
    lines.push({ key: 'incoterm', label: 'EXW 调整', basis: `工厂交货 ${(inc.priceAdjustRate * 100).toFixed(1)}%`, usd: adj });
    cost *= 1 + inc.costAdjustRate;
  }

  if (incoterm === 'CIF' || incoterm === 'CFR') {
    const freight = rules.freightPerUnit[region];
    lines.push({ key: 'freight', label: '海运费分摊', basis: `${fields.destinationPort}（${region}）`, usd: freight });
    cost += freight;
    if (incoterm === 'CIF') {
      const insurance = round2(sum() * 1.1 * inc.insuranceRate);
      lines.push({ key: 'insurance', label: '保险费', basis: `CIF × 110% × ${(inc.insuranceRate * 100).toFixed(2)}%`, usd: insurance });
      cost += insurance;
    }
  }

  const subtotalUsd = sum();
  if (discount > 0) {
    lines.push({ key: 'discount', label: '业务员折让', basis: `${(discount * 100).toFixed(1)}%`, usd: -round2(subtotalUsd * discount) });
  }
  const unitUsd = sum();

  const floorUsd = Math.ceil(cost * (1 + rules.minMarginRate) * 100) / 100;
  steps.push(`含选项/运保成本 USD ${cost.toFixed(4)} × (1 + ${rules.minMarginRate * 100}%) = 底线 USD ${floorUsd.toFixed(2)}`);

  let currency = 'USD';
  let fxRate = 1;
  let unit = unitUsd;
  if (fields.currency === 'EUR') {
    currency = 'EUR';
    fxRate = round2(rules.fx.USDEUR * (1 + rules.fx.eurBuffer) * 10000) / 10000;
    unit = round2(unitUsd * fxRate);
    steps.push(`欧元报价：USD ${unitUsd.toFixed(2)} × ${rules.fx.USDEUR} × (1 + ${rules.fx.eurBuffer * 100}% 汇率缓冲) = EUR ${unit.toFixed(2)}`);
  }

  const total = round2(unit * pricedQty);
  const totalUsd = round2(unitUsd * pricedQty);

  const approvalReasons = [];
  if (discount > rules.authority.salesMaxDiscount) {
    approvalReasons.push(`折让 ${(discount * 100).toFixed(1)}% 超过业务员权限 ${rules.authority.salesMaxDiscount * 100}%`);
  }
  if (unitUsd < floorUsd) {
    approvalReasons.push(`单价 USD ${unitUsd.toFixed(2)} 低于利润底线 USD ${floorUsd.toFixed(2)}`);
  }
  if (totalUsd > rules.authority.approvalOrderValueUsd) {
    approvalReasons.push(`订单金额 USD ${formatInt(totalUsd)} 超过 ${formatInt(rules.authority.approvalOrderValueUsd)}，需负责人确认`);
  }

  return {
    ...base,
    ok: true,
    place,
    quantity: fields.quantity,
    pricedQty,
    moq,
    moqApplied: fields.quantity < moq,
    tier,
    logoKey,
    packagingKey,
    lines,
    subtotalUsd,
    discount,
    unitUsd,
    currency,
    fxRate,
    unit,
    total,
    totalUsd,
    costUsd: Math.round(cost * 10000) / 10000,
    floorUsd,
    marginRate: Math.round(((unitUsd - cost) / unitUsd) * 1000) / 1000,
    aboveFloor: unitUsd >= floorUsd,
    approvalReasons,
    needsApproval: approvalReasons.length > 0,
    steps,
  };
}

// 草稿里出现的所有“带两位小数的数字”都必须来自报价结果，用来拦截模型改价或编价。
export function allowedPrices(quote) {
  const set = new Set();
  if (!quote) return set;
  if (quote.ok) {
    [quote.unit, quote.unitUsd, quote.total, quote.totalUsd, ...quote.lines.map((l) => Math.abs(l.usd))].forEach((v) => set.add(round2(v)));
  }
  for (const row of quote.tierTable || []) set.add(round2(row.unit));
  return set;
}

export function extractPrices(text) {
  const out = [];
  const re = /\d(?:[\d.,]*\d)?/g;
  let m;
  while ((m = re.exec(text))) {
    const dm = m[0].match(/^(.*)[.,](\d{2})$/);
    if (!dm) continue;
    const intPart = dm[1].replace(/[.,]/g, '');
    if (/^\d+$/.test(intPart)) out.push(Number(`${intPart}.${dm[2]}`));
  }
  return out;
}

export function checkDraftPrices(text, quote) {
  const allowed = allowedPrices(quote);
  const found = extractPrices(text);
  const unknown = found.filter((v) => ![...allowed].some((a) => Math.abs(a - v) < 0.001));
  const missingUnit = quote?.ok && !found.some((v) => Math.abs(v - quote.unit) < 0.001);
  return { ok: unknown.length === 0 && !missingUnit, unknown, missingUnit: Boolean(missingUnit), found };
}
