// 报价规则表（演示数据，虚构）。价格只由这张表和 pricing.js 计算，模型不参与定价。

export const RULES = {
  version: 'v3',
  updatedAt: '2026-10-08',
  baseCurrency: 'USD',
  baseIncoterm: 'FOB',
  loadingPorts: ['Shanghai', 'Ningbo'],
  quoteValidityDays: 15,
  leadTimeDays: '25-30',

  tiers: {
    'VF-500': [
      { min: 1000, max: 2999, price: 4.1 },
      { min: 3000, max: 4999, price: 3.85 },
      { min: 5000, max: 9999, price: 3.6 },
      { min: 10000, max: null, price: 3.4 },
    ],
    'VF-750': [
      { min: 1000, max: 2999, price: 4.6 },
      { min: 3000, max: 4999, price: 4.3 },
      { min: 5000, max: 9999, price: 4.05 },
      { min: 10000, max: null, price: 3.85 },
    ],
    'TB-600': [
      { min: 1000, max: 2999, price: 3.7 },
      { min: 3000, max: 4999, price: 3.45 },
      { min: 5000, max: 9999, price: 3.25 },
      { min: 10000, max: null, price: 3.05 },
    ],
    'LID-01': [
      { min: 2000, max: 4999, price: 0.55 },
      { min: 5000, max: 9999, price: 0.48 },
      { min: 10000, max: null, price: 0.42 },
    ],
  },

  // 单只出厂成本（人民币），用于利润底线校验。
  unitCostCny: {
    'VF-500': 20.5,
    'VF-750': 23.4,
    'TB-600': 18.2,
    'LID-01': 2.4,
  },

  options: {
    logo: {
      none: { label: '不印 logo', price: 0, cost: 0 },
      silk1: { label: '单色丝印', price: 0.15, cost: 0.1 },
      silk2: { label: '双色丝印', price: 0.25, cost: 0.17 },
      laser: { label: '激光雕刻', price: 0.2, cost: 0.12 },
    },
    packaging: {
      none: { label: '中性内盒（含）', price: 0, cost: 0 },
      white: { label: '单只白盒', price: 0.05, cost: 0.03 },
      color: { label: '单只彩盒', price: 0.1, cost: 0.07 },
    },
  },

  incoterms: {
    FOB: { label: 'FOB 装运港', supported: true },
    EXW: { label: 'EXW 工厂交货', supported: true, priceAdjustRate: -0.02, costAdjustRate: -0.015, place: 'Suzhou' },
    CIF: { label: 'CIF 目的港', supported: true, insuranceRate: 0.0033 },
    CFR: { label: 'CFR 目的港', supported: true },
    DDP: { label: 'DDP 完税交货', supported: false },
    DAP: { label: 'DAP 目的地交货', supported: false },
  },

  // 海运费按单只分摊（USD/只，20GP 拼箱估算值）。
  freightPerUnit: {
    EU: 0.22,
    UK: 0.24,
    US_WEST: 0.26,
    US_EAST: 0.31,
  },
  ports: {
    Hamburg: 'EU',
    Rotterdam: 'EU',
    Antwerp: 'EU',
    'Le Havre': 'EU',
    Marseille: 'EU',
    Valencia: 'EU',
    Barcelona: 'EU',
    Genoa: 'EU',
    Felixstowe: 'UK',
    Southampton: 'UK',
    'Los Angeles': 'US_WEST',
    'Long Beach': 'US_WEST',
    Oakland: 'US_WEST',
    'New York': 'US_EAST',
    Savannah: 'US_EAST',
  },

  fx: {
    USDCNY: 7.1,
    USDEUR: 0.92,
    eurBuffer: 0.02,
    setAt: '2026-10-08',
  },

  minMarginRate: 0.15,

  authority: {
    salesMaxDiscount: 0.03,
    approvalOrderValueUsd: 50000,
  },

  // 简化的受限地区关键词，仅用于演示“转人工复核”。
  restrictedKeywords: ['Crimea', 'Donetsk', 'Luhansk', 'North Korea', 'DPRK', 'Pyongyang', 'Syria', 'Iran', 'Cuba'],
};
