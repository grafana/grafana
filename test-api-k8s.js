import http from 'k6/http';

export const options = {
  vus: 50,
  duration: '30s',
};

export default function () {
  const headers = { 'Content-Type': 'application/json', Authentication: `Bearer ${__ENV.TOKEN}` };
  http.get('http://localhost:3000/apis/example.grafana.app/v0alpha1/namespaces/default/dummy/test1/sub', { headers });
}
