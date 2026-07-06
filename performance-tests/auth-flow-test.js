import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 3,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL;
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD;

export default function () {
  const loginPayload = JSON.stringify({
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(loginRes, {
    'login success': (r) => r.status === 200,
  });

  let token = null;

  try {
    const body = loginRes.json();
    token = body.access_token || body.token;
  } catch (e) {
    token = null;
  }

  if (token) {
    const projectsRes = http.get(`${BASE_URL}/api/projects`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    check(projectsRes, {
      'projects status is 200': (r) => r.status === 200,
    });
  }

  sleep(2);
}
