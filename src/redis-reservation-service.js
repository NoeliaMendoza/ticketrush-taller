const { getRedis } = require('./redis-client');

const TOTAL_CAPACITY = 20;

const KEYS = [
  'ticket-rush:available',
  'ticket-rush:approved',
  'ticket-rush:rejected',
];

const initializeScript = `
  if redis.call('EXISTS', KEYS[1]) == 0 then
    redis.call('SET', KEYS[1], ARGV[1])
    redis.call('SET', KEYS[2], 0)
    redis.call('SET', KEYS[3], 0)
  end
`;

const reserveScript = `
  if redis.call('EXISTS', KEYS[1]) == 0 then
    redis.call('SET', KEYS[1], ARGV[1])
    redis.call('SET', KEYS[2], 0)
    redis.call('SET', KEYS[3], 0)
  end

  local available = tonumber(redis.call('GET', KEYS[1]))

  if available <= 0 then
    redis.call('INCR', KEYS[3])
    return 0
  end

  redis.call('DECR', KEYS[1])
  redis.call('INCR', KEYS[2])

  return 1
`;

const statusScript = `
  if redis.call('EXISTS', KEYS[1]) == 0 then
    redis.call('SET', KEYS[1], ARGV[1])
    redis.call('SET', KEYS[2], 0)
    redis.call('SET', KEYS[3], 0)
  end

  return {
    redis.call('GET', KEYS[1]),
    redis.call('GET', KEYS[2]),
    redis.call('GET', KEYS[3])
  }
`;

const resetScript = `
  redis.call('SET', KEYS[1], ARGV[1])
  redis.call('SET', KEYS[2], 0)
  redis.call('SET', KEYS[3], 0)
  return 1
`;

async function getStatus() {
  const redis = await getRedis();

  const values = await redis.eval(statusScript, {
    keys: KEYS,
    arguments: [String(TOTAL_CAPACITY)],
  });

  return {
    totalCapacity: TOTAL_CAPACITY,
    available: Number(values[0]),
    approved: Number(values[1]),
    rejected: Number(values[2]),
  };
}

async function reserve() {
  const redis = await getRedis();

  const result = await redis.eval(reserveScript, {
    keys: KEYS,
    arguments: [String(TOTAL_CAPACITY)],
  });

  return {
    success: Number(result) === 1,
    message: Number(result) === 1
      ? 'Reserva aprobada correctamente'
      : 'No hay cupos disponibles',
    ...await getStatus(),
  };
}

async function reset() {
  const redis = await getRedis();

  await redis.eval(resetScript, {
    keys: KEYS,
    arguments: [String(TOTAL_CAPACITY)],
  });

  return {
    success: true,
    message: 'Reservas reiniciadas correctamente',
    ...await getStatus(),
  };
}

module.exports = {
  getStatus,
  reserve,
  reset,
};
