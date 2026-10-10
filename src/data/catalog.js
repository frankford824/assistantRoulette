// 演示用虚构企业资料：企业名称、产品、成本、历史回复均为编造，不对应任何真实工厂。

export const COMPANY = {
  name: '苏州恒川日用制品有限公司（虚构）',
  nameEn: 'Hengchuan Housewares Co., Ltd. (fictional)',
  certsHeld: ['LFGB', 'FDA'],
};

export const PRODUCTS = [
  {
    sku: 'VF-500',
    name: '双层真空保温杯 500ml',
    capacityMl: 500,
    allowLogo: true,
    allowPackaging: true,
    names: {
      en: '500 ml double-wall vacuum flask',
      fr: 'bouteille isotherme double paroi 500 ml',
      es: 'termo de doble pared de 500 ml',
      de: 'doppelwandige Thermosflasche 500 ml',
    },
    keywords: ['vacuum flask', 'flask', 'flasks', 'thermos', 'insulated bottle', 'water bottle', 'bouteille isotherme', 'gourde', 'termo', 'termos', 'botella térmica', 'thermosflasche', 'isolierflasche', '保温杯'],
    spec: '304 不锈钢内胆，201 不锈钢外壳，双层真空，保温 12 小时，杯身可丝印或激光雕刻。外箱 50 只，单箱毛重 17kg。',
  },
  {
    sku: 'VF-750',
    name: '双层真空保温杯 750ml',
    capacityMl: 750,
    allowLogo: true,
    allowPackaging: true,
    names: {
      en: '750 ml double-wall vacuum flask',
      fr: 'bouteille isotherme double paroi 750 ml',
      es: 'termo de doble pared de 750 ml',
      de: 'doppelwandige Thermosflasche 750 ml',
    },
    keywords: ['vacuum flask', 'flask', 'flasks', 'thermos', 'insulated bottle', 'water bottle', 'bouteille isotherme', 'gourde', 'termo', 'termos', 'botella térmica', 'thermosflasche', 'isolierflasche', '保温杯'],
    spec: '304 不锈钢内胆，双层真空，保温 12 小时，带提手杯盖。外箱 40 只，单箱毛重 19kg。',
  },
  {
    sku: 'TB-600',
    name: '咖啡随行杯 600ml',
    capacityMl: 600,
    allowLogo: true,
    allowPackaging: true,
    names: {
      en: '600 ml travel coffee tumbler',
      fr: 'mug de voyage 600 ml',
      es: 'vaso térmico de viaje de 600 ml',
      de: 'Coffee-to-go-Becher 600 ml',
    },
    keywords: ['tumbler', 'travel mug', 'coffee cup', 'coffee mug', 'mug de voyage', 'gobelet', 'vaso térmico', 'taza de viaje', 'kaffeebecher', 'coffee-to-go', 'becher', '随行杯'],
    spec: '304 不锈钢内胆，滑盖防漏，适配多数车载杯架。外箱 50 只。',
  },
  {
    sku: 'LID-01',
    name: 'VF 系列替换杯盖',
    capacityMl: null,
    allowLogo: false,
    allowPackaging: false,
    leadTimeDays: '10-15',
    names: {
      en: 'replacement lid for VF series flasks',
      fr: 'couvercle de rechange pour bouteilles VF',
      es: 'tapa de repuesto para termos de la serie VF',
      de: 'Ersatzdeckel für Flaschen der VF-Serie',
    },
    keywords: ['lid', 'lids', 'cap', 'caps', 'replacement lid', 'replacement lids', 'spare lids', 'couvercle', 'couvercles', 'couvercles de rechange', 'bouchon', 'tapa', 'tapas', 'tapas de repuesto', 'deckel', 'ersatzdeckel', '杯盖'],
    spec: 'PP 食品级材质，适配 VF-500 / VF-750，散装每袋 100 只，不做印刷。',
  },
];

// 历史回复范例：模拟企业沉淀下来的“优秀回复”，供检索作为引用依据。
export const HISTORY = [
  {
    id: 'H-2025-031',
    title: '德国客户 VF-500 印 logo 询价',
    lang: 'en',
    text: 'For 3,000 pcs vacuum flask with one-color logo, we quoted FOB Shanghai and asked the buyer to send AI or PDF artwork and Pantone color before sampling.',
  },
  {
    id: 'H-2025-047',
    title: '法国客户未写数量，先给阶梯价',
    lang: 'fr',
    text: 'Quantité non précisée : nous avons envoyé la grille de prix par palier pour la bouteille isotherme et demandé la quantité exacte et le port de destination.',
  },
  {
    id: 'H-2025-058',
    title: '西班牙经销商杯盖配件补货',
    lang: 'es',
    text: 'Pedido de tapas de repuesto para termos, precio EXW, entrega en 15 días, embalaje a granel en bolsas de 100 unidades.',
  },
  {
    id: 'H-2026-006',
    title: '美国客户大单走负责人审批',
    lang: 'en',
    text: 'Order above USD 50,000 for tumbler and flask, CIF Los Angeles, two-color printing; price approved by manager before sending.',
  },
  {
    id: 'H-2026-012',
    title: '客户要求未持有的认证',
    lang: 'de',
    text: 'Kunde fragte nach BSCI-Audit für Thermosflasche; Antwort: LFGB-Prüfbericht verfügbar, BSCI wird separat vom Vertriebsleiter beantwortet.',
  },
];
