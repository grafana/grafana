/**
 * Convert raw GitHub values into shared display values for the reports.
 * Unknown states remain blank or absent. Contributor counts flag unknown associations.
 */
class PullRequestPresenter {
  // Accept a fixed time so reports and tests can reproduce the same durations.
  /**
   * @param {import('../types').NormalizedPr} pr
   * @param {Date} [now]
   * @returns {import('../types').PresentedPr}
   */
  present(pr, now = new Date()) {
    return {
      number: pr.number,
      title: pr.title ?? '',
      url: pr.url ?? '',
      author: pr.author ?? '',
      authorType: pr.authorType ? labelFor(pr.authorType) : '',
      status: reviewDecisionLabel(pr.status),
      mergeable: mergeableLabel(pr.mergeable),
      ciStatus: ciLabel(pr.ciStatus) || undefined,
      age: formatDuration(pr.createdAt, now),
      updated: formatDuration(pr.updatedAt, now),
      changedFiles: pr.changedFiles,
      churn: pr.churn?.total,
      sizeFromChurn: pr.sizeFromChurn,
      sizeFromLabels: pr.sizeFromLabels ?? '',
      fixes: presentFixes(pr.fixes),
      reviewers: pr.reviewers ?? [],
      labels: pr.labels ?? [],
    };
  }

  // Use one time for the whole queue so all ages are calculated consistently.
  /**
   * @param {import('../types').NormalizedPr[]} prs
   * @param {Date} [now]
   * @returns {import('../types').PresentedPr[]}
   */
  presentAll(prs, now = new Date()) {
    return prs.map((pr) => this.present(pr, now));
  }
}

const LABELS = {
  FIRST_TIME_CONTRIBUTOR: 'First-time contributor',
  FIRST_TIMER: 'First-timer',
  CONTRIBUTOR: 'Contributor',
  MEMBER: 'Member',
  COLLABORATOR: 'Collaborator',
  OWNER: 'Owner',
  NONE: 'None',
  MANNEQUIN: 'Mannequin',
};

const KNOWN_TYPES = Object.keys(LABELS);

function labelFor(authorType) {
  return LABELS[authorType] ?? authorType;
}

// Keep the raw name for unknown associations so the summary makes them visible.
function describeType(authorType) {
  return KNOWN_TYPES.includes(authorType) ? labelFor(authorType) : `${authorType} (unknown type)`;
}

// Keep the total even if the query returned only part of the issue list.
function presentFixes(fixes) {
  if (!fixes?.total) {
    return undefined;
  }
  return fixes.issues?.length ? { total: fixes.total, issues: fixes.issues } : { total: fixes.total };
}

function ciLabel(state) {
  if (state === 'SUCCESS') {
    return 'Pass';
  }
  if (state === 'FAILURE' || state === 'ERROR') {
    return 'Fail';
  }
  if (state === 'PENDING' || state === 'EXPECTED') {
    return 'Pending';
  }
  return '';
}

function reviewDecisionLabel(value) {
  if (value === 'APPROVED') {
    return 'Approved';
  }
  if (value === 'CHANGES_REQUESTED') {
    return 'Changes requested';
  }
  if (value === 'REVIEW_REQUIRED') {
    return 'Review required';
  }
  return '';
}

function mergeableLabel(value) {
  if (value === 'CONFLICTING') {
    return 'Conflicts';
  }
  if (value === 'MERGEABLE') {
    return 'Mergeable';
  }
  return value === 'UNKNOWN' ? 'Unknown' : '';
}

// Use short durations for scanning. Show at least 1m for a new PR.
function formatDuration(fromIso, now) {
  const ms = now.getTime() - Date.parse(fromIso);
  if (!Number.isFinite(ms) || ms < 0) {
    return '';
  }
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '1m';
}

module.exports = { PullRequestPresenter, describeType };
