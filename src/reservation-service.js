const mode = process.env.RESERVATION_MODE || 'local';

if (!['local', 'redis'].includes(mode)) {
  throw new Error(`Unsupported reservation mode: ${mode}`);
}

const service = mode === 'redis'
  ? require('./redis-reservation-service')
  : require('./local-reservation-service');

module.exports = service;
