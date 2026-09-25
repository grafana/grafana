/**
 * Render presented PRs as compact JSON, omitting empty fields.
 */
class CompactJsonReport {
  #repo;
  #team;

  constructor({ repo, team }) {
    this.#repo = repo;
    this.#team = team;
  }

  // A single PR has no queue summary, and its URL already identifies the repository.
  /** @param {import('../../types').PresentedPr} pr */
  static renderPr(pr) {
    return JSON.stringify(dropEmpty(pr)) + '\n';
  }

  /** @param {{prs: import('../../types').PresentedPr[]}} report */
  render({ prs }) {
    const payload = {
      repo: this.#repo,
      team: this.#team,
      total: prs.length,
      prs: prs.map(dropEmpty),
    };
    return JSON.stringify(payload) + '\n';
  }
}

// Omit empty fields to keep JSON compact; Markdown uses blank cells for these values.
function dropEmpty(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => !isEmpty(value)));
}

function isEmpty(value) {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

module.exports = { CompactJsonReport };
