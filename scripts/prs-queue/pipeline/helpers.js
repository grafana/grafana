const { CliError } = require('../cli/cli');

const DEFAULT_TEAM_ORG = 'grafana';
const OWNER_NAME = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;

function parseRepo(value) {
  const match = String(value ?? '')
    .trim()
    .match(OWNER_NAME);
  if (!match) {
    throw new CliError(`invalid --repo: ${value ?? '(missing)'}`);
  }
  return { owner: match[1], name: match[2], repo: `${match[1]}/${match[2]}` };
}

function parseTeam(value) {
  const raw = String(value ?? '').trim();
  const withOrg = raw.match(OWNER_NAME);
  if (withOrg) {
    return { teamOrg: withOrg[1], teamSlug: withOrg[2] };
  }
  if (/^[A-Za-z0-9_.-]+$/.test(raw)) {
    return { teamOrg: DEFAULT_TEAM_ORG, teamSlug: raw };
  }
  throw new CliError(`invalid --team: ${value ?? '(missing)'}`);
}

function numbersIn(prs) {
  return new Set(prs.map((pr) => pr.number));
}

// Search results can overlap. Keep the newest timestamp to avoid reusing stale details.
function newestUpdatedAt(prs) {
  const byNumber = new Map();
  for (const { number, updatedAt } of prs) {
    const seen = byNumber.get(number);
    if (updatedAt && (!seen || updatedAt > seen)) {
      byNumber.set(number, updatedAt);
    }
  }
  return byNumber;
}

module.exports = { newestUpdatedAt, numbersIn, parseRepo, parseTeam };
