const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { CliError, helpText } = require('../cli/cli');
const { logger } = require('../logger/logger');

const { PrReportsPipeline } = require('./PrReportsPipeline');
const { ReportOutput } = require('./io/ReportOutput');
const { PullRequestNormalizer } = require('./normalizer/PullRequestNormalizer');
const { PullRequestPresenter } = require('./presenter/PullRequestPresenter');

const { configFor, sortByContributorRank } = PrReportsPipeline;
const NOW = new Date('2026-09-16T10:11:12Z');
const CONFIG = configFor('o/n', 'o/squad');

function pr(number, authorType) {
  return { number, authorType };
}

test('configFor: bare team slug defaults the org', () => {
  const cfg = configFor('grafana/grafana', 'dashboards-squad');
  assert.equal(cfg.owner, 'grafana');
  assert.equal(cfg.name, 'grafana');
  assert.equal(cfg.repo, 'grafana/grafana');
  assert.equal(cfg.teamOrg, 'grafana');
  assert.equal(cfg.teamSlug, 'dashboards-squad');
  assert.equal(cfg.team, 'grafana/dashboards-squad');
});

test('configFor: explicit team org wins', () => {
  const cfg = configFor('a/b', 'x/y');
  assert.equal(cfg.teamOrg, 'x');
  assert.equal(cfg.teamSlug, 'y');
  assert.equal(cfg.team, 'x/y');
});

test('configFor: trims surrounding whitespace', () => {
  const cfg = configFor('  a/b  ', '  x/y  ');
  assert.equal(cfg.repo, 'a/b');
  assert.equal(cfg.team, 'x/y');
});

test('configFor: cache keys and file names are namespaced by repo and team', () => {
  const cfg = configFor('a/b', 'x/y');
  assert.equal(cfg.cacheKey, 'a%2Fb@x%2Fy');
  assert.equal(path.basename(cfg.outputPath), 'open-prs@a%2Fb@x%2Fy.md');
});

test('configFor: members cache key is keyed by team only', () => {
  const cfg = configFor('a/b', 'x/y');
  assert.equal(cfg.membersCacheKey, 'members@x%2Fy');
  assert.equal(cfg.membersCacheKey, configFor('other/repo', 'x/y').membersCacheKey);
});

test('configFor: output and cache folders are separated by data type', () => {
  const dataRoot = path.resolve(__dirname, '..');
  const cfg = configFor('a/b', 'x/y');
  assert.equal(cfg.root, dataRoot);
  assert.equal(path.dirname(cfg.outputPath), path.join(dataRoot, 'output', 'reports'));
  assert.equal(cfg.prsCacheDir, path.join(dataRoot, 'output', 'cache', 'prs'));
  assert.equal(cfg.membersCacheDir, path.join(dataRoot, 'output', 'cache', 'teams'));
});

test('configFor: dots and dashes are valid name characters', () => {
  const cfg = configFor('my-org/my.repo', 'a-team');
  assert.equal(cfg.repo, 'my-org/my.repo');
  assert.equal(cfg.teamSlug, 'a-team');
});

test('configFor: invalid repo throws', () => {
  for (const value of ['', undefined, 'grafana', 'a/b/c', 'a b/c', '/b', 'a/']) {
    assert.throws(() => configFor(value, 'x/y'), CliError, `expected throw for ${value}`);
  }
});

test('configFor: invalid team throws', () => {
  for (const value of ['', undefined, 'a/b/c', 'a b']) {
    assert.throws(() => configFor('a/b', value), CliError, `expected throw for ${value}`);
  }
});

test('helpText: the documented output file name matches the one configFor builds', () => {
  const documented = helpText().match(/output\/reports\/(\S+)\.md/)[1];
  const actual = path.basename(configFor('a/b', 'x/y').outputPath, '.md');

  assert.equal(documented.replace('<encoded-repo>', 'a%2Fb').replace('<encoded-team>', 'x%2Fy'), actual);
});

test('sortByContributorRank: first-timers come before contributors, then members', () => {
  const prs = [pr(1, 'MEMBER'), pr(2, 'CONTRIBUTOR'), pr(3, 'FIRST_TIME_CONTRIBUTOR')];

  sortByContributorRank(prs);

  assert.deepEqual(
    prs.map((row) => row.number),
    [3, 2, 1]
  );
});

test('sortByContributorRank: an unknown association sorts last', () => {
  const prs = [pr(1, 'COLLABORATOR'), pr(2, 'MEMBER')];

  sortByContributorRank(prs);

  assert.deepEqual(
    prs.map((row) => row.number),
    [2, 1]
  );
});

test('sortByContributorRank: within a rank the newest PR comes first', () => {
  const prs = [pr(10, 'MEMBER'), pr(30, 'MEMBER'), pr(20, 'MEMBER')];

  sortByContributorRank(prs);

  assert.deepEqual(
    prs.map((row) => row.number),
    [30, 20, 10]
  );
});

test('sortByContributorRank: the caller sees its own array reordered', () => {
  const prs = [pr(1, 'MEMBER'), pr(2, 'FIRST_TIME_CONTRIBUTOR')];

  assert.equal(sortByContributorRank(prs), undefined);
  assert.equal(prs[0].number, 2);
});

function node(number, overrides = {}) {
  return {
    number,
    title: `PR ${number}`,
    url: `https://github.com/o/n/pull/${number}`,
    authorAssociation: 'MEMBER',
    mergeable: 'MERGEABLE',
    updatedAt: '2026-09-16T09:11:12Z',
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
    ...overrides,
  };
}

function pipelineWith(services = {}) {
  return new PrReportsPipeline({
    normalizer: new PullRequestNormalizer({ teamOrg: 'o' }),
    presenter: new PullRequestPresenter(),
    output: new ReportOutput(),
    ...services,
  });
}

function queueApi(overrides = {}) {
  return {
    fetchTeamMembers: async () => ['alice', 'bob'],
    fetchTeamReviewRequestedPrs: async () => [],
    fetchAuthoredPrs: async () => [],
    fetchReviewRequestedPrs: async () => [],
    fetchPullRequestDetails: async (numbers, readinessNumbers = []) => readinessNumbers.map((number) => node(number)),

    ...overrides,
  };
}

function captureOutput(t) {
  let text = '';
  t.mock.method(logger, 'log', () => {});
  const read = () => text;
  read.service = new ReportOutput({
    stdout: {
      write: (chunk) => {
        text += chunk;
      },
    },
  });
  return read;
}

async function temporaryConfig(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pr-pipeline-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return {
    ...CONFIG,
    root,
    prsCacheDir: path.join(root, 'cache', 'prs'),
    membersCacheDir: path.join(root, 'cache', 'teams'),
    outputPath: path.join(root, 'output', 'reports', 'queue.md'),
  };
}

test('collectScope: combines overlapping searches and keeps the newest timestamp per PR', async () => {
  const queries = [];
  const pipeline = pipelineWith({
    api: queueApi({
      fetchTeamMembers: async () => ['alice', 'bob', 'alice'],
      fetchTeamReviewRequestedPrs: async () => [{ number: 7, updatedAt: '2026-09-15' }],
      fetchAuthoredPrs: async (logins) => {
        queries.push(logins);
        return [{ number: 7, updatedAt: '2026-09-17' }, { number: 8 }];
      },
      fetchReviewRequestedPrs: async (logins) => {
        queries.push(logins);
        return [
          { number: 7, updatedAt: '2026-09-16' },
          { number: 9, updatedAt: '2026-09-14' },
        ];
      },
    }),
  });

  assert.deepEqual(await pipeline.collectScope(), {
    members: new Set(['alice', 'bob']),
    createdByTeamMembers: new Set([7, 8]),
    reviewRequests: { fromTeam: new Set([7]), fromIndividualMember: new Set([7, 9]) },
    relevant: new Set([7, 8, 9]),
    updatedAt: new Map([
      [7, '2026-09-17'],
      [9, '2026-09-14'],
    ]),
  });
  assert.deepEqual(queries, [
    ['alice', 'bob'],
    ['alice', 'bob'],
  ]);
});

test('fetch: prunes irrelevant rows, refreshes readiness and refetches changed details', async (t) => {
  t.mock.method(logger, 'log', () => {});
  const row = (number, overrides = {}) => ({
    number,
    updatedAt: 'same',
    changedFiles: 0,
    churn: { additions: 0, deletions: 0, total: 0 },
    sizeFromChurn: 'size/small',
    mergeable: 'MERGEABLE',
    ciStatus: 'SUCCESS',
    ...overrides,
  });
  const cached = {
    prs: {
      1: row(1),
      2: row(2, { updatedAt: 'old', ciStatus: 'PENDING' }),
      3: row(3, { ciStatus: 'PENDING' }),
      4: row(4, { mergeable: 'UNKNOWN' }),
      5: row(5, { updatedAt: 'old', title: 'Kept when details are missing' }),
      99: row(99),
    },
  };
  const before = structuredClone(cached);
  const asked = [];
  const readinessAsked = [];
  const pipeline = pipelineWith({
    cache: {
      read: async (key) => {
        assert.equal(key, CONFIG.cacheKey);
        return cached;
      },
    },
    api: queueApi({
      fetchAuthoredPrs: async () => [1, 2, 3, 4, 5, 6].map((number) => ({ number, updatedAt: 'same' })),
      fetchPullRequestDetails: async (numbers, readinessNumbers) => {
        asked.push(...numbers);
        readinessAsked.push(...readinessNumbers);
        return [
          node(2),
          node(6, { commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] } }),
          ...readinessNumbers.map((number) => node(number)),
        ];
      },
    }),
  });

  const fetched = await pipeline.fetch(CONFIG, {});

  assert.deepEqual(asked, [2, 5, 6]);
  assert.deepEqual(readinessAsked, [1, 3, 4]);
  assert.deepEqual(
    fetched.entries.map(({ cached }) => cached.number),
    [1, 2, 3, 4, 5, 6]
  );
  assert.deepEqual([fetched.added, fetched.removed, fetched.refetched, fetched.reused], [1, 1, 2, 3]);
  const normalized = pipeline.normalize(fetched);
  assert.deepEqual(normalized.prs[0], { ...cached.prs[1], status: '' });
  assert.strictEqual(normalized.prs[4], cached.prs[5]);
  assert.deepEqual(cached, before);
});

test('fetch: fills missing diff counts in otherwise fresh cache records and then reuses them', async () => {
  for (const counts of [{}, { additions: 0 }, { deletions: 0 }]) {
    const cached = {
      number: 7,
      updatedAt: 'same',
      ciStatus: 'SUCCESS',
      mergeable: 'MERGEABLE',
      changedFiles: 0,
      churn: counts,
    };
    const requested = [];
    const pipeline = pipelineWith({
      cache: { read: async () => ({ prs: { 7: cached } }) },
      api: queueApi({
        fetchAuthoredPrs: async () => [{ number: 7, updatedAt: 'same' }],
        fetchPullRequestDetails: async (numbers, readinessNumbers) => {
          requested.push(...numbers);
          return readinessNumbers.map((number) => node(number));
        },
      }),
    });
    await pipeline.fetch(CONFIG, {});
    assert.deepEqual(requested, [7]);
    cached.churn = { additions: 0, deletions: 0, total: 0 };
    cached.sizeFromChurn = 'size/small';
    requested.length = 0;
    const next = await pipeline.fetch(CONFIG, {});
    assert.deepEqual(requested, []);
    assert.equal(next.reused, 1);
  }
});

test('fetch: upgrades legacy diff metadata and reuses the normalized cache on the next run', async () => {
  for (const legacy of [
    { changedFiles: undefined },
    { churn: { additions: 0, deletions: 0 } },
    { sizeFromChurn: undefined },
    { churn: { additions: 0, deletions: 0, size: 'size/small' } },
    { size: 'size/S' },
  ]) {
    let cached = {
      number: 7,
      updatedAt: 'same',
      ciStatus: 'SUCCESS',
      mergeable: 'MERGEABLE',
      changedFiles: 0,
      churn: { additions: 0, deletions: 0, total: 0 },
      sizeFromChurn: 'size/small',
      ...legacy,
    };
    const requested = [];
    const pipeline = pipelineWith({
      cache: { read: async () => ({ prs: { 7: cached } }) },
      api: queueApi({
        fetchAuthoredPrs: async () => [{ number: 7, updatedAt: 'same' }],
        fetchPullRequestDetails: async (numbers, readinessNumbers) => {
          requested.push(...numbers);
          return [...numbers, ...readinessNumbers].map((number) =>
            node(number, {
              updatedAt: 'same',
              changedFiles: 0,
              additions: 0,
              deletions: 0,
              labels: { nodes: [{ name: 'size/S' }] },
            })
          );
        },
      }),
    });
    cached = pipeline.normalize(await pipeline.fetch(CONFIG, {})).prs[0];
    assert.deepEqual(requested, [7]);
    assert.equal(cached.changedFiles, 0);
    assert.equal(cached.churn.total, 0);
    assert.equal(cached.sizeFromChurn, 'size/small');
    assert.equal(Object.hasOwn(cached.churn, 'size'), false);
    assert.equal(cached.sizeFromLabels, 'size/S');
    assert.equal(Object.hasOwn(cached, 'size'), false);
    requested.length = 0;
    assert.equal((await pipeline.fetch(CONFIG, {})).reused, 1);
    assert.deepEqual(requested, []);
  }
});

test('fetch: an empty queue and a missing cache produce an empty run', async () => {
  const pipeline = pipelineWith({ api: queueApi(), cache: { read: async () => null } });
  const fetched = await pipeline.fetch(CONFIG, {});
  assert.deepEqual(fetched.entries, []);
  assert.deepEqual([fetched.added, fetched.removed, fetched.refetched, fetched.reused], [0, 0, 0, 0]);
  assert.deepEqual(pipeline.normalize(fetched).prs, []);
});

test('normalize: refreshes fetched rows and preserves reused rows', () => {
  const cached = { number: 7, title: 'Cached', ciStatus: 'SUCCESS' };
  const reused = { number: 8, ciStatus: 'FAILURE' };
  const before = structuredClone([cached, reused]);
  const pipeline = pipelineWith();
  const normalized = pipeline.normalize({
    single: false,
    entries: [
      { node: node(7, { commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] } }), cached },
      { cached: reused },
    ],
  });
  assert.equal(normalized.prs[0].ciStatus, 'FAILURE');
  assert.strictEqual(normalized.prs[1], reused);
  assert.deepEqual([cached, reused], before);
  assert.equal('entries' in normalized, false);
});

test('present: sorts a copy, keeps raw cache records and uses one timestamp for every age', () => {
  const prs = [
    { number: 8, authorType: 'MEMBER', createdAt: '2026-09-13T10:11:12Z', updatedAt: '2026-09-16T09:11:12Z' },
    {
      number: 7,
      authorType: 'FIRST_TIME_CONTRIBUTOR',
      createdAt: '2026-09-13T10:11:12Z',
      updatedAt: '2026-09-16T09:11:12Z',
    },
  ];
  const before = structuredClone(prs);
  const report = pipelineWith().present({ prs }, NOW);
  assert.deepEqual(prs, before);
  assert.deepEqual(
    report.prs.map((pr) => pr.number),
    [7, 8]
  );
  assert.deepEqual(
    report.prs.map(({ age, updated }) => [age, updated]),
    [
      ['3d', '1h'],
      ['3d', '1h'],
    ]
  );
  assert.deepEqual(
    report.run.prs.map((pr) => pr.authorType),
    ['FIRST_TIME_CONTRIBUTOR', 'MEMBER']
  );
  assert.deepEqual(report.contributions, [
    { type: 'First-time contributor', count: 1 },
    { type: 'Member', count: 1 },
  ]);
  assert.equal(report.generatedAt, NOW.toISOString());
});

test('fetchSinglePrNode: missing PRs have a concise CLI error', async () => {
  const pipeline = pipelineWith({ api: { fetchPullRequestDetails: async () => [] } });
  await assert.rejects(pipeline.fetchSinglePrNode(CONFIG, 7), { name: 'CliError', message: 'no such PR: o/n#7' });
});

test('fetchSinglePrNode: uses the first stderr line, falling back to the error message', async () => {
  for (const [stderr, reason] of [
    ['  Not found\nquery details', 'Not found'],
    ['', 'Command failed'],
  ]) {
    const error = Object.assign(new Error('Command failed'), { stderr });
    const pipeline = pipelineWith({
      api: {
        fetchPullRequestDetails: async () => {
          throw error;
        },
      },
    });
    await assert.rejects(pipeline.fetchSinglePrNode(CONFIG, 7), {
      name: 'CliError',
      message: `cannot read o/n#7: ${reason}`,
    });
  }
});

for (const format of ['json', 'markdown']) {
  test(`run: ${format} queue output uses presented values while the cache keeps normalized values`, async (t) => {
    const config = await temporaryConfig(t);
    const output = captureOutput(t);
    const writes = [];
    const pipeline = pipelineWith({
      output: output.service,
      cache: {
        read: async () => null,
        write: async (key, value) => {
          writes.push({ key, value });
        },
        pathFor: (key) => path.join(config.prsCacheDir, `${key}.cache.json`),
      },
      api: queueApi({
        fetchAuthoredPrs: async () => [{ number: 7, updatedAt: 'changed' }],
        fetchPullRequestDetails: async () => [
          node(7, {
            reviewDecision: 'APPROVED',
            additions: 120,
            deletions: 45,
            changedFiles: 3,
            labels: { nodes: [{ name: 'size/L' }] },
          }),
        ],
      }),
    });

    await pipeline.run(config, { format });

    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, config.cacheKey);
    assert.equal(writes[0].value.prs[7].status, 'APPROVED');
    assert.equal(writes[0].value.prs[7].ciStatus, 'SUCCESS');
    assert.equal(writes[0].value.prs[7].authorType, 'MEMBER');
    assert.deepEqual(writes[0].value.prs[7].churn, { additions: 120, deletions: 45, total: 165 });
    assert.equal(writes[0].value.prs[7].sizeFromChurn, 'size/medium');
    assert.equal(writes[0].value.prs[7].changedFiles, 3);
    assert.equal(writes[0].value.prs[7].sizeFromLabels, 'size/L');
    assert.equal(Object.hasOwn(writes[0].value.prs[7], 'size'), false);
    assert.equal(Object.hasOwn(writes[0].value.prs[7], 'additions'), false);
    assert.equal(Object.hasOwn(writes[0].value.prs[7], 'deletions'), false);
    const payload = JSON.parse(output());
    if (format === 'json') {
      assert.equal(payload.prs[0].churn, 165);
      assert.equal(payload.prs[0].sizeFromChurn, 'size/medium');
      assert.equal(payload.prs[0].changedFiles, 3);
      assert.equal(payload.prs[0].sizeFromLabels, 'size/L');
      assert.equal(Object.hasOwn(payload.prs[0], 'size'), false);
      assert.equal(payload.prs[0].status, 'Approved');
      assert.equal(payload.prs[0].ciStatus, 'Pass');
      assert.equal(payload.prs[0].authorType, 'Member');
      assert.equal(payload.total, 1);
      await assert.rejects(fs.access(config.outputPath), { code: 'ENOENT' });
    } else {
      assert.match(await fs.readFile(config.outputPath, 'utf8'), /\| 3 \| 165 \| size\/medium \| size\/L \|/);
      assert.match(await fs.readFile(config.outputPath, 'utf8'), /\| Approved \| Mergeable \| Pass \|/);
      assert.deepEqual(payload.cache, {
        refetched: 1,
        reused: 0,
        added: 1,
        removed: 0,
        path: `cache/prs/${config.cacheKey}.cache.json`,
      });
      assert.equal(payload.output, 'output/reports/queue.md');
      assert.deepEqual(payload.contributions, { Member: 1 });
    }
  });
}

test('run: repeated single-PR runs are fresh and never read team scope or cache or write a report file', async (t) => {
  const config = await temporaryConfig(t);
  const output = captureOutput(t);
  let calls = 0;
  const pipeline = pipelineWith({
    output: output.service,
    api: {
      fetchPullRequestDetails: async (numbers) => {
        assert.deepEqual(numbers, [7]);
        calls += 1;
        return [node(7, { title: `Version ${calls}`, isDraft: true })];
      },
    },
  });

  await pipeline.run(config, { format: 'json', pr: { number: 7 } });
  await pipeline.run(config, { format: 'json', pr: { number: 7 } });

  const payloads = output()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    payloads.map((pr) => pr.title),
    ['Version 1', 'Version 2']
  );
  assert.equal('prs' in payloads[0], false);
  assert.deepEqual(await fs.readdir(config.root), []);
});

test('run: a fetch failure leaves cache, files and stdout untouched', async (t) => {
  const config = await temporaryConfig(t);
  const output = captureOutput(t);
  const error = new Error('GitHub unavailable');
  const pipeline = pipelineWith({
    output: output.service,
    api: queueApi({
      fetchPullRequestDetails: async () => {
        throw error;
      },
    }),
    cache: { read: async () => null, write: async () => assert.fail('wrote cache after failed fetch') },
  });
  await assert.rejects(pipeline.run(config, { format: 'json' }), (caught) => caught === error);
  assert.equal(output(), '');
  assert.deepEqual(await fs.readdir(config.root), []);
});

test('run: a cache write failure prevents report output', async (t) => {
  const config = await temporaryConfig(t);
  const output = captureOutput(t);
  const error = new Error('Disk full');
  const pipeline = pipelineWith({
    output: output.service,
    api: queueApi(),
    cache: {
      read: async () => null,
      write: async () => {
        throw error;
      },
    },
  });
  await assert.rejects(pipeline.run(config, { format: 'markdown' }), (caught) => caught === error);
  assert.equal(output(), '');
  assert.deepEqual(await fs.readdir(config.root), []);
});

for (const [single, format, method] of [
  [true, 'json', 'writePr'],
  [false, 'json', 'writeJson'],
  [false, 'markdown', 'writeMarkdown'],
]) {
  test(`render: delegates to ${method} after saving queue records`, async () => {
    const events = [];
    const failure = new Error('Output unavailable');
    const raw = { number: 7, status: 'APPROVED' };
    const presented = { number: 7, status: 'Approved' };
    const report = { run: { single, prs: [raw] }, prs: [presented] };
    const pipeline = pipelineWith({
      cache: {
        write: async (key, value) => events.push(['cache', key, value]),
        pathFor: () => '/cache/prs.json',
      },
      output: {
        [method]: async (...args) => {
          events.push(['output', ...args]);
          throw failure;
        },
      },
    });

    await assert.rejects(pipeline.render(CONFIG, format, report), (error) => error === failure);
    const outputArgs = single
      ? [presented]
      : format === 'json'
        ? [CONFIG, report.prs]
        : [CONFIG, report, '/cache/prs.json'];
    assert.deepEqual(events, [
      ...(!single ? [['cache', CONFIG.cacheKey, { prs: { 7: raw } }]] : []),
      ['output', ...outputArgs],
    ]);
  });
}

test('configFor: repository separators cannot collide with literal hyphens', () => {
  const first = configFor('a-b/c', 'org/team');
  const second = configFor('a/b-c', 'org/team');

  assert.notEqual(first.cacheKey, second.cacheKey);
  assert.notEqual(first.outputPath, second.outputPath);
  assert.equal(first.membersCacheKey, second.membersCacheKey);
  assert.deepEqual(first.cacheKey.split('@').map(decodeURIComponent), ['a-b/c', 'org/team']);
});

test('configFor: team separators cannot collide with literal hyphens', () => {
  const first = configFor('o/n', 'a-b/c');
  const second = configFor('o/n', 'a/b-c');

  assert.notEqual(first.cacheKey, second.cacheKey);
  assert.notEqual(first.membersCacheKey, second.membersCacheKey);
  assert.notEqual(first.outputPath, second.outputPath);
  assert.equal(first.membersCacheKey, 'members@a-b%2Fc');
});

function cachedReadyPr() {
  return {
    number: 7,
    updatedAt: 'same',
    title: 'Cached title',
    author: 'alice',
    authorType: 'MEMBER',
    labels: ['area/dashboards'],
    reviewers: ['bob'],
    fixes: { total: 1, issues: [{ number: 8, url: 'issue-url', comments: 2 }] },
    changedFiles: 1,
    churn: { additions: 1, deletions: 0, total: 1 },
    sizeFromChurn: 'size/small',
    ciStatus: 'FAILURE',
    mergeable: 'MERGEABLE',
    status: 'APPROVED',
  };
}

test('run: refreshes readiness every time without changing timestamps or losing cached metadata', async () => {
  let cached = cachedReadyPr();
  const original = structuredClone(cached);
  const updates = [
    { ciStatus: 'SUCCESS', mergeable: 'CONFLICTING', status: 'CHANGES_REQUESTED' },
    { ciStatus: 'PENDING', mergeable: 'UNKNOWN', status: 'REVIEW_REQUIRED' },
    { ciStatus: '', mergeable: 'UNKNOWN', status: '' },
  ];
  let iteration = 0;
  let presented;
  const pipeline = pipelineWith({
    cache: {
      read: async () => ({ prs: { 7: cached } }),
      write: async (key, value) => {
        cached = value.prs[7];
      },
    },
    api: queueApi({
      fetchAuthoredPrs: async () => [{ number: 7, updatedAt: 'same' }],
      fetchPullRequestDetails: async (numbers, readinessNumbers) => {
        assert.deepEqual(numbers, []);
        assert.deepEqual(readinessNumbers, [7]);
        const update = updates[iteration];
        return [
          {
            number: 7,
            mergeable: iteration === 2 ? null : update.mergeable,
            reviewDecision: update.status || null,
            commits: {
              nodes: [{ commit: { statusCheckRollup: update.ciStatus ? { state: update.ciStatus } : null } }],
            },
          },
        ];
      },
    }),
    output: {
      writeJson: async (config, prs) => {
        presented = prs[0];
      },
    },
  });
  for (; iteration < updates.length; iteration += 1) {
    const before = cached;
    await pipeline.run(CONFIG, { format: 'json' });
    assert.deepEqual(cached, { ...original, ...updates[iteration] });
    assert.notStrictEqual(cached, before);
    assert.deepEqual(presented, new PullRequestPresenter().present(cached));
  }
});

test('run: refreshes linked issues with unchanged PR timestamps while preserving PR metadata', async () => {
  let cached = { ...cachedReadyPr(), labels: ['area/dashboards', 'type/bug'] };
  const original = structuredClone(cached);
  const updates = [
    {
      nodes: [{ number: 8, url: 'issue-url', comments: { totalCount: 5 }, issueType: { name: 'Feature' } }],
      issues: [{ number: 8, url: 'issue-url', comments: 5, type: ['Feature'] }],
    },
    {
      nodes: [
        { number: 8, url: 'issue-url', comments: { totalCount: 6 }, labels: { nodes: [{ name: 'type/regression' }] } },
        { number: 9, url: 'new-issue-url', comments: { totalCount: 0 } },
      ],
      issues: [
        { number: 8, url: 'issue-url', comments: 6, type: ['type/regression'] },
        { number: 9, url: 'new-issue-url', comments: 0, type: ['type/bug'] },
      ],
    },
    {
      nodes: [{ number: 9, url: 'new-issue-url', comments: { totalCount: 1 } }],
      issues: [{ number: 9, url: 'new-issue-url', comments: 1, type: ['type/bug'] }],
    },
    { nodes: [], issues: [] },
  ];
  let current;
  let presented;
  const pipeline = pipelineWith({
    cache: {
      read: async () => ({ prs: { 7: cached } }),
      write: async (key, value) => {
        cached = value.prs[7];
      },
    },
    api: queueApi({
      fetchAuthoredPrs: async () => [{ number: 7, updatedAt: 'same' }],
      fetchPullRequestDetails: async (numbers, readinessNumbers) => {
        assert.deepEqual(numbers, []);
        assert.deepEqual(readinessNumbers, [7]);
        return [
          node(7, {
            reviewDecision: 'APPROVED',
            commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
            closingIssuesReferences: { totalCount: current.nodes.length, nodes: current.nodes },
          }),
        ];
      },
    }),
    output: {
      writeJson: async (config, prs) => {
        presented = prs[0];
      },
    },
  });

  for (current of updates) {
    const before = cached;
    const snapshot = structuredClone(before);
    await pipeline.run(CONFIG, { format: 'json' });
    const fixes = { total: current.issues.length, issues: current.issues };
    assert.deepEqual(cached, { ...original, fixes });
    assert.deepEqual(before, snapshot);
    assert.deepEqual(presented.fixes, fixes.total ? fixes : undefined);
  }
});

for (const missing of [false, true]) {
  test(`run: ${missing ? 'missing' : 'failed'} readiness leaves the cache and output untouched`, async () => {
    const cached = cachedReadyPr();
    const original = structuredClone(cached);
    const pipeline = pipelineWith({
      cache: {
        read: async () => ({ prs: { 7: cached } }),
        write: async () => assert.fail('cache written after readiness failure'),
      },
      api: queueApi({
        fetchAuthoredPrs: async () => [{ number: 7, updatedAt: 'same' }],
        fetchPullRequestDetails: async () => {
          if (missing) {
            return [];
          }
          throw new Error('GitHub unavailable');
        },
      }),
      output: { writeJson: async () => assert.fail('report emitted after readiness failure') },
    });
    await assert.rejects(
      pipeline.run(CONFIG, { format: 'json' }),
      missing ? /cannot refresh readiness/ : /GitHub unavailable/
    );
    assert.deepEqual(cached, original);
  });
}
