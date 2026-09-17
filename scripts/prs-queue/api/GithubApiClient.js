const { execFile } = require('child_process');
const { promisify } = require('util');

const { logger } = require('../logger/logger');
const { PullRequestNormalizer } = require('../pipeline/normalizer/PullRequestNormalizer');

const { mapWithLimit } = require('./helpers');

// Exclude drafts from queue searches because they are not ready for review.
// This also avoids fetching their details.
const BASE_QUALIFIERS = 'is:pr is:open -is:draft';

// Search includes updated_at, so checking cache freshness needs no extra request.
const SEARCH_ROW_FIELDS = '.items[] | [.number, .updated_at] | @tsv';

// Keep the detail fields together so all batches request the same data.
const PR_DETAIL_FIELDS = `number title url additions deletions changedFiles mergeable reviewDecision createdAt updatedAt author { login } authorAssociation labels(first: 50) { nodes { name } } closingIssuesReferences(first: 10) { totalCount nodes { number url issueType { name } comments { totalCount } labels(first: 20) { nodes { name } } } } latestReviews(first: 40) { nodes { author { login } state } } reviewRequests(first: 20) { nodes { requestedReviewer { ... on User { login } ... on Team { slug } } } } commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`;

const execFileAsync = promisify(execFile);

// Return command output as a string so tests can replace the command runner.
async function runCommand(file, args, options) {
  const { stdout } = await execFileAsync(file, args, options);
  return stdout;
}

// TSV keeps each PR number and timestamp on the same line.
function parseSearchRow(line) {
  const [number, updatedAt] = line.split('\t');
  return { number: Number(number), updatedAt };
}

// Allow callers to omit the team cache.
const NO_CACHE = { read: async () => null, write: async () => {} };

class GithubApiClient {
  // gh expects this flag value to be a string.
  static #SEARCH_PAGE_SIZE = '100';

  // Six clauses use GitHub's maximum of five OR operators per query.
  static #SEARCH_BATCH_SIZE = 6;

  static #DETAIL_BATCH_SIZE = 20;

  // Limit concurrent gh processes to reduce the risk of GitHub throttling.
  static #MAX_CONCURRENT_REQUESTS = 4;

  // Allow large responses when a batch contains many reviews and issues.
  static #MAX_BUFFER = 64 * 1024 * 1024;

  #owner;
  #name;
  #repo;
  #teamOrg;
  #teamSlug;
  #membersCacheKey;
  #cache;
  #run;

  constructor({ owner, name, repo, teamOrg, teamSlug, membersCacheKey, cache = NO_CACHE, run = runCommand }) {
    this.#owner = owner;
    this.#name = name;
    this.#repo = repo;
    this.#teamOrg = teamOrg;
    this.#teamSlug = teamSlug;
    this.#membersCacheKey = membersCacheKey;
    this.#cache = cache;
    this.#run = run;
  }

  async fetchTeamMembers() {
    const cached = await this.#cache.read(this.#membersCacheKey);
    const members = Array.isArray(cached?.members) ? cached.members : await this.#fetchTeamMembersFromApi();
    logger.log(`team members (${members.length})`);
    return members;
  }

  async fetchTeamReviewRequestedPrs() {
    const prs = await this.#searchPullRequests([`team-review-requested:${this.#teamOrg}/${this.#teamSlug}`]);
    logger.log(`PRs with a review requested from the team (${prs.length})`);
    return prs;
  }

  async fetchAuthoredPrs(logins) {
    const prs = await this.#searchPullRequests(logins.map((login) => `author:${login}`));
    logger.log(`PRs created by team members (${prs.length})`);
    return prs;
  }

  async fetchReviewRequestedPrs(logins) {
    const prs = await this.#searchPullRequests(logins.map((login) => `review-requested:${login}`));
    logger.log(`PRs with a review requested from an individual team member (${prs.length})`);
    return prs;
  }

  fetchPullRequestDetails(numbers) {
    return this.#fetchPullRequestNodes(numbers);
  }

  async #fetchTeamMembersFromApi() {
    const raw = await this.#gh(
      ['api', '--paginate', `orgs/${this.#teamOrg}/teams/${this.#teamSlug}/members`],
      '.[].login'
    );
    // Normalize before caching so subsequent PR searches use unique, non-empty, case-insensitive logins.
    const members = PullRequestNormalizer.normalizeLogins(raw.split('\n'));
    await this.#cache.write(this.#membersCacheKey, { members });
    return members;
  }

  #gh(args, jq) {
    return this.#run('gh', [...args, '--jq', jq], { encoding: 'utf8', maxBuffer: GithubApiClient.#MAX_BUFFER });
  }

  // Combine member filters to avoid a separate request for each person.
  // The advanced search endpoint supports OR for repeated review-requested filters.
  async #searchPullRequests(clauses) {
    const byNumber = new Map();
    for (let i = 0; i < clauses.length; i += GithubApiClient.#SEARCH_BATCH_SIZE) {
      const rows = await this.#searchPullRequestBatch(clauses.slice(i, i + GithubApiClient.#SEARCH_BATCH_SIZE));
      for (const row of rows) {
        const previous = byNumber.get(row.number);
        // A PR can request multiple members; preserve the newest freshness signal across batches.
        if (!previous || row.updatedAt > previous.updatedAt) {
          byNumber.set(row.number, row);
        }
      }
    }
    return [...byNumber.values()];
  }

  async #searchPullRequestBatch(clauses) {
    const query = `repo:${this.#repo} ${BASE_QUALIFIERS} (${clauses.join(' OR ')})`;
    const raw = await this.#gh(
      [
        'api',
        '-X',
        'GET',
        'search/issues',
        '--paginate',
        '-f',
        `per_page=${GithubApiClient.#SEARCH_PAGE_SIZE}`,
        '-f',
        'advanced_search=true',
        '-f',
        `q=${query}`,
      ],
      SEARCH_ROW_FIELDS
    );
    return raw.split('\n').filter(Boolean).map(parseSearchRow);
  }

  async #graphql(selection) {
    const query = `query { repository(owner: "${this.#owner}", name: "${this.#name}") { ${selection} } }`;
    return JSON.parse(await this.#gh(['api', 'graphql', '-f', `query=${query}`], '.data.repository'));
  }

  // Log before fetching so progress is visible during slow requests.
  async #fetchPullRequestNodes(numbers) {
    if (numbers.length === 0) {
      return [];
    }
    logger.log(`fetch PR details (${numbers.length})`);
    const batchSize = GithubApiClient.#DETAIL_BATCH_SIZE;

    const batches = [];
    for (let i = 0; i < numbers.length; i += batchSize) {
      batches.push(numbers.slice(i, i + batchSize));
    }

    const pages = await mapWithLimit(batches, GithubApiClient.#MAX_CONCURRENT_REQUESTS, (batch) =>
      this.#graphql(
        batch.map((number, index) => `p${index}: pullRequest(number: ${number}) { ${PR_DETAIL_FIELDS} }`).join('\n')
      )
    );
    return pages.flatMap((page) => Object.values(page).filter((node) => node?.number));
  }
}

module.exports = { GithubApiClient };
