import client from '../client';

describe('Get current authed user', () => {
  it('should', () => {
    return client.get('/api/user').then(res => {
      expect(res.data.login).toBe('admin2');
    });
  });
});
