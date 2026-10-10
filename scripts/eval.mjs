// 用法：npm run eval
// 在虚构评测集上统计字段抽取准确率、产品匹配命中率、报价与规则表一致性，结果写入 docs/eval-report.md。
import { writeFileSync, mkdirSync } from 'node:fs';
import { runPipeline } from '../src/core/pipeline.js';
import { RULES } from '../src/data/rules.js';
import { PRODUCTS, HISTORY, COMPANY } from '../src/data/catalog.js';
import { EVAL_SET } from './eval-set.js';

const ctx = { rules: RULES, products: PRODUCTS, history: HISTORY, company: COMPANY };
const FIELDS = ['language', 'productSku', 'quantity', 'incoterm', 'logo', 'packaging', 'currency'];

const fieldStats = Object.fromEntries(FIELDS.map((f) => [f, { ok: 0, total: 0 }]));
let priceOk = 0;
let priceTotal = 0;
const failures = [];

for (const item of EVAL_SET) {
  const r = runPipeline({ id: item.id, text: item.text }, ctx);
  for (const f of FIELDS) {
    if (!(f in item.expected)) continue;
    fieldStats[f].total += 1;
    if (String(r.fields[f] ?? null) === String(item.expected[f])) fieldStats[f].ok += 1;
    else failures.push(`${item.id} ${f}：期望 ${item.expected[f]}，实际 ${r.fields[f] ?? null}`);
  }
  if (item.expected.unit !== undefined) {
    priceTotal += 1;
    if (r.quote.ok && Math.abs(r.quote.unit - item.expected.unit) < 0.001) priceOk += 1;
    else failures.push(`${item.id} 单价：期望 ${item.expected.unit}，实际 ${r.quote.ok ? r.quote.unit : r.quote.reason}`);
  }
}

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '-');
const totalOk = FIELDS.reduce((s, f) => s + fieldStats[f].ok, 0);
const total = FIELDS.reduce((s, f) => s + fieldStats[f].total, 0);
const date = new Date().toISOString().slice(0, 10);

const lines = [
  '# 评测记录',
  '',
  `运行日期：${date}　评测集：${EVAL_SET.length} 封虚构询盘（英、法、西、德）　解析方式：本地规则（未接入模型）`,
  '',
  '评测集里的询盘都是自己编写的，覆盖信息完整、缺数量、未写工艺、没有匹配产品、不支持的条款等情况。它只能说明本地解析器在这些写法上的表现，不代表真实询盘上的准确率。真实数据需要在企业授权、脱敏之后再测。',
  '',
  '| 指标 | 结果 |',
  '| --- | --- |',
  `| 字段抽取准确率（${FIELDS.length} 个字段合计） | ${totalOk}/${total}（${pct(totalOk, total)}） |`,
  ...FIELDS.map((f) => `| 　${f} | ${fieldStats[f].ok}/${fieldStats[f].total} |`),
  `| 产品匹配命中率 | ${fieldStats.productSku.ok}/${fieldStats.productSku.total}（${pct(fieldStats.productSku.ok, fieldStats.productSku.total)}） |`,
  `| 报价与规则表一致性（与手工核算单价对比） | ${priceOk}/${priceTotal}（${pct(priceOk, priceTotal)}） |`,
  '',
  failures.length ? '未通过的项：' : '本次没有未通过的项。',
  ...failures.map((f) => `- ${f}`),
  '',
  '人工修改率、首次回复耗时这两项需要真实使用记录，演示阶段无法统计。',
  '',
];

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/eval-report.md', import.meta.url), lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
process.exitCode = failures.length ? 1 : 0;
