#!/usr/bin/env node

const { AutoComplete } = require('enquirer');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const open = require('open').default;
const { hideBin } = require('yargs/helpers');
const yargs = require('yargs/yargs');

const { getCodeowners, buildCodeownerDirectoryPath } = require('./codeowners-manifest/utils.js');

const JEST_CONFIG_PATH = 'jest.config.codeowner.js';
const COVERAGE_SUMMARY_OUTPUT_PATH = './coverage-summary.json';

async function promptCodeownerName() {
  const teams = await getCodeowners();
  const prompt = new AutoComplete({
    name: 'flavor',
    message: 'Select your team to run tests by codeowner.',
    limit: 10,
    choices: teams.filter((team) => team.startsWith('@grafana/')),
  });
  return await prompt.run();
}

/**
 * Run test coverage for a specific codeowner
 * @param {string} codeownerName - The codeowner name to run coverage for
 * @param {boolean} noOpen - Whether to skip opening the coverage report in the browser
 */
async function runTestCoverageByCodeowner(codeownerName, noOpen = process.env.CI === 'true') {
  const teams = await getCodeowners();
  if (!teams.includes(codeownerName)) {
    throw new Error(`Codeowner "${codeownerName}" was not found.`);
  }

  process.env.CODEOWNER_NAME = codeownerName;
  process.env.SHOULD_OPEN_COVERAGE_REPORT = String(!noOpen);

  return new Promise((resolve, reject) => {
    const child = cp.spawn('jest', [`--config=${JEST_CONFIG_PATH}`], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start Jest: ${error.message}`));
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`Jest exited with code ${code}`));
        return;
      }

      try {
        writeCoverageSummaryArtifact(codeownerName);
        await maybeOpenCoverageReport(codeownerName, noOpen);
      } catch (err) {
        console.error(`Post-run coverage processing failed: ${err}`);
      }

      resolve();
    });
  });
}

/**
 * Reads the istanbul json-summary Jest wrote to the team's coverage dir and rewrites it into the
 * per-team summary artifact consumed by compare-coverage-by-codeowner.js and grafana-bench.
 * @param {string} codeownerName
 */
function writeCoverageSummaryArtifact(codeownerName) {
  const outputDir = path.join('./coverage/by-team', buildCodeownerDirectoryPath(codeownerName));
  const istanbulSummaryPath = path.join(outputDir, 'coverage-summary.json');

  if (!fs.existsSync(istanbulSummaryPath)) {
    console.error(`Coverage summary not found at ${istanbulSummaryPath}`);
    return;
  }

  const istanbulSummary = JSON.parse(fs.readFileSync(istanbulSummaryPath, 'utf8'));
  const pctOnly = (metrics) => ({
    lines: { pct: metrics.lines.pct },
    statements: { pct: metrics.statements.pct },
    functions: { pct: metrics.functions.pct },
    branches: { pct: metrics.branches.pct },
  });

  const files = {};
  for (const [filePath, metrics] of Object.entries(istanbulSummary)) {
    if (filePath === 'total') {
      continue;
    }
    const relativePath = filePath.replace(process.cwd() + '/', '');
    files[relativePath] = pctOnly(metrics);
  }

  const summary = {
    team: codeownerName,
    commit: process.env.GITHUB_SHA || 'unknown',
    timestamp: new Date().toISOString(),
    summary: pctOnly(istanbulSummary.total),
    files,
  };

  try {
    fs.writeFileSync(COVERAGE_SUMMARY_OUTPUT_PATH, JSON.stringify(summary, null, 2));
    console.log(`📊 Coverage summary written to ${COVERAGE_SUMMARY_OUTPUT_PATH}`);
  } catch (err) {
    console.error(`Failed to write coverage summary: ${err}`);
  }
}

/**
 * Logs the HTML report location and opens it in the default browser unless disabled.
 * @param {string} codeownerName
 * @param {boolean} noOpen
 */
async function maybeOpenCoverageReport(codeownerName, noOpen) {
  const outputDir = path.join('./coverage/by-team', buildCodeownerDirectoryPath(codeownerName));
  const reportURL = `file://${path.resolve(outputDir)}/html/index.html`;
  console.log(`📄 Coverage report saved to ${reportURL}`);

  if (noOpen) {
    return;
  }

  try {
    await open(reportURL);
  } catch (err) {
    console.error(`Failed to open coverage report: ${err}`);
  }
}

if (require.main === module) {
  (async () => {
    try {
      const argv = yargs(hideBin(process.argv)).parse();
      const teams = await getCodeowners();
      let codeownerName = argv._[0];
      if (codeownerName != null && !teams.includes(codeownerName)) {
        const msg = `Codeowner "${codeownerName}" was not found.`;
        codeownerName = null;
        if (process.env.CI === 'true') {
          throw new Error(msg);
        } else {
          console.warn(`⚠️ ${msg}`);
        }
      }

      if (!codeownerName) {
        codeownerName = await promptCodeownerName();
      }

      const noOpen = argv['open'] === false;

      console.log(`🧪 Running test coverage for codeowner: ${codeownerName}`);
      await runTestCoverageByCodeowner(codeownerName, noOpen);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  })();
}

module.exports = { runTestCoverageByCodeowner };
