#!/usr/bin/env node

const cp = require('node:child_process');
const { readFile } = require('node:fs/promises');

const { CODEOWNERS_JSON_PATH: CODEOWNERS_MANIFEST_CODEOWNERS_PATH } = require('./codeowners-manifest/constants.js');

const JEST_CONFIG_PATH = 'jest.config.codeowner.js';

/**
 * Run test coverage for a specific codeowner
 * @param {string} codeownerName - The codeowner name to run coverage for
 * @param {string} codeownersPath - Path to the teams.json file
 * @param {string} jestConfigPath - Path to the Jest config file
 */
async function runTestCoverageByCodeowner(codeownerName, codeownersPath, jestConfigPath) {
  const codeownersJson = await readFile(codeownersPath, 'utf8');
  const codeowners = JSON.parse(codeownersJson);

  if (!codeowners.includes(codeownerName)) {
    throw new Error(`Codeowner ${codeownerName} was not found in ${codeownersPath}, check spelling`);
  }

  process.env.TEAM_NAME = codeownerName;

  return new Promise((resolve, reject) => {
    const child = cp.spawn('jest', [`--config=${jestConfigPath}`], { stdio: 'inherit', shell: true });

    child.on('error', (error) => {
      reject(new Error(`Failed to start Jest: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Jest exited with code ${code}`));
      }
    });
  });
}

if (require.main === module) {
  (async () => {
    try {
      const codeownerName = process.argv[2];

      if (!codeownerName) {
        console.error('Codeowner argument is required ...');
        console.error('Usage: yarn test:coverage:by-codeowner @grafana/team-name');
        process.exit(1);
      }

      console.log(`🧪 Running test coverage for codeowner: ${codeownerName}`);
      await runTestCoverageByCodeowner(codeownerName, CODEOWNERS_MANIFEST_CODEOWNERS_PATH, JEST_CONFIG_PATH);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.error(`Could not read ${CODEOWNERS_MANIFEST_CODEOWNERS_PATH} ...`);
      } else {
        console.error(e.message);
      }
      process.exit(1);
    }
  })();
}

module.exports = { runTestCoverageByCodeowner };
