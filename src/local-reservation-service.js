const Mutex = require('./mutex');

const TOTAL_CAPACITY = 20;
const mutex = new Mutex();

let available = TOTAL_CAPACITY;
let approved = 0;
let rejected = 0;

// Simulate an asynchronous operation
function simulateDelay() {
  return new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
}

function getStatus() {
  return {
    totalCapacity: TOTAL_CAPACITY,
    available,
    approved,
    rejected,
  };
}

async function reserve() {
  return mutex.runExclusive(async () => {
    await simulateDelay();

    if (available <= 0) {
      rejected++;

      return {
        success: false,
        message: 'No hay cupos disponibles',
        ...getStatus(),
      };
    }

    available--;
    approved++;

    return {
      success: true,
      message: 'Reserva aprobada correctamente',
      ...getStatus(),
    };
  });
}

async function reset() {
  return mutex.runExclusive(async () => {
    available = TOTAL_CAPACITY;
    approved = 0;
    rejected = 0;

    return {
      success: true,
      message: 'Reservas reiniciadas correctamente',
      ...getStatus(),
    };
  });
}

module.exports = {
  getStatus,
  reserve,
  reset,
};
