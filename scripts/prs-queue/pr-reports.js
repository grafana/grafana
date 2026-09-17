#!/usr/bin/env node

const { GithubApiClient } = require('./api/GithubApiClient');
const { FileCacheClient } = require('./cache/FileCacheClient');
const { CliError, helpText, parseArgs } = require('./cli/cli');
const { logger } = require('./logger/logger');
const { PrReportsPipeline } = require('./pipeline/PrReportsPipeline');
const { ReportOutput } = require('./pipeline/io/ReportOutput');
const { PullRequestNormalizer } = require('./pipeline/normalizer/PullRequestNormalizer');
const { PullRequestPresenter } = require('./pipeline/presenter/PullRequestPresenter');

async function main(argv) {
  const startedAt = Date.now();

  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }

  const config = PrReportsPipeline.configFor(options.repo, options.team);

  const cacheEnabled = !options.noCache && !options.pr;
  const cache = new FileCacheClient({ dir: config.prsCacheDir, enabled: cacheEnabled });
  const membersCache = new FileCacheClient({ dir: config.membersCacheDir, enabled: cacheEnabled });
  if (options.refreshCache && !options.pr) {
    await Promise.all([cache.delete(config.cacheKey), membersCache.delete(config.membersCacheKey)]);
  }

  const api = new GithubApiClient({
    owner: config.owner,
    name: config.name,
    repo: config.repo,
    teamOrg: config.teamOrg,
    teamSlug: config.teamSlug,
    membersCacheKey: config.membersCacheKey,
    cache: membersCache,
  });
  const normalizer = new PullRequestNormalizer({ teamOrg: config.teamOrg });
  const presenter = new PullRequestPresenter();

  const pipeline = new PrReportsPipeline({ api, cache, normalizer, presenter, output: new ReportOutput() });

  logger.log(
    options.pr
      ? `start ${config.repo}#${options.pr.number}`
      : `start ${config.repo} ${config.team} format=${options.format}`
  );

  await pipeline.run(config, options);

  logger.log(`done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    if (!(error instanceof CliError)) {
      throw error;
    }
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = { main };
