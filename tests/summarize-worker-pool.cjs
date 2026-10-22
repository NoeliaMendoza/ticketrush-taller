const fs = require('node:fs');
const path = require('node:path');
const dir = process.argv[2];
if (!dir) throw new Error('Indica la carpeta de resultados');
const read = file => {
  const bytes = fs.readFileSync(file);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf16le' : 'utf8';
  try {
    return JSON.parse(bytes.toString(encoding).replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`JSON inválido en ${file}: ${error.message}`);
  }
};
const rows = ['workers,repetition,wall_seconds,ping_rps,cpu_rps,ping_p95_ms,ping_max_ms,cpu_p95_ms,cpu_max_ms,cpu_error_rate,dropped_iterations,exit_code'];
for (const file of fs.readdirSync(dir).filter(f => /^workers-\d+-repeat-\d+\.json$/.test(f)).sort()) {
  const m = read(path.join(dir, file)).metrics;
  const meta = read(path.join(dir, file.replace('.json', '-meta.json')));
  const v = name => m[name]?.values || m[name] || {};
  rows.push([meta.maxWorkers, meta.repetition, meta.wallSeconds, v('ping_requests').rate,
    v('cpu_requests').rate, v('ping_duration')['p(95)'], v('ping_duration').max,
    v('cpu_duration')['p(95)'], v('cpu_duration').max, v('cpu_errors').value ?? v('cpu_errors').rate,
    v('dropped_iterations').count || 0, meta.exitCode].join(','));
}
fs.writeFileSync(path.join(dir, 'comparison.csv'), rows.join('\n') + '\n');
console.log(rows.join('\n'));

