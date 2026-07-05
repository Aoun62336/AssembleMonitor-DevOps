import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 5,
    duration: '30s',
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
    const res = http.get(`${BASE_URL}/api/health`);

    check(res, {
        'health status is 200': (r) => r.status === 200,
        'health response is fast': (r) => r.timings.duration < 500,
    });

    sleep(1);
}