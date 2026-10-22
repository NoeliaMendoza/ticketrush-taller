const fs = require('node:fs');
const file = process.argv[2];
if (!file) throw new Error('Indica el archivo workers-live.jsonl');
const pods = new Map();
let errors = 0;
for (const line of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)) {
  const s = JSON.parse(line);
  if (s.error) { errors++; continue; }
  if (![s.activeWorkers,s.maxWorkers,s.queuedTasks].every(Number.isInteger)) throw new Error('Muestra inválida');
  const p = pods.get(s.hostname) || { pod:s.hostname, samples:0, maxActive:0, maxQueue:0, violations:0, limits:[] };
  p.samples++;
  p.maxActive=Math.max(p.maxActive,s.activeWorkers);
  p.maxQueue=Math.max(p.maxQueue,s.queuedTasks);
  p.violations+=Number(s.activeWorkers>s.maxWorkers);
  if (!p.limits.includes(s.maxWorkers)) p.limits.push(s.maxWorkers);
  pods.set(s.hostname,p);
}
console.log(JSON.stringify({pods:[...pods.values()],errors},null,2));
if (pods.size!==3 || errors || [...pods.values()].some(p=>p.violations || p.maxActive===0)) process.exitCode=1;
console.log('El muestreo solo respalda los instantes observados; maxQueue=0 no demuestra espera en cola.');
