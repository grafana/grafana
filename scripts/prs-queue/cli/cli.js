const DEFAULT_REPO = 'grafana/grafana';
const DEFAULT_TEAM = 'dashboards-squad';

// Accept PR URLs copied from tabs such as /files, including query strings and fragments.
const PR_URL = /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/;

class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliError';
  }
}

function parsePrUrl(value) {
  const match = String(value ?? '')
    .trim()
    .match(PR_URL);
  if (!match) {
    throw new CliError(`invalid --pr: ${value ?? '(missing)'}`);
  }
  return { repo: `${match[1]}/${match[2]}`, number: Number(match[3]) };
}

function normalizeFormat(value) {
  if (value === 'json' || value === 'markdown') {
    return value;
  }
  throw new CliError(`invalid --format: ${value ?? '(missing)'}`);
}

// `format` starts absent so a single-PR run can tell "not given" from an explicit `--format`.
function parseArgs(argv) {
  const opts = { format: null, repo: DEFAULT_REPO, team: DEFAULT_TEAM, pr: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--format') {
      opts.format = normalizeFormat(argv[(i += 1)]);
    } else if (arg.startsWith('--format=')) {
      opts.format = normalizeFormat(arg.slice('--format='.length));
    } else if (arg === '--repo') {
      opts.repo = argv[(i += 1)];
    } else if (arg.startsWith('--repo=')) {
      opts.repo = arg.slice('--repo='.length);
    } else if (arg === '--team') {
      opts.team = argv[(i += 1)];
    } else if (arg.startsWith('--team=')) {
      opts.team = arg.slice('--team='.length);
    } else if (arg === '--pr') {
      opts.pr = parsePrUrl(argv[(i += 1)]);
    } else if (arg.startsWith('--pr=')) {
      opts.pr = parsePrUrl(arg.slice('--pr='.length));
    } else if (arg.startsWith('-')) {
      throw new CliError(`unknown option: ${arg}`);
    } else {
      throw new CliError(`unexpected argument: ${arg}`);
    }
  }

  // Single-PR output is JSON only. Its URL supplies the repository and overrides --repo.
  if (opts.pr) {
    if (opts.format === 'markdown') {
      throw new CliError('--pr supports --format json only');
    }
    opts.repo = opts.pr.repo;
    opts.format = 'json';
  }

  opts.format = opts.format ?? 'markdown';
  return opts;
}

function helpText() {
  return `Usage: node pr-reports.js [options]

Refresh the open PR queue for a GitHub team, or read a single PR.

Options:
  --format json|markdown   Output format (default: markdown)
  --repo owner/name        Repository (default: grafana/grafana)
  --team [org/]slug        Team (default: grafana/dashboards-squad)
  --pr <url>               One PR by URL, as a single compact JSON object. Implies --format json,
                           and takes its repo from the URL. Reads no team, no cache, writes no file.
  -h, --help               Show this help

Formats:
  json        Compact JSON on stdout, for agents. Does not write the markdown file.
  markdown    Write output/reports/open-prs@<encoded-repo>@<encoded-team>.md
              Repo and team use URI component encoding (for example, o/n becomes o%2Fn).
`;
}

module.exports = { CliError, helpText, parseArgs };
