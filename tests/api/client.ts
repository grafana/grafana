const axios = require('axios');

export function getClient(options) {
  return axios.create({
    baseURL: 'http://localhost:3000',
    timeout: 1000,
    auth: {
      username: options.username,
      password: options.password,
    },
  });
}

export function getAdminClient() {
  return getClient({
    username: 'api-test-admin',
    password: 'password',
  });
}
