import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:30081';

const pingRequests = new Counter('ping_requests');
const cpuRequests = new Counter('cpu_requests');
const pingErrors = new Rate('ping_errors');
const cpuErrors = new Rate('cpu_errors');
const pingDuration = new Trend('ping_duration', true);
const cpuDuration = new Trend('cpu_duration', true);

export const options = {
  thresholds: { cpu_errors: ['rate==0'], ping_errors: ['rate==0'], checks: ['rate==1'] },
  scenarios: {
    pingTraffic: {
      executor: 'constant-vus',
      exec: 'testPing',
      vus: 20,
      duration: '30s',
    },
    cpuTraffic: {
      executor: 'constant-arrival-rate',
      exec: 'testCpu',
      rate: 3,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
};

export function setup() {
  const response = http.post(`${BASE_URL}/benchmark/cpu`, null);
  let data = {};
  try { data = response.json(); } catch (_) { /* Invalid response. */ }
  if (response.status !== 200 || data.iterations !== 200000 ||
      !['MAIN', 'WORKER'].includes(data.mode) ||
      (__ENV.EXPECTED_MODE && data.mode !== __ENV.EXPECTED_MODE.toUpperCase())) {
    throw new Error(`CPU preflight failed: HTTP ${response.status}, body=${response.body}`);
  }
  console.log(`CPU_PREFLIGHT ${JSON.stringify(data)}`);
}

export function testPing() {
  const response = http.get(`${BASE_URL}/ping`, {
    tags: { endpoint: 'ping' },
  });
  const valid = check(response, {
    'Ping responde correctamente': (res) => res.status === 200,
  });
  pingRequests.add(1);
  pingErrors.add(!valid);
  pingDuration.add(response.timings.duration);
  sleep(0.25);
}

export function testCpu() {
  const response = http.post(`${BASE_URL}/benchmark/cpu`, null, {
    tags: { endpoint: 'cpu' },
  });
  const valid = check(response, {
    'CPU responde correctamente': (res) => {
      if (res.status !== 200) return false;
      try {
        const data = res.json();
        return data.iterations === 200000 && typeof data.validationCode === 'string' &&
          ['MAIN', 'WORKER'].includes(data.mode) &&
          (!__ENV.EXPECTED_MODE || data.mode === __ENV.EXPECTED_MODE.toUpperCase());
      } catch (_) { return false; }
    },
  });
  cpuDuration.add(response.timings.duration);
  cpuRequests.add(1);
  cpuErrors.add(!valid);
}


