// 评测集：全部为虚构询盘，用来量化解析与报价的准确性。
// expected 中只写需要检查的字段；unit 为按规则表手工核算的单价。
export const EVAL_SET = [
  {
    id: 'E01',
    text: 'Hello, please quote 5,000 pcs of 500ml vacuum flask VF-500, one color logo, color gift box, FOB Shanghai. Best regards, Tom',
    expected: { language: 'en', productSku: 'VF-500', quantity: 5000, incoterm: 'FOB', logo: 'silk1', packaging: 'color', currency: 'USD', unit: 3.85 },
  },
  {
    id: 'E02',
    text: 'Hi, we need 12k pcs of the 750 ml insulated bottle, laser engraved logo, CIF Rotterdam. Thanks',
    expected: { language: 'en', productSku: 'VF-750', quantity: 12000, incoterm: 'CIF', logo: 'laser', packaging: 'none', currency: 'USD', unit: 4.29 },
  },
  {
    id: 'E03',
    text: 'Bonjour, merci de nous faire une offre pour 3 000 pièces de bouteille isotherme 500 ml, impression une couleur, boîte cadeau, FOB Shanghai, prix en euros. Cordialement',
    expected: { language: 'fr', productSku: 'VF-500', quantity: 3000, incoterm: 'FOB', logo: 'silk1', packaging: 'color', currency: 'EUR', unit: 3.85 },
  },
  {
    id: 'E04',
    text: 'Bonjour, nous cherchons un mug de voyage 600 ml avec notre logo. Quel est votre meilleur prix ? Merci',
    expected: { language: 'fr', productSku: 'TB-600', quantity: null, incoterm: null, logo: 'unspecified', packaging: 'none', currency: 'USD' },
  },
  {
    id: 'E05',
    text: 'Hola, necesitamos 10.000 unidades de vaso térmico de viaje de 600 ml, logo a dos colores, caja blanca, precio FOB Ningbo. Saludos',
    expected: { language: 'es', productSku: 'TB-600', quantity: 10000, incoterm: 'FOB', logo: 'silk2', packaging: 'white', currency: 'USD', unit: 3.35 },
  },
  {
    id: 'E06',
    text: 'Buenos días, quisiéramos precio para 2.500 tapas de repuesto para la serie VF, EXW. Un saludo',
    expected: { language: 'es', productSku: 'LID-01', quantity: 2500, incoterm: 'EXW', logo: 'none', packaging: 'none', currency: 'USD', unit: 0.54 },
  },
  {
    id: 'E07',
    text: 'Guten Tag, bitte ein Angebot für 6.000 Stück Thermosflasche 500 ml, Lasergravur, Geschenkbox, CIF Hamburg. Mit freundlichen Grüßen',
    expected: { language: 'de', productSku: 'VF-500', quantity: 6000, incoterm: 'CIF', logo: 'laser', packaging: 'color', currency: 'USD', unit: 4.13 },
  },
  {
    id: 'E08',
    text: 'Guten Tag, wir suchen Kaffeebecher 600 ml, zweifarbig bedruckt, Preis in Euro, FOB Shanghai. Menge: 4000. Viele Grüße',
    expected: { language: 'de', productSku: 'TB-600', quantity: 4000, incoterm: 'FOB', logo: 'silk2', packaging: 'none', currency: 'EUR', unit: 3.47 },
  },
  {
    id: 'E09',
    text: 'Hi, can you quote 800 pcs of tumbler 600ml, white box, EXW? Regards',
    expected: { language: 'en', productSku: 'TB-600', quantity: 800, incoterm: 'EXW', logo: 'none', packaging: 'white', currency: 'USD', unit: 3.68 },
  },
  {
    id: 'E10',
    text: 'Dear sales, we are interested in your water bottles. Please send catalog and price list. Thanks',
    expected: { language: 'en', productSku: null, quantity: null, incoterm: null, logo: 'none', packaging: 'none', currency: 'USD' },
  },
  {
    id: 'E11',
    text: 'Hello, quote 20,000 pcs 500ml thermos with our logo printed, DDP Los Angeles please.',
    expected: { language: 'en', productSku: 'VF-500', quantity: 20000, incoterm: 'DDP', logo: 'unspecified', packaging: 'none', currency: 'USD' },
  },
  {
    id: 'E12',
    text: 'Hello, please quote 3000 pcs of 750ml flask, 1 colour logo, CFR Felixstowe. We also need BSCI audit report. Kind regards',
    expected: { language: 'en', productSku: 'VF-750', quantity: 3000, incoterm: 'CFR', logo: 'silk1', packaging: 'none', currency: 'USD', unit: 4.69 },
  },
];
