import client from './client';
import * as setup from './setup';

describe('GET /api/user', () => {
  it('should return current authed user', async () => {
    let rsp = await client.get('/api/user');
    expect(rsp.data.login).toBe('admin');
  });
});

describe('PUT /api/user', () => {
  it('should update current authed user', async () => {
    const user = await setup.getUser(setup.editor);
    user.name = 'Updated via test';

    const rsp = await client.callAs(user).put('/api/user', user);
    expect(rsp.data.message).toBe('User updated');

    const updated = await client.callAs(user).get('/api/user');
    expect(updated.data.name).toBe('Updated via test');
  });
});
