import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInquiry, parseNumber, detectLanguage } from '../src/core/parser.js';
import { RULES } from '../src/data/rules.js';
import { PRODUCTS } from '../src/data/catalog.js';
import { SAMPLE_INQUIRIES } from '../src/data/inquiries.js';

const ctx = { products: PRODUCTS, rules: RULES };
const parse = (text) => parseInquiry(text, ctx).fields;
const sample = (id) => SAMPLE_INQUIRIES.find((q) => q.id === id).text;

test('数量写法：千分位、欧式点号、空格、k、标签', () => {
  assert.equal(parseNumber('5,000'), 5000);
  assert.equal(parseNumber('5.000'), 5000);
  assert.equal(parseNumber('5 000'), 5000);
  assert.equal(parseNumber('5k'), 5000);
  assert.equal(parseNumber('1.5k'), 1500);
  assert.equal(parse('Quantity: 1200, vacuum flask 500ml').quantity, 1200);
  assert.equal(parse('Nous voulons 5 000 pièces de bouteille isotherme').quantity, 5000);
  assert.equal(parse('Quisiéramos precio para 4.000 termos de 500 ml').quantity, 4000);
  assert.equal(parse('we need it within 15 days, 500 ml flask').quantity, null);
});

test('语言识别', () => {
  assert.equal(detectLanguage(sample('Q-1009-01')), 'en');
  assert.equal(detectLanguage(sample('Q-1009-02')), 'fr');
  assert.equal(detectLanguage(sample('Q-1008-07')), 'es');
  assert.equal(detectLanguage(sample('Q-1009-04')), 'de');
});

test('Hamburg：英文询盘字段齐全', () => {
  const f = parse(sample('Q-1009-01'));
  assert.equal(f.productSku, 'VF-500');
  assert.equal(f.quantity, 5000);
  assert.equal(f.incoterm, 'FOB');
  assert.equal(f.loadingPort, 'Shanghai');
  assert.equal(f.destinationPort, 'Hamburg');
  assert.equal(f.logo, 'silk1');
  assert.equal(f.packaging, 'color');
  assert.equal(f.buyerName, 'Jonas Weber');
  assert.equal(f.company, 'Weber Haushaltswaren GmbH');
  assert.equal(f.leadTimeAsked, true);
});

test('Lyon：法语，没写数量，欧元，激光雕刻，要 LFGB', () => {
  const f = parse(sample('Q-1009-02'));
  assert.equal(f.language, 'fr');
  assert.equal(f.productSku, 'VF-750');
  assert.equal(f.quantity, null);
  assert.equal(f.incoterm, 'CIF');
  assert.equal(f.destinationPort, 'Le Havre');
  assert.equal(f.currency, 'EUR');
  assert.equal(f.logo, 'laser');
  assert.deepEqual(f.certsRequested, ['LFGB']);
  assert.equal(f.buyerName, 'Claire Martin');
});

test('Chicago：双色丝印、白盒、CIF Los Angeles', () => {
  const f = parse(sample('Q-1009-03'));
  assert.equal(f.productSku, 'TB-600');
  assert.equal(f.quantity, 20000);
  assert.equal(f.logo, 'silk2');
  assert.equal(f.packaging, 'white');
  assert.equal(f.destinationPort, 'Los Angeles');
  assert.deepEqual(f.certsRequested, ['FDA']);
});

test('Rotterdam：德语，2.000 Stück，FOB Ningbo，BSCI', () => {
  const f = parse(sample('Q-1009-04'));
  assert.equal(f.productSku, 'VF-750');
  assert.equal(f.quantity, 2000);
  assert.equal(f.loadingPort, 'Ningbo');
  assert.equal(f.logo, 'silk1');
  assert.deepEqual(f.certsRequested, ['BSCI']);
  assert.equal(f.buyerName, 'Sanne de Vries');
});

test('Madrid：西语，杯盖配件，EXW，签名里的电话不当作姓名', () => {
  const f = parse(sample('Q-1008-07'));
  assert.equal(f.productSku, 'LID-01');
  assert.equal(f.quantity, 3000);
  assert.equal(f.incoterm, 'EXW');
  assert.equal(f.buyerName, 'Lucía Gómez');
  assert.equal(f.company, 'Hogar Gómez S.L.');
});

test('抽取依据指向原文中的真实位置', () => {
  const text = sample('Q-1009-01');
  const { evidence } = parseInquiry(text, ctx);
  for (const e of Object.values(evidence)) {
    assert.equal(text.slice(e.index, e.index + e.text.length), e.text);
  }
});

test('要印 logo 但没说工艺', () => {
  assert.equal(parse('Please quote 3000 pcs 500ml flask with our logo').logo, 'unspecified');
});
