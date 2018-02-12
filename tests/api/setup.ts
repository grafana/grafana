import chalk from 'chalk';
import { getAdminClient } from './client';

class Step {
  constructor(public name, public fn) {}
}

class SetupManager {
  private steps = [];
  private index = 0;

  addStep(name, fn) {
    this.steps.push(new Step(name, fn));
  }

  handleError(err) {
    process.stdout.write(chalk.red(' ERROR'));
    console.log('\n');

    if (err.response && err.response.data) {
      console.log('\t' + err.response.data.message || err.response.data.error);
      console.log('');
    } else {
      console.log('Error', err);
    }
  }

  start() {
    this.index = -1;
    this.runNext();
  }

  runNext() {
    this.index += 1;

    if (this.index === this.steps.length) {
      console.log('\nAll steps executed');
      return Promise.resolve(true);
    }

    let step = this.steps[this.index];

    process.stdout.write('\nRunning: ' + step.name + ':  ');

    return step
      .fn()
      .then(res => {
        process.stdout.write(chalk.green(res));
      })
      .then(this.runNext.bind(this))
      .catch(this.handleError.bind(this));
  }
}

const adminClient = getAdminClient();

let setup = new SetupManager();

setup.addStep('Create user viewer', async () => {
  let search = await adminClient.get('/api/users/search', { params: { query: 'api-test-viewer' } });

  if (search.data.totalCount === 1) {
    return 'SKIP';
  }

  return adminClient
    .post('/api/admin/users', {
      email: 'api-test-viewer@grafana.com',
      login: 'api-test-viewer',
      password: 'password',
      name: 'Api Test Viewer',
    })
    .then(function(response) {
      return 'OK';
    });
});

setup.addStep('Create user editor', async () => {
  let search = await adminClient.get('/api/users/search', { params: { query: 'api-test-editor' } });

  if (search.data.totalCount === 1) {
    return 'SKIP';
  }

  return adminClient
    .post('/api/admin/users', {
      email: 'api-test-editor@grafana.com',
      login: 'api-test-editor',
      password: 'password',
      name: 'Api Test Editor',
    })
    .then(function(response) {
      return 'OK';
    });
});

setup.start();
