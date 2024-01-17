import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 2000 }, // fast ramp-up to a high point
    { duration: '1m', target: 0 }, // quick ramp-down to 0 users
  ],
};

export default function () {
  const headers = { 'Content-Type': 'application/json', Authentication: `Bearer ${__ENV.TOKEN}` };
  http.get('http://localhost:3000/apis/example.grafana.app/v0alpha1/namespaces/default/dummy/test1/sub', { headers });
}
