import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  const res = http.get(`${BASE_URL}/`);

  check(res, {
    'frontend status is 200': (r) => r.status === 200,
    'frontend returns html': (r) => r.body.includes('<html') || r.body.includes('<!doctype html'),
  });

  sleep(1);
}
