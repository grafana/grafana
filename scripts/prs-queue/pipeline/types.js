/**
 * @typedef {Object} Issue
 * @property {number} number
 * @property {string} url
 * @property {string[]} [type]
 * @property {number} [comments]
 *
 * @typedef {Object} Fixes
 * @property {number} total GitHub's total, which may exceed the returned issue count.
 * @property {Issue[]} [issues]
 *
 * @typedef {Object} NormalizedPr Raw GitHub values stored in the cache; missing details are optional.
 * @property {number} number
 * @property {string} [title]
 * @property {string} [url]
 * @property {string|null} [author]
 * @property {string} [authorType] Raw association, such as MEMBER.
 * @property {string} [status] Raw review decision, such as APPROVED.
 * @property {string} [mergeable]
 * @property {string} [ciStatus] Raw rollup state, such as SUCCESS; empty means missing.
 * @property {string} [createdAt] ISO timestamp.
 * @property {string} [updatedAt] ISO timestamp used for cache freshness.
 * @property {number} [changedFiles]
 * @property {{additions?: number, deletions?: number, total?: number}} [churn] Line counts and their sum in the current diff.
 * @property {string} [sizeFromChurn] Size category computed from additions plus deletions.
 * @property {string} [sizeFromLabels]
 * @property {string[]} [reviewers]
 * @property {string[]} [labels]
 * @property {Fixes} [fixes]
 *
 * @typedef {Object} PresentedPr Display values for renderers; never written to the cache.
 * @property {number} number
 * @property {string} title
 * @property {string} url
 * @property {string} author
 * @property {string} authorType Display label, such as Member.
 * @property {string} status Display label, such as Approved, or blank.
 * @property {string} mergeable
 * @property {'Pass'|'Fail'|'Pending'} [ciStatus]
 * @property {string} age Short duration, such as 2d, or blank.
 * @property {string} updated Short duration since the last update, or blank.
 * @property {number} [changedFiles]
 * @property {number} [churn] Precomputed total from normalization.
 * @property {string} [sizeFromChurn] Size category from normalization.
 * @property {string} sizeFromLabels
 * @property {string[]} reviewers
 * @property {string[]} labels
 * @property {Fixes} [fixes]
 *
 * @typedef {Object} Scope
 * @property {Set<string>} members
 * @property {Set<number>} createdByTeamMembers
 * @property {{fromTeam: Set<number>, fromIndividualMember: Set<number>}} reviewRequests
 * @property {Set<number>} relevant
 * @property {Map<number, string>} updatedAt
 *
 * @typedef {{single: true}} SingleRun
 * @typedef {{single: false, scope: Scope, added: number, removed: number, refetched: number, reused: number}} QueueRun
 * @typedef {(SingleRun|QueueRun) & {prs: NormalizedPr[]}} NormalizedRun
 * @typedef {(SingleRun|QueueRun) & {entries: Array<{node: Object|undefined, cached: NormalizedPr}>}} FetchedRun
 * @typedef {{type: string, count: number}} Contribution Display description and count, in contributor rank order.
 * @typedef {{run: NormalizedRun, prs: PresentedPr[], contributions: Contribution[], generatedAt: string}} PresentedReport
 */

module.exports = {};
