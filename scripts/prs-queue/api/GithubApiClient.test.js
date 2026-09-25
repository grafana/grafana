const assert = require('node:assert/strict');
const test = require('node:test');

const { GithubApiClient } = require('./GithubApiClient');

// Records every `gh` invocation and answers each one from the queue of canned stdout strings.
function stubRun(responses = []) {
  const calls = [];
  const remaining = [...responses];
  const run = async (file, args) => {
    calls.push({ file, args, argv: args.join(' ') });
    return remaining.length ? remaining.shift() : '';
  };
  run.calls = calls;
  return run;
}

function clientWith(run, overrides = {}) {
  return new GithubApiClient({
    owner: 'o',
    name: 'n',
    repo: 'o/n',
    teamOrg: 'org',
    teamSlug: 'squad',
    membersCacheKey: 'members@squad',
    run,
    ...overrides,
  });
}

function memoryCache(initial = {}) {
  const store = { ...initial };
  return {
    writes: store,
    read: async (key) => store[key] ?? null,
    write: async (key, value) => {
      store[key] = value;
    },
  };
}

function graphqlPayload(nodes) {
  return JSON.stringify(Object.fromEntries(nodes.map((node, index) => [`p${index}`, node])));
}

function queryOf(call) {
  const query = call.args.find((arg) => arg.startsWith('q=') || arg.startsWith('query='));
  return query
    .replace(/^q=|^query=/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

test('fetchTeamMembers: a cached list is returned without running anything', async () => {
  const run = stubRun();
  const client = clientWith(run, { cache: memoryCache({ 'members@squad': { members: ['b', 'a'] } }) });

  assert.deepEqual(await client.fetchTeamMembers(), ['b', 'a']);
  assert.equal(run.calls.length, 0);
});

test('fetchTeamMembers: cached members are returned unchanged without rewriting the cache', async (t) => {
  const members = ['B', 'a ', 'A'];
  const cache = memoryCache({ 'members@squad': { members } });
  const write = t.mock.method(cache, 'write');
  const run = stubRun();
  const client = clientWith(run, { cache });

  assert.strictEqual(await client.fetchTeamMembers(), members);
  assert.equal(write.mock.callCount(), 0);
  assert.equal(run.calls.length, 0);
});

test('fetchTeamMembers: an empty cached list is a hit', async () => {
  const run = stubRun();
  const client = clientWith(run, { cache: memoryCache({ 'members@squad': { members: [] } }) });
  assert.deepEqual(await client.fetchTeamMembers(), []);
  assert.equal(run.calls.length, 0);
});

test('fetchTeamMembers: an invalid cached members value is fetched again', async () => {
  const run = stubRun(['alice\n']);
  const cache = memoryCache({ 'members@squad': { members: 'alice' } });
  assert.deepEqual(await clientWith(run, { cache }).fetchTeamMembers(), ['alice']);
  assert.equal(run.calls.length, 1);
  assert.deepEqual(cache.writes['members@squad'], { members: ['alice'] });
});

test('fetchTeamMembers: a miss reads the team from the API and caches the result', async () => {
  const run = stubRun(['Bravo\nalpha\n\nalpha\n']);
  const cache = memoryCache();
  const client = clientWith(run, { cache });

  assert.deepEqual(await client.fetchTeamMembers(), ['alpha', 'bravo']);
  assert.match(run.calls[0].argv, /orgs\/org\/teams\/squad\/members/);
  assert.deepEqual(cache.writes['members@squad'], { members: ['alpha', 'bravo'] });
});

test('fetchTeamMembers: the client runs without a cache being injected', async () => {
  const client = clientWith(stubRun(['alpha\n']));

  assert.deepEqual(await client.fetchTeamMembers(), ['alpha']);
});

test('search: a small team fits in one request with an OR clause per login', async () => {
  const run = stubRun(['1\t2026-01-01T00:00:00Z\n2\t2026-01-02T00:00:00Z\n']);
  const client = clientWith(run);

  assert.deepEqual(await client.fetchAuthoredPrs(['alpha', 'bravo']), [
    { number: 1, updatedAt: '2026-01-01T00:00:00Z' },
    { number: 2, updatedAt: '2026-01-02T00:00:00Z' },
  ]);
  assert.equal(run.calls.length, 1);
  assert.equal(
    queryOf(run.calls[0]),
    'repo:o/n is:pr is:open -is:draft -author:dependabot[bot] (author:alpha OR author:bravo)'
  );
});

test('search: individual review requests use direct-user clauses to exclude other teams', async () => {
  const run = stubRun(['']);
  const client = clientWith(run);

  await client.fetchReviewRequestedPrs(['alpha', 'bravo']);

  assert.equal(
    queryOf(run.calls[0]),
    'repo:o/n is:pr is:open -is:draft -author:dependabot[bot] (user-review-requested:alpha OR user-review-requested:bravo)'
  );
});

for (const [method, qualifier] of [
  ['fetchAuthoredPrs', 'author'],
  ['fetchReviewRequestedPrs', 'user-review-requested'],
]) {
  for (const count of [6, 7, 13]) {
    test(`search: ${method} covers ${count} members without exceeding five OR operators`, async () => {
      const logins = Array.from({ length: count }, (_, index) => `member${index}`);
      const run = stubRun();

      await clientWith(run)[method](logins);

      assert.equal(run.calls.length, Math.ceil(count / 6));
      const searched = [];
      for (const call of run.calls) {
        const query = queryOf(call);
        assert.ok((query.match(/ OR /g) ?? []).length <= 5);
        assert.ok(query.startsWith('repo:o/n is:pr is:open -is:draft -author:dependabot[bot] ('));
        assert.ok(call.args.includes('--paginate'));
        assert.ok(call.args.includes('advanced_search=true'));
        searched.push(...query.matchAll(new RegExp(`${qualifier}:(member\\d+)`, 'g')));
      }
      assert.deepEqual(
        searched.map((match) => match[1]),
        logins
      );
    });
  }
}

test('search: overlapping batches retain each PR once with its newest timestamp', async () => {
  const older = '2026-01-01T00:00:00Z';
  const newer = '2026-01-02T00:00:00Z';
  const run = stubRun([`1\t${older}\n2\t${newer}\n`, `1\t${newer}\n2\t${older}\n3\t${older}\n`]);

  const rows = await clientWith(run).fetchReviewRequestedPrs(Array.from({ length: 7 }, (_, i) => `member${i}`));

  assert.deepEqual(rows, [
    { number: 1, updatedAt: newer },
    { number: 2, updatedAt: newer },
    { number: 3, updatedAt: older },
  ]);
});

test('search: a later batch failure rejects instead of returning a partial queue', async () => {
  let calls = 0;
  const run = async () => {
    if (calls++ === 0) {
      return '1\t2026-01-01T00:00:00Z\n';
    }
    throw new Error('search failed');
  };

  await assert.rejects(
    clientWith(run).fetchAuthoredPrs(Array.from({ length: 7 }, (_, i) => `member${i}`)),
    /search failed/
  );
});

test('search: the team query uses the team, not its members', async () => {
  const run = stubRun(['']);
  const client = clientWith(run);

  await client.fetchTeamReviewRequestedPrs();

  assert.equal(
    queryOf(run.calls[0]),
    'repo:o/n is:pr is:open -is:draft -author:dependabot[bot] (team-review-requested:org/squad)'
  );
});

// The qualifier sits outside the OR group, so it narrows the whole query instead of joining the ORs.
test('search: every search excludes drafts and blacklisted authors ahead of the OR group', async () => {
  const run = stubRun();
  const client = clientWith(run);

  await client.fetchAuthoredPrs(['alpha']);
  await client.fetchReviewRequestedPrs(['alpha']);
  await client.fetchTeamReviewRequestedPrs();

  for (const call of run.calls) {
    const query = queryOf(call);
    assert.ok(
      query.includes(' -is:draft -author:dependabot[bot] ('),
      `queue exclusions missing or misplaced in ${query}`
    );
  }
});

// Without advanced_search repeated review-request qualifiers can silently return a subset.
test('search: advanced_search and pagination are always requested', async () => {
  const run = stubRun(['']);
  const client = clientWith(run);

  await client.fetchAuthoredPrs(['alpha']);

  assert.ok(run.calls[0].args.includes('--paginate'));
  assert.ok(run.calls[0].args.includes('advanced_search=true'));
  assert.ok(run.calls[0].args.includes('per_page=100'));
});

test('search: an empty login list asks GitHub nothing', async () => {
  const run = stubRun();
  const client = clientWith(run);

  assert.deepEqual(await client.fetchAuthoredPrs([]), []);
  assert.equal(run.calls.length, 0);
});

test('search: rows are parsed and blank lines ignored', async () => {
  const client = clientWith(stubRun(['10\t2026-01-01T00:00:00Z\n\n11\t2026-01-02T00:00:00Z\n']));

  assert.deepEqual(await client.fetchAuthoredPrs(['alpha']), [
    { number: 10, updatedAt: '2026-01-01T00:00:00Z' },
    { number: 11, updatedAt: '2026-01-02T00:00:00Z' },
  ]);
});

// The freshness signal rides along with the number, so a later run can skip unchanged PRs.
test('search: every search asks for updated_at alongside the number', async () => {
  const run = stubRun();
  const client = clientWith(run);

  await client.fetchAuthoredPrs(['alpha']);
  await client.fetchReviewRequestedPrs(['alpha']);
  await client.fetchTeamReviewRequestedPrs();

  for (const call of run.calls) {
    assert.ok(
      call.args.includes('.items[] | [.number, .updated_at] | @tsv'),
      `updated_at missing from jq filter in ${call.argv}`
    );
  }
});

test('fetchPullRequestDetails: PRs are aliased one per number in a single query', async () => {
  const run = stubRun([graphqlPayload([{ number: 1 }, { number: 2 }])]);
  const client = clientWith(run);

  const nodes = await client.fetchPullRequestDetails([1, 2]);

  assert.deepEqual(nodes, [{ number: 1 }, { number: 2 }]);
  const query = queryOf(run.calls[0]);
  assert.match(query, /repository\(owner: "o", name: "n"\)/);
  assert.match(query, /p0: pullRequest\(number: 1\)/);
  assert.match(query, /p1: pullRequest\(number: 2\)/);
  assert.match(query, /\badditions deletions changedFiles\b/);
  assert.match(query, /statusCheckRollup \{ state \}/);
  assert.doesNotMatch(query, /contexts/);
});

test('fetchPullRequestDetails: more than 20 PRs are split into batches', async () => {
  const numbers = Array.from({ length: 25 }, (unused, index) => index + 1);
  const run = stubRun([
    graphqlPayload(numbers.slice(0, 20).map((number) => ({ number }))),
    graphqlPayload(numbers.slice(20).map((number) => ({ number }))),
  ]);
  const client = clientWith(run);

  const nodes = await client.fetchPullRequestDetails(numbers);

  assert.equal(run.calls.length, 2);
  assert.deepEqual(
    nodes.map((node) => node.number),
    numbers
  );
  assert.match(queryOf(run.calls[1]), /p0: pullRequest\(number: 21\)/);
});

test('fetchPullRequestDetails: nodes without a number are dropped', async () => {
  const run = stubRun([JSON.stringify({ p0: null, p1: { number: 2 }, p2: {} })]);
  const client = clientWith(run);

  assert.deepEqual(await client.fetchPullRequestDetails([1, 2, 3]), [{ number: 2 }]);
});

test('fetchPullRequestDetails: an empty list asks GitHub nothing', async () => {
  const run = stubRun();
  const client = clientWith(run);

  assert.deepEqual(await client.fetchPullRequestDetails([]), []);
  assert.equal(run.calls.length, 0);
});

test('batches run concurrently, but no more than four at a time', async () => {
  const numbers = Array.from({ length: 200 }, (unused, index) => index + 1);
  let running = 0;
  let peak = 0;
  const run = async () => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setImmediate(resolve));
    running -= 1;
    return graphqlPayload([]);
  };

  await clientWith(run).fetchPullRequestDetails(numbers);

  assert.equal(peak, 4);
});

test('batched results keep the order of the numbers asked for', async () => {
  const numbers = Array.from({ length: 25 }, (unused, index) => index + 1);
  let call = 0;
  const run = async () => {
    const batch = call++ === 0 ? numbers.slice(0, 20) : numbers.slice(20);
    // The later batch answers first, so input order can only come from the mapping.
    await new Promise((resolve) => setTimeout(resolve, call === 1 ? 20 : 0));
    return graphqlPayload(batch.map((number) => ({ number })));
  };

  const nodes = await clientWith(run).fetchPullRequestDetails(numbers);

  assert.deepEqual(
    nodes.map((node) => node.number),
    numbers
  );
});

test('every call goes through gh with a jq filter', async () => {
  const run = stubRun(['']);
  const client = clientWith(run);

  await client.fetchAuthoredPrs(['alpha']);

  assert.equal(run.calls[0].file, 'gh');
  assert.equal(run.calls[0].args.at(-2), '--jq');
});

test('a failing command rejects rather than returning empty', async () => {
  const run = async () => {
    throw new Error('gh: not authenticated');
  };
  const client = clientWith(run);

  await assert.rejects(() => client.fetchAuthoredPrs(['alpha']), /not authenticated/);
});

test('fetchTeamMembers: disabled cache fetches fresh membership on every call', async (t) => {
  const fs = require('node:fs/promises');
  const { FileCacheClient } = require('../cache/FileCacheClient');
  for (const method of ['readFile', 'mkdir', 'open', 'rename', 'rm']) {
    t.mock.method(fs, method, () => assert.fail(`unexpected filesystem operation: ${method}`));
  }
  const run = stubRun(['alice\n', 'bob\n']);
  const client = clientWith(run, { cache: new FileCacheClient({ dir: '/unused', enabled: false }) });
  assert.deepEqual(await client.fetchTeamMembers(), ['alice']);
  assert.deepEqual(await client.fetchTeamMembers(), ['bob']);
});

test('readiness fetches only volatile fields in batches of 20 with at most four requests', async () => {
  const numbers = Array.from({ length: 85 }, (_, index) => index + 1);
  const queries = [];
  let active = 0;
  let peak = 0;
  const run = async (file, args) => {
    const query = queryOf({ args });
    queries.push(query);
    const requested = [...query.matchAll(/pullRequest\(number: (\d+)\)/g)].map((match) => Number(match[1]));
    assert.ok(requested.length <= 20);
    assert.match(query, /number mergeable reviewDecision/);
    assert.match(query, /closingIssuesReferences\(first: 6\)/);
    assert.match(query, /commits\(last: 1\).*statusCheckRollup \{ state \}/);
    assert.doesNotMatch(query, /title|labels\(first: 50\)|latestReviews|reviewRequests|additions|deletions/);
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    return graphqlPayload(requested.map((number) => ({ number, mergeable: 'CONFLICTING' })));
  };
  const client = clientWith(run);
  assert.deepEqual(await client.fetchPullRequestDetails([], []), []);
  assert.equal(queries.length, 0);
  const nodes = await client.fetchPullRequestDetails([], numbers);
  assert.deepEqual(
    nodes.map((node) => node.number),
    numbers
  );
  assert.equal(queries.length, 5);
  assert.equal(peak, 4);
});

for (const [fullCount, readinessCount] of [
  [5, 15],
  [25, 25],
  [45, 40],
]) {
  test(`mixed batches: ${fullCount} full-detail and ${readinessCount} readiness PRs share requests`, async () => {
    const full = Array.from({ length: fullCount }, (_, index) => index + 1);
    const readiness = Array.from({ length: readinessCount }, (_, index) => fullCount + index + 1);
    let requests = 0;
    let active = 0;
    let peak = 0;
    const run = async (file, args) => {
      requests += 1;
      const query = queryOf({ args });
      const selections = [...query.matchAll(/p\d+: pullRequest\(number: (\d+)\) \{ (.*?)(?= p\d+: pullRequest|$)/g)];
      assert.ok(selections.length <= 20);
      for (const [, number, fields] of selections) {
        assert.match(fields, /mergeable reviewDecision/);
        assert.match(fields, /statusCheckRollup \{ state \}/);
        assert.match(
          fields,
          /closingIssuesReferences\(first: 6\) \{ totalCount nodes \{ number url issueType \{ name \} comments \{ totalCount \} labels\(first: 20\)/
        );
        if (full.includes(Number(number))) {
          assert.match(fields, /title url additions deletions changedFiles/);
          assert.match(fields, /labels\(first: 50\)/);
        } else {
          assert.doesNotMatch(fields, /title|labels\(first: 50\)|latestReviews|reviewRequests/);
        }
      }
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return graphqlPayload(selections.map(([, number]) => ({ number: Number(number) })));
    };
    const nodes = await clientWith(run).fetchPullRequestDetails(full, readiness);
    assert.deepEqual(
      nodes.map((node) => node.number),
      [...full, ...readiness]
    );
    assert.equal(requests, Math.ceil((fullCount + readinessCount) / 20));
    assert.equal(peak, Math.min(4, requests));
  });
}
