const { MarkdownReport } = require('./markdown/MarkdownReport');

// Cells use presented values so formatting stays consistent across reports.
const PR_TABLE_COLUMNS = [
  { header: '#', cell: (pr, index) => index + 1 },
  { header: 'Status', cell: (pr) => pr.status },
  { header: 'Mergeable', cell: (pr) => pr.mergeable },
  { header: 'CI', cell: (pr) => pr.ciStatus ?? '' },
  { header: 'Age', cell: (pr) => pr.age },
  // "ago" is this table's wording, not part of the duration: the JSON field says `1h` on its own.
  { header: 'Last Updated', cell: (pr) => (pr.updated ? `${pr.updated} ago` : '') },
  { header: 'PR', cell: (pr) => `[${PrReport.esc(pr.title)}](${pr.url})` },
  {
    header: 'Author',
    cell: (pr) => (pr.author ? `[${PrReport.esc(pr.author)}](${PrReport.authorProfileUrl(pr.author)})` : '(none)'),
  },
  { header: 'Contributor type', cell: (pr) => pr.authorType },
  { header: 'Files changed', cell: (pr) => pr.changedFiles ?? '' },
  { header: 'Churn', cell: (pr) => pr.churn ?? '' },
  { header: 'Size from churn', cell: (pr) => PrReport.esc(pr.sizeFromChurn ?? '') },
  { header: 'Size from labels', cell: (pr) => PrReport.esc(pr.sizeFromLabels ?? '') },
  { header: 'Fixes / unblocks', cell: (pr) => PrReport.fixesCell(pr.fixes) },
  { header: 'Issue comments', cell: (pr) => PrReport.issueCommentsCell(pr.fixes) },
  { header: 'Reviewers', cell: (pr) => pr.reviewers.map(PrReport.esc).join(', ') },
  { header: 'Labels', cell: (pr) => pr.labels.map(PrReport.esc).join(', ') },
];

class PrReport {
  #config;

  constructor(config) {
    this.#config = config;
  }

  /** @param {import('../types').PresentedReport} report */
  render({ prs, run: { scope }, contributions, generatedAt: stamp }) {
    const config = this.#config;
    return new MarkdownReport({ title: 'Open PR contributors', tableColumns: PR_TABLE_COLUMNS }).render({
      sections: [
        `Source: [${config.repo} pull requests](https://github.com/${config.repo}/pulls)`,
        `Generated ${stamp.slice(0, 10)} @${stamp.slice(11, 19)}`,
        `${prs.length} open PRs from [@${config.team}](https://github.com/orgs/${config.teamOrg}/teams/${config.teamSlug}) (${scope.members.size} members), authored by a member, or requesting review from that team or a member.`,
        'Contributions:',
        contributions.map(({ type, count }) => `- ${type}: ${count}`).join('\n'),
      ],
      rows: prs,
    });
  }

  static authorProfileUrl(login) {
    const url = new URL('https://github.com');
    url.pathname = `/${login}`;
    return url.toString();
  }

  static esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  // Use line breaks for multiple issues inside a table cell.
  // Show how many issues are missing when the fetched list is incomplete.
  /** @param {import('../types').Fixes|undefined} fixes */
  static fixesCell(fixes) {
    if (!fixes?.total) {
      return '';
    }
    const items = (fixes.issues ?? []).map((issue, index) => {
      const link = `${index + 1}. [#${issue.number}](${issue.url})`;
      const type = (issue.type ?? []).map(PrReport.esc).join(', ');
      return type ? `${link} (${type})` : link;
    });
    if (items.length < fixes.total) {
      items.push(`displaying ${items.length} of ${fixes.total}`);
    }
    return items.join('<br>');
  }

  // Keep the same numbering as the fixes column, even when an issue has no comment count.
  static issueCommentsCell(fixes) {
    return (fixes?.issues ?? [])
      .flatMap((issue, index) =>
        issue.comments == null ? [] : [`${index + 1}. [#${issue.number}](${issue.url}): ${issue.comments}`]
      )
      .join('<br>');
  }
}

module.exports = { PrReport };
