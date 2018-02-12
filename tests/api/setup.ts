import client from './client';

export const editorUser = {
  email: 'api-test-editor@grafana.com',
  login: 'api-test-editor',
  password: 'password',
  name: 'Api Test Editor',
};

export async function getUser(user) {
  let search = await client.get('/api/users/search', {
    params: { query: user.login },
  });

  if (search.data.totalCount === 1) {
    user.id = search.data.users[0].id;
    return user;
  }

  return client.post('/api/admin/users', user).then(rsp => {
    user.id = rsp.data.id;
    return user;
  });
}
