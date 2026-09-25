const fs = require('fs/promises');
const path = require('path');

const { logger } = require('../../logger/logger');
const { PrReport } = require('../renderers/PrReport');
const { CompactJsonReport } = require('../renderers/compact/CompactJsonReport');
const { SummaryReport } = require('../renderers/summary/SummaryReport');

class ReportOutput {
  #files;
  #stdout;
  #logger;

  constructor({ files = fs, stdout = process.stdout, diagnostics = logger } = {}) {
    this.#files = files;
    this.#stdout = stdout;
    this.#logger = diagnostics;
  }

  /** @param {import('../types').PresentedPr} pr */
  writePr(pr) {
    this.#stdout.write(CompactJsonReport.renderPr(pr));
  }

  /**
   * @param {Object} config
   * @param {import('../types').PresentedPr[]} prs
   */
  writeJson(config, prs) {
    this.#stdout.write(new CompactJsonReport(config).render({ prs }));
  }

  /**
   * @param {Object} config
   * @param {import('../types').PresentedReport} report
   * @param {string|null} cachePath
   */
  async writeMarkdown(config, report, cachePath) {
    const markdown = new PrReport(config).render(report);
    await this.#files.mkdir(path.dirname(config.outputPath), { recursive: true });
    await this.#files.writeFile(config.outputPath, markdown);
    this.#logger.log(`wrote ${path.relative(config.root, config.outputPath)}`);

    const summary = new SummaryReport({
      repo: config.repo,
      team: config.team,
      cachePath: cachePath == null ? null : path.relative(config.root, cachePath),
      outputPath: path.relative(config.root, config.outputPath),
    });
    this.#stdout.write(summary.render(report));
  }
}

module.exports = { ReportOutput };
