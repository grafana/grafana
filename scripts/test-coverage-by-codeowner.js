#!/usr/bin/env node

const cp = require('node:child_process');
const fs = require('node:fs');

const { CODEOWNERS_JSON_PATH: CODEOWNERS_MANIFEST_CODEOWNERS_PATH } = require('./codeowners-manifest/constants.js');

const JEST_CONFIG_PATH = 'jest.config.codeowner.js';

/**
 * Run test coverage for a specific codeowner
 * @param {string} codeownerName - The codeowner name to run coverage for
 * @param {string} codeownersPath - Path to the teams.json file
 * @param {string} jestConfigPath - Path to the Jest config file
 */
function runTestCoverageByCodeowner(codeownerName, codeownersPath, jestConfigPath) {
  const codeownersJson = fs.readFileSync(codeownersPath);
  const codeowners = JSON.parse(codeownersJson);

  if (!codeowners.includes(codeownerName)) {
    throw new Error(`Codeowner ${codeownerName} was not found in ${codeownersPath}, check spelling`);
  }

  process.env.TEAM_NAME = codeownerName;

  cp.spawn('jest', [`--config=${jestConfigPath}`], { stdio: 'inherit', shell: true });
}

if (require.main === module) {
  const codeownerName = process.argv[2];

  if (!codeownerName) {
    console.error('Codeowner argument is required ...');
    console.error('Usage: yarn test:coverage:by-codeowner @grafana/team-name');
    process.exit(1);
  }

  try {
    console.log(`🧪 Running test coverage for codeowner: ${codeownerName}`);
    runTestCoverageByCodeowner(codeownerName, CODEOWNERS_MANIFEST_CODEOWNERS_PATH, JEST_CONFIG_PATH);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`Could not read ${CODEOWNERS_MANIFEST_CODEOWNERS_PATH} ...`);
    } else {
      console.error(e.message);
    }
    process.exit(1);
  }
}

module.exports = { runTestCoverageByCodeowner };
