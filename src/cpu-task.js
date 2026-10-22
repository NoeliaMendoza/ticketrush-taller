const crypto = require('crypto');

const HASH_ITERATIONS = 200000;

function generateValidationCode(reservationId) {
  let hash = reservationId;

  const start = performance.now();

  for (let i = 0; i < HASH_ITERATIONS; i++) {
    hash = crypto
      .createHash('sha256')
      .update(hash)
      .digest('hex');
  }

  const duration = performance.now() - start;

  return {
    validationCode: hash.substring(0, 16).toUpperCase(),
    iterations: HASH_ITERATIONS,
    processingTime: Number(duration.toFixed(2)),
  };
}

module.exports = { generateValidationCode };
