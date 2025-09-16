#!/usr/bin/env node

const cp = require('node:child_process');
const fs = require('node:fs');

const { TEAMS_JSON_PATH: CODEOWNERS_MANIFEST_TEAMS_PATH } = require('./codeowners-manifest/constants.js');

const JEST_CONFIG_PATH = 'jest.config.codeowner.js';

/**
 * Run test coverage for a specific team
 * @param {string} teamName - The team name to run coverage for
 * @param {string} teamsPath - Path to the teams.json file
 * @param {string} jestConfigPath - Path to the Jest config file
 */
function runTestCoverageByTeam(teamName, teamsPath, jestConfigPath) {
  const teamsJson = fs.readFileSync(teamsPath);
  const teams = JSON.parse(teamsJson);

  if (!teams.includes(teamName)) {
    throw new Error(`Team ${teamName} was not found in ${teamsPath}, check spelling`);
  }

  process.env.TEAM_NAME = teamName;

  cp.spawn('jest', [`--config=${jestConfigPath}`], { stdio: 'inherit', shell: true });
}

if (require.main === module) {
  const teamName = process.argv[2];

  if (!teamName) {
    console.error('Team argument is required ...');
    console.error('Usage: yarn test:coverage:by-codeowner @grafana/team-name');
    process.exit(1);
  }

  try {
    runTestCoverageByTeam(teamName, CODEOWNERS_MANIFEST_TEAMS_PATH, JEST_CONFIG_PATH);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`Could not read ${CODEOWNERS_MANIFEST_TEAMS_PATH} ...`);
    } else {
      console.error(e.message);
    }
    process.exit(1);
  }
}

module.exports = { runTestCoverageByTeam };
