
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = 'http://localhost:30081';

const approvedReservations = new Counter('approved_reservations');
const rejectedReservations = new Counter('rejected_reservations');
const unexpectedResponses = new Counter('unexpected_responses');

export const options = {
  scenarios: {
    reservations: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '2m',
    },
  },
};

export default function () {
  const response = http.post(`${BASE_URL}/reserve`, null, {
    responseCallback: http.expectedStatuses(201, 409),
  });

  let data;

  try {
    data = response.json();
  } catch {
    data = {};
  }

  console.log(
    `VU: ${__VU} | Pod: ${data.hostname ?? 'desconocido'} | ` +
    `Resultado: ${data.success ? 'APROBADA' : 'RECHAZADA'}`
  );

  if (response.status === 201 && data.success === true) {
    approvedReservations.add(1);
  } else if (response.status === 409 && data.success === false) {
    rejectedReservations.add(1);
  } else {
    unexpectedResponses.add(1);
  }

  check(response, {
    'La respuesta es 201 o 409':
      (res) => [201, 409].includes(res.status),

    'La respuesta contiene el hostname':
      () => typeof data.hostname === 'string',

    'La respuesta contiene los cupos disponibles':
      () => Number.isInteger(data.available),

    'Los cupos no son negativos':
      () => Number.isInteger(data.available) && data.available >= 0,
  });
}
