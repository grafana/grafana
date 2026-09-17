/**
 * Build a new cache record from a GitHub PR, using cached values where supported fields are omitted.
 * Keep raw GitHub states for freshness checks; the presenter supplies readable labels.
 */

const MEDIUM_CHURN_MIN = 50;
const LARGE_CHURN_MIN = 600;

class PullRequestNormalizer {
  // Include the organization because a team slug alone is not unique.
  #teamOrg;

  constructor({ teamOrg }) {
    this.#teamOrg = teamOrg;
  }

  // GitHub logins are case-insensitive, so one canonical form is stored and returned.
  static normalizeLogins(logins) {
    const seen = new Set(logins.map((login) => login.trim().toLowerCase()).filter(Boolean));
    return [...seen].sort();
  }

  // Readiness nodes omit PR metadata; issue types still need the cached PR labels as a fallback.
  fromReadiness(node, cached) {
    return withoutUndefined({
      ...cached,
      mergeable: node.mergeable ?? 'UNKNOWN',
      status: node.reviewDecision ?? '',
      ciStatus: node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? '',
      fixes: fixesFrom(node, cached.labels ?? [], cached),
    });
  }

  // New PRs and single-PR runs may have only a number in the cached record.
  /**
   * @param {Object} node GitHub GraphQL PR details.
   * @param {import('../types').NormalizedPr} cached
   * @returns {import('../types').NormalizedPr}
   */
  fromGraphQL(node, cached) {
    const author = node.author !== undefined ? (node.author?.login ?? null) : cached.author;
    const prLabels = labelNames(node.labels);
    const additions = node.additions ?? cached.churn?.additions;
    const deletions = node.deletions ?? cached.churn?.deletions;
    const total = additions != null && deletions != null ? additions + deletions : undefined;

    return withoutUndefined({
      number: node.number ?? cached.number,
      title: node.title || cached.title,
      url: node.url || cached.url,
      author,
      authorType: node.authorAssociation || cached.authorType,
      reviewers: this.#reviewersFrom(node, author),
      changedFiles: node.changedFiles ?? cached.changedFiles,
      churn: additions != null || deletions != null ? withoutUndefined({ additions, deletions, total }) : undefined,
      sizeFromChurn: sizeFromChurn(total),
      sizeFromLabels:
        node.labels === undefined
          ? (cached.sizeFromLabels ?? cached.size)
          : prLabels.find((name) => name.startsWith('size/')),
      labels: prLabels,
      fixes: fixesFrom(node, prLabels, cached),
      mergeable: node.mergeable || cached.mergeable,
      // Use the fetched states: an approval can be dismissed and a CI result can disappear.
      status: node.reviewDecision ?? '',
      ciStatus: node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? '',
      createdAt: node.createdAt || cached.createdAt,
      updatedAt: node.updatedAt || cached.updatedAt,
    });
  }

  // GitHub is case-insensitive about logins, so the author check and the dedupe both are too.
  #reviewersFrom(node, author) {
    const names = [];
    const seen = new Set([(author ?? '').toLowerCase()]);

    const add = (name) => {
      if (!name || seen.has(name.toLowerCase())) {
        return;
      }
      seen.add(name.toLowerCase());
      names.push(name);
    };

    for (const review of node.latestReviews?.nodes ?? []) {
      add(review.author?.login);
    }
    for (const request of node.reviewRequests?.nodes ?? []) {
      const reviewer = request.requestedReviewer;
      add(reviewer?.login ?? (reviewer?.slug ? `${this.#teamOrg}/${reviewer.slug}` : null));
    }
    return names;
  }
}

function sizeFromChurn(total) {
  if (total == null) {
    return undefined;
  }
  return total < MEDIUM_CHURN_MIN ? 'size/small' : total < LARGE_CHURN_MIN ? 'size/medium' : 'size/large';
}

function labelNames(labels) {
  return (labels?.nodes ?? []).map((label) => label.name);
}

// A fetched total of zero clears cached issues; an omitted total preserves them.
// Keep the total separately because the query may return only some of the issues.
function fixesFrom(node, prLabels, cached) {
  const closing = node.closingIssuesReferences;
  if (closing?.totalCount == null) {
    return cached.fixes;
  }

  const issues = (closing.nodes ?? [])
    .filter((issue) => issue.number && issue.url)
    .map((issue) => issueRow(issue, prLabels));

  return { total: closing.totalCount, issues };
}

// Keep comment counts per issue so each discussion remains visible.
function issueRow(issue, prLabels) {
  const row = { number: issue.number, url: issue.url };
  const type = typesForIssue(issue, prLabels);
  if (type.length) {
    row.type = type;
  }
  if (issue.comments?.totalCount != null) {
    row.comments = issue.comments.totalCount;
  }
  return row;
}

// The PR's own labels are a fallback for an issue that is untyped, not an addition to one that is.
function typesForIssue(issue, prLabels) {
  const types = [];
  const seen = new Set();

  function add(value) {
    if (!value || seen.has(value.toLowerCase())) {
      return;
    }
    seen.add(value.toLowerCase());
    types.push(value);
  }

  function addTypeLabels(names) {
    for (const name of names) {
      if (typeof name === 'string' && name.startsWith('type/')) {
        add(name);
      }
    }
  }

  add(issue.issueType?.name);
  addTypeLabels(labelNames(issue.labels));
  if (types.length === 0) {
    addTypeLabels(prLabels);
  }
  return types;
}

// Remove undefined fields so the in-memory record matches its JSON form.
function withoutUndefined(pr) {
  return Object.fromEntries(Object.entries(pr).filter(([, value]) => value !== undefined));
}

module.exports = { PullRequestNormalizer };
