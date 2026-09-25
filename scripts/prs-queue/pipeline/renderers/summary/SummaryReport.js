/**
 * Render queue counts, cache activity, and output paths as JSON.
 * Contribution counts are prepared once by the pipeline and shared by both reports.
 */
class SummaryReport {
  #repo;
  #team;
  #cachePath;
  #outputPath;

  // Accept display paths so this renderer does not need to know the folder layout.
  constructor({ repo, team, cachePath, outputPath }) {
    this.#repo = repo;
    this.#team = team;
    this.#cachePath = cachePath;
    this.#outputPath = outputPath;
  }

  /** @param {import('../../types').PresentedReport} report */
  render({ run: { prs, scope, added, removed, refetched, reused }, contributions }) {
    const payload = {
      repo: this.#repo,
      team: this.#team,
      members: [...scope.members].sort(),
      // Searches overlap, so count unique PRs rather than adding the search totals.
      prs: {
        total: prs.length,
        createdByTeamMembers: scope.createdByTeamMembers.size,
        reviewRequests: {
          fromTeam: scope.reviewRequests.fromTeam.size,
          fromIndividualMember: scope.reviewRequests.fromIndividualMember.size,
        },
      },
      contributions: Object.fromEntries(contributions.map(({ type, count }) => [type, count])),
      cache: {
        refetched,
        reused,
        added,
        removed,
        path: this.#cachePath,
      },
      output: this.#outputPath,
    };
    return JSON.stringify(payload, null, 2) + '\n';
  }
}

module.exports = { SummaryReport };
