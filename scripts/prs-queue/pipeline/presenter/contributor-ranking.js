/**
 * Rank and count raw GitHub contributor associations, with first-time contributors first.
 */

const RANK = {
  FIRST_TIME_CONTRIBUTOR: 0,
  FIRST_TIMER: 0,
  CONTRIBUTOR: 1,
  MEMBER: 2,
};

// Unknown associations sort after the supported contributor types.
const UNKNOWN_RANK = 3;

function rankOf(authorType) {
  return RANK[authorType] ?? UNKNOWN_RANK;
}

// Count and sort raw associations before converting them to display labels.
function contributorCounts(prs) {
  const counts = new Map();
  for (const pr of prs) {
    counts.set(pr.authorType, (counts.get(pr.authorType) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => rankOf(a) - rankOf(b)).map(([type, count]) => ({ type, count }));
}

module.exports = { contributorCounts, rankOf };
