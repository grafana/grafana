const path = require('path');

const { CliError } = require('../cli/cli');
const { logger } = require('../logger/logger');

const { newestUpdatedAt, numbersIn, parseRepo, parseTeam } = require('./helpers');
const { describeType } = require('./presenter/PullRequestPresenter');
const { contributorCounts, rankOf } = require('./presenter/contributor-ranking');

// Keep generated data beside the CLI, regardless of the working directory.
const DATA_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(DATA_ROOT, 'output');
const CACHE_DIR = path.join(OUTPUT_DIR, 'cache');

const OUTPUT_PREFIX = 'open-prs@';

// Pending or missing CI results may change without a PR update.
const UNSETTLED_CI = new Set(['PENDING', 'EXPECTED', '']);

class PrReportsPipeline {
  #services;

  constructor({ api, cache, normalizer, presenter, output }) {
    this.#services = { api, cache, normalizer, presenter, output };
  }

  static configFor(repoValue, teamValue) {
    const parsed = parseRepo(repoValue);
    const team = parseTeam(teamValue);
    const teamName = `${team.teamOrg}/${team.teamSlug}`;
    const cacheKey = `${encodeURIComponent(parsed.repo)}@${encodeURIComponent(teamName)}`;
    return {
      ...parsed,
      ...team,
      team: teamName,
      root: DATA_ROOT,
      prsCacheDir: path.join(CACHE_DIR, 'prs'),
      membersCacheDir: path.join(CACHE_DIR, 'teams'),
      cacheKey,
      membersCacheKey: `members@${encodeURIComponent(teamName)}`,
      outputPath: path.join(OUTPUT_DIR, 'reports', `${OUTPUT_PREFIX}${cacheKey}.md`),
    };
  }

  async run(config, options) {
    const fetched = await this.fetch(config, options);
    const normalized = this.normalize(fetched);
    const presented = this.present(normalized);
    await this.render(config, options.format, presented);
  }

  /** @returns {Promise<import('./types').FetchedRun>} */
  async fetch(config, options) {
    const { api, cache } = this.#services;
    if (options.pr) {
      const number = options.pr.number;
      const node = await this.fetchSinglePrNode(config, number);
      return {
        single: true,
        entries: [{ node, cached: { number } }],
      };
    }

    const scope = await this.collectScope();
    const cached = (await cache.read(config.cacheKey)) ?? { prs: {} };
    const { byNumber, removed } = pruneByRelevance(cached.prs, scope.relevant);
    const { stale, reused } = splitByFreshness(byNumber, scope);
    const nodes = await api.fetchPullRequestDetails(stale);
    const details = new Map(nodes.map((node) => [node.number, node]));
    const entries = [...scope.relevant].map((number) => ({
      node: details.get(number),
      cached: byNumber[number] ?? { number },
    }));

    const refetched = entries.filter(({ node }) => node);

    return {
      single: false,
      entries,
      scope,
      added: stale.filter((number) => !byNumber[number]).length,
      removed,
      refetched: refetched.length,
      reused,
    };
  }

  // Show the first error line from gh instead of its full command and GraphQL query.
  async fetchSinglePrNode(config, number) {
    const { api } = this.#services;
    let nodes;
    try {
      nodes = await api.fetchPullRequestDetails([number]);
    } catch (error) {
      const reason = String(error.stderr ?? '')
        .trim()
        .split('\n')[0];
      throw new CliError(`cannot read ${config.repo}#${number}: ${reason || error.message}`);
    }

    if (!nodes[0]) {
      throw new CliError(`no such PR: ${config.repo}#${number}`);
    }
    return nodes[0];
  }

  async collectScope() {
    const { api } = this.#services;
    const members = new Set(await api.fetchTeamMembers());
    const logins = [...members];

    logger.log('searching open PRs authored by team members or requesting review from the team or its members');
    const [requestedFromTeam, createdByMembers, requestedFromMembers] = await Promise.all([
      api.fetchTeamReviewRequestedPrs(),
      api.fetchAuthoredPrs(logins),
      api.fetchReviewRequestedPrs(logins),
    ]);
    const found = [...requestedFromTeam, ...createdByMembers, ...requestedFromMembers];

    return {
      members,
      createdByTeamMembers: numbersIn(createdByMembers),
      reviewRequests: {
        fromTeam: numbersIn(requestedFromTeam),
        fromIndividualMember: numbersIn(requestedFromMembers),
      },
      relevant: numbersIn(found),
      updatedAt: newestUpdatedAt(found),
    };
  }

  /**
   * @param {import('./types').FetchedRun} fetched
   * @returns {import('./types').NormalizedRun}
   */
  normalize({ entries, ...run }) {
    const { normalizer } = this.#services;
    const prs = entries.map(({ node, cached }) => (node ? normalizer.fromGraphQL(node, cached) : cached));
    return { ...run, prs };
  }

  /**
   * @param {import('./types').NormalizedRun} run
   * @param {Date} [now]
   * @returns {import('./types').PresentedReport}
   */
  present(run, now = new Date()) {
    const { presenter } = this.#services;
    const prs = [...run.prs];
    if (!run.single) {
      PrReportsPipeline.sortByContributorRank(prs);
    }
    return {
      run: { ...run, prs },
      prs: presenter.presentAll(prs, now),
      contributions: contributorCounts(prs).map(({ type, count }) => ({ type: describeType(type), count })),
      generatedAt: now.toISOString(),
    };
  }

  // Put first-time contributors first, then sort each group by newest PR number.
  static sortByContributorRank(prs) {
    prs.sort((a, b) => rankOf(a.authorType) - rankOf(b.authorType) || b.number - a.number);
  }

  async render(config, format, report) {
    const { cache, output } = this.#services;
    const { run, prs } = report;
    if (run.single) {
      await output.writePr(prs[0]);
      return;
    }

    // Cache raw GitHub states so the next run can check whether they need refreshing.
    await cache.write(config.cacheKey, { prs: Object.fromEntries(run.prs.map((pr) => [pr.number, pr])) });

    if (format === 'json') {
      await output.writeJson(config, prs);
      return;
    }

    await output.writeMarkdown(config, report, cache.pathFor(config.cacheKey));
  }
}

function pruneByRelevance(cachedPrs, relevant) {
  const byNumber = { ...cachedPrs };

  let removed = 0;
  for (const key of Object.keys(byNumber)) {
    if (!relevant.has(Number(key))) {
      delete byNumber[key];
      removed += 1;
    }
  }

  logger.log(`cached PRs (${Object.keys(byNumber).length} kept, ${removed} dropped)`);
  return { byNumber, removed };
}

function splitByFreshness(cachedPrs, scope) {
  const stale = [];
  let reused = 0;
  let added = 0;
  let updated = 0;
  let unsettled = 0;
  let missingDiff = 0;

  for (const number of scope.relevant) {
    const pr = cachedPrs[number];
    if (!pr) {
      stale.push(number);
      added += 1;
    } else if (pr.updatedAt !== scope.updatedAt.get(number)) {
      stale.push(number);
      updated += 1;
    } else if (mayChangeWithoutUpdatedAt(pr)) {
      stale.push(number);
      unsettled += 1;
    } else if (
      pr.changedFiles == null ||
      pr.churn?.additions == null ||
      pr.churn?.deletions == null ||
      pr.churn?.total == null ||
      !pr.sizeFromChurn ||
      Object.hasOwn(pr.churn, 'size') ||
      Object.hasOwn(pr, 'size')
    ) {
      stale.push(number);
      missingDiff += 1;
    } else {
      reused += 1;
    }
  }

  logger.log(`fetching ${stale.length} of ${scope.relevant.size} PRs; reusing ${reused} cached PRs`);
  logger.log(
    `${added} new, ${updated} with changed timestamps, ${unsettled} with unchanged timestamps but unsettled CI or mergeability, ${missingDiff} missing current diff metadata`
  );
  return { stale, reused };
}

// CI and mergeability can change without updating the PR timestamp.
// Refresh pending or unknown states even when that timestamp matches the cache.
function mayChangeWithoutUpdatedAt(pr) {
  return UNSETTLED_CI.has(pr.ciStatus ?? '') || !pr.mergeable || pr.mergeable === 'UNKNOWN';
}

module.exports = { PrReportsPipeline, mayChangeWithoutUpdatedAt };
