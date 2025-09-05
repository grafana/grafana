#!/usr/bin/env node

const cp = require('node:child_process');
const fs = require('node:fs');

const JEST_CONFIG_PATH = 'jest.config.codeowner.js';
const CODEOWNERS_MANIFEST_TEAMS_PATH = 'codeowners-manifest/teams.json';

const teamName = process.argv[2];

if (!teamName) {
  console.error('Team argument is required ...');
  console.error('Usage: yarn test:coverage:by-codeowner @grafana/team-name');
  process.exit(1);
}

let teams = [];
try {
  const teamsJson = fs.readFileSync(CODEOWNERS_MANIFEST_TEAMS_PATH);
  teams = JSON.parse(teamsJson);
} catch (e) {
  console.error(`Could not parse ${CODEOWNERS_MANIFEST_TEAMS_PATH} ...`);
  console.error(e);
  process.exit(1);
}

if (!teams.includes(teamName)) {
  console.error(`Team ${teamName} was not found in ${CODEOWNERS_MANIFEST_TEAMS_PATH}, check spelling ...`);
  process.exit(1);
}

process.env.TEAM_NAME = teamName;

cp.spawn('jest', [`--config=${JEST_CONFIG_PATH}`], { stdio: 'inherit', shell: true });
