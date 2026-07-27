import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Custom Metrics
const loginDuration = new Trend('login_duration');
const apiErrorRate = new Rate('api_error_rate');

// Test Configuration
export const options = {
  stages: [
    { duration: '30s', target: 15 }, // Ramp up to 15 users
    { duration: '1m', target: 30 },  // Ramp up to peak load (30 users)
    { duration: '2m', target: 30 },  // Sustain peak load
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    // 95% of requests must complete below 500ms, 99% below 1.5s
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    // General HTTP errors must be less than 1%
    http_req_failed: ['rate<0.01'],
    // API specific errors must be less than 2%
    api_error_rate: ['rate<0.02'],
    // Login shouldn't take longer than 2 seconds for 95% of users
    login_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL || 'admin@example.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || 'admin';

export default function () {
  // 1. Visit the Frontend
  group('Frontend Load', function () {
    const res = http.get(`${BASE_URL}/`);
    check(res, {
      'frontend status is 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1); // Think time: 1 to 3 seconds

  // 2. Check Health
  group('API Health', function () {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      'health status is 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);

  // 3. User Authentication
  let token = null;
  group('Authentication', function () {
    const payload = JSON.stringify({
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    });

    const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    loginDuration.add(res.timings.duration);
    
    if (!check(res, { 'login successful': (r) => r.status === 200 })) {
      apiErrorRate.add(1);
    } else {
      apiErrorRate.add(0);
      try {
        const body = res.json();
        token = body.access_token || body.token;
      } catch (e) {
        token = null;
      }
    }
  });

  sleep(Math.random() * 2 + 1);

  // 4. Fetch Secure Data
  if (token) {
    group('Fetch Projects', function () {
      const res = http.get(`${BASE_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!check(res, { 'projects fetched': (r) => r.status === 200 })) {
        apiErrorRate.add(1);
      } else {
        apiErrorRate.add(0);
      }
    });
  }

  // Final sleep before loop restarts
  sleep(Math.random() * 2 + 1);
}
