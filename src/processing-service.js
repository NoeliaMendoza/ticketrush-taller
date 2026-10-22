const WorkerPool = require('./worker-pool');
const { generateValidationCode } = require('./cpu-task');

const CPU_MODE = (process.env.CPU_MODE || 'main').toLowerCase();
const MAX_WORKERS = Number(process.env.MAX_WORKERS || 2);
if (!['main', 'worker'].includes(CPU_MODE)) {
  throw new Error(`Invalid CPU_MODE: ${CPU_MODE}`);
}
const workerPool = new WorkerPool(MAX_WORKERS);

async function processReservation(reservationId) {
  if (CPU_MODE === 'worker') return workerPool.execute(reservationId);
  return { ...generateValidationCode(reservationId), mode: 'MAIN', threadId: 0 };
}

function getProcessingStats() {
  return { mode: CPU_MODE, ...workerPool.getStats() };
}

module.exports = { processReservation, getProcessingStats };
