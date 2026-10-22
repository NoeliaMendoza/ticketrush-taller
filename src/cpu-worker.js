const {
  parentPort,
  workerData,
  threadId,
} = require('worker_threads');

const { generateValidationCode } = require('./cpu-task');

try {
  const result = generateValidationCode(
    workerData.reservationId
  );

  parentPort.postMessage({
    ...result,
    threadId,
    mode: 'WORKER',
  });
} catch (error) {
  parentPort.postMessage({
    error: error.message,
  });
}
