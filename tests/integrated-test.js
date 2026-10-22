import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:30081').replace(/\/$/, '');
const approved = new Counter('approved_reservations');
const rejected = new Counter('rejected_reservations');
const unexpected = new Counter('unexpected_responses');
const workerTasks = new Counter('worker_tasks');
const pingDuration = new Trend('ping_duration', true);

export const options = {
  scenarios: {
    reservations: {
      executor: 'per-vu-iterations', exec: 'testReservation',
      vus: 100, iterations: 1, maxDuration: '2m',
    },
    pingTraffic: {
      executor: 'constant-vus', exec: 'testPing', vus: 20, duration: '30s',
    },
  },
  thresholds: {
    unexpected_responses: ['count==0'],
    approved_reservations: ['count==20'],
    rejected_reservations: ['count==80'],
    worker_tasks: ['count==20'],
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
  },
};

export function setup() {
  const response = http.get(`${BASE_URL}/status`);
  let data;
  try { data = response.json(); } catch (_) { throw new Error('Estado inicial inválido'); }
  if (response.status !== 200 || data.available !== 20 || data.approved !== 0 || data.rejected !== 0) {
    throw new Error('Ejecuta POST /reset antes de la prueba y detén otros clientes de reservas');
  }
  console.log(`INITIAL_STATUS ${JSON.stringify(data)}`);
}

export function testReservation() {
  approved.add(0);
  rejected.add(0);
  unexpected.add(0);
  workerTasks.add(0);
  const response = http.post(`${BASE_URL}/reserve`, null, {
    responseCallback: http.expectedStatuses(201, 409),
    tags: { endpoint: 'reserve' },
    timeout: '120s',
  });
  let data = {};
  try { data = response.json(); } catch (_) { /* Se registra como inesperada. */ }
  const isApproved = response.status === 201 && data.success === true;
  const isRejected = response.status === 409 && data.success === false;
  if (isApproved) {
    approved.add(1);
    if (data.processing?.mode === 'WORKER') workerTasks.add(1);
  } else if (isRejected) rejected.add(1);
  else unexpected.add(1);

  check(response, {
    'Reserva: respuesta válida': () => isApproved || isRejected,
    'Reserva: hostname presente': () => typeof data.hostname === 'string' && data.hostname.length > 0,
    'Reserva: cupos no negativos': () => Number.isInteger(data.available) && data.available >= 0,
    'Reserva aprobada procesada en Worker': () => !isApproved ||
      (data.processing?.mode === 'WORKER' && Number.isInteger(data.processing.threadId) && data.processing.threadId > 0),
  });
  console.log(`VU=${__VU} | Pod=${data.hostname || 'N/A'} | HTTP=${response.status} | Resultado=${isApproved ? 'APROBADA' : isRejected ? 'RECHAZADA' : 'INESPERADA'} | Modo=${data.processing?.mode || 'N/A'}`);
}

export function testPing() {
  const response = http.get(`${BASE_URL}/ping`, { tags: { endpoint: 'ping' } });
  check(response, { 'Ping responde 200': (res) => res.status === 200 });
  pingDuration.add(response.timings.duration);
  sleep(0.25);
}

export function teardown() {
  const response = http.get(`${BASE_URL}/status`);
  let data = {};
  try { data = response.json(); } catch (_) { /* El check final falla. */ }
  check(response, {
    'Estado final: 0 disponibles, 20 aprobadas, 80 rechazadas': (res) =>
      res.status === 200 && data.available === 0 && data.approved === 20 && data.rejected === 80,
  });
  console.log(`FINAL_STATUS ${JSON.stringify(data)}`);
}
