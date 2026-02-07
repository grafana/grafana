# Release Process

This document describes the automated release process for nanogit.

## Overview

nanogit uses an automated release pipeline powered by [semantic-release](https://semantic-release.gitbook.io/) and GitHub Actions. Releases are triggered automatically when changes are merged to the `main` branch, with version bumps determined by [Conventional Commit](https://www.conventionalcommits.org/) messages.

## How It Works

### Automatic Versioning

The release system analyzes commit messages to determine the version bump:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `fix:` | Patch | v0.1.0 → v0.1.1 |
| `feat:` | Minor | v0.1.0 → v0.2.0 |
| `feat!:` or `BREAKING CHANGE:` | Major | v0.1.0 → v1.0.0 |
| `perf:` | Patch | v0.1.0 → v0.1.1 |
| `docs:`, `chore:`, `ci:`, etc. | No release | - |

### Release Workflow

When a PR is merged to `main`:

1. **CI Checks Run**: All tests, linting, and security checks must pass
2. **Semantic Release Activates**: The release workflow analyzes commits since the last release
3. **Version Determined**: Based on commit message types
4. **Tag Created**: Git tag is created with the new version (e.g., `v0.1.0`)
5. **GitHub Release**: Release is published with auto-generated release notes
6. **CHANGELOG PR Created**: Workflow creates a new branch with updated CHANGELOG.md
7. **Auto-Merge Enabled**: PR is set to auto-merge once CI passes
8. **CHANGELOG PR Merges**: After CI passes, PR merges automatically
9. **pkg.go.dev Updated**: Go module proxy automatically indexes the new version

**Note**: The CHANGELOG update happens via an automated PR (not direct push) to respect branch protection rules. This PR will auto-merge if CI passes and auto-merge is enabled in repository settings.

### Multiple Commits in a PR

When a PR contains multiple commits, the **highest version bump wins**:

```
fix: bug 1        → Patch
feat: feature 1   → Minor  (wins)
fix: bug 2        → Patch
→ Result: Minor release
```

```
feat: feature 1   → Minor
feat!: breaking   → Major  (wins)
fix: bug 1        → Patch
→ Result: Major release
```

## Release Configuration

### Repository Setup (One-Time)

For the automated CHANGELOG PR workflow to work, you must enable auto-merge in your repository:

1. Go to **Settings** → **General**
2. Scroll to **Pull Requests** section
3. Check ✅ **Allow auto-merge**
4. Save changes

Without this setting, CHANGELOG PRs will be created but won't auto-merge.

### Files

- **`.releaserc.json`**: Semantic-release configuration
- **`.github/workflows/release.yml`**: Release automation workflow
- **`CHANGELOG.md`**: Auto-generated changelog (updated via automated PRs)

### Workflow Permissions

The release workflow requires:
- `contents: write` - To create tags, branches, and push commits
- `issues: write` - To interact with issues (if needed by semantic-release)
- `pull-requests: write` - To create PRs and enable auto-merge

## For Maintainers

### Merging PRs

When reviewing and merging PRs:

1. **Check Commit Messages**: Ensure they follow conventional commit format
2. **Verify Type**: Confirm the commit type matches the actual change
   - `feat:` for new features
   - `fix:` for bug fixes
   - Breaking changes properly marked with `!` or `BREAKING CHANGE:`
3. **Squash and Merge**: Use squash merge to create a clean commit history
4. **Edit Commit Message**: GitHub allows editing the squashed commit message before merging

### Expected Behavior

After merging to `main`:

1. CI completes (~5-10 minutes)
2. Release workflow runs (~2-3 minutes)
3. New release appears in [Releases](https://github.com/grafana/nanogit/releases)
4. CHANGELOG PR is created automatically (e.g., `chore/changelog-v0.1.0`)
5. CHANGELOG PR auto-merges after CI passes (~5-10 minutes)
6. pkg.go.dev indexes the new version (5-15 minutes)

### When No Release Occurs

A release won't be created if:
- All commits are non-release types (`docs:`, `chore:`, `ci:`, etc.)
- Commit message contains `[skip ci]` or `[skip release]`
- Commits don't follow conventional commit format
- Release workflow fails (CI must pass first)

### Troubleshooting

#### Release Didn't Trigger

1. Check the [Actions tab](https://github.com/grafana/nanogit/actions/workflows/release.yml)
2. Verify commit messages follow conventional commits
3. Check if CI jobs passed
4. Look for `[skip ci]` in commit messages

#### Wrong Version Bump

1. Review the merged commit messages
2. Verify commit types match the changes
3. Check for `!` or `BREAKING CHANGE:` in commits

#### Release Failed

1. Check workflow logs in Actions tab
2. Common issues:
   - CI checks failed
   - Network issues with npm packages
   - GitHub token permissions

#### CHANGELOG PR Not Auto-Merging

**Problem**: CHANGELOG PR is created but doesn't auto-merge

**Solutions**:
1. **Check auto-merge is enabled**: Settings → General → Pull Requests → "Allow auto-merge"
2. **Verify CI passed**: Check that all CI checks completed successfully on the CHANGELOG PR
3. **Check branch protection**: Ensure branch protection allows auto-merge
4. **Manual merge**: If needed, manually merge the CHANGELOG PR

**Note**: The CHANGELOG PR runs full CI checks (including zizmor and other security scans). This is safe because `chore:` commits do not trigger releases per the semantic-release configuration, so no new release cycle is created. All branch protection requirements will be satisfied before auto-merge.

## Manual Release (Emergency)

In rare cases where automatic release fails, you can trigger a manual release:

### Option 1: Fix and Re-trigger

1. Fix the issue (e.g., correct commit message)
2. Create a new commit to `main`
3. Workflow will run again

### Option 2: Manual Tag (Not Recommended)

Only use this as a last resort:

```bash
# Determine next version
git fetch --tags
git describe --tags --abbrev=0  # Shows last tag

# Create and push tag
git tag v0.1.1
git push origin v0.1.1

# Manually create GitHub release
gh release create v0.1.1 --generate-notes
```

**Note**: Manual tags bypass CHANGELOG generation. Prefer fixing the automated process.

## Best Practices

### For Contributors

1. **Write Clear Commit Messages**: Follow conventional commit format
2. **One Logical Change Per Commit**: Makes version bumps predictable
3. **Document Breaking Changes**: Always include `BREAKING CHANGE:` in footer
4. **Test Before Merging**: Ensure CI passes

### For Maintainers

1. **Review Commit History**: Check that version bump will be appropriate
2. **Edit Squash Commits**: Clean up commit messages when squashing
3. **Coordinate Major Releases**: Discuss breaking changes with the team
4. **Monitor Releases**: Check that releases complete successfully
5. **Update Documentation**: Ensure docs reflect new versions

## Versioning Strategy

### Pre-1.0 (Current Phase)

- **v0.x.x**: Pre-production releases
- Breaking changes allowed in minor versions (v0.1.0 → v0.2.0)
- API stability not guaranteed
- User feedback period
- **Initial version**: Started at v0.1.0 (baseline tag v0.0.0 established)

### Post-1.0 (Production Ready)

- **v1.x.x**: Production-stable releases
- Breaking changes require major bump (v1.0.0 → v2.0.0)
- API stability guaranteed within major version
- Deprecation warnings before breaking changes

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [semantic-release Documentation](https://semantic-release.gitbook.io/)
- [Keep a Changelog](https://keepachangelog.com/)

## Questions?

If you have questions about the release process:
1. Check this document
2. Review the [CONTRIBUTING.md](CONTRIBUTING.md)
3. Open an issue for clarification
4. Contact the maintainers

---

**Last Updated**: 2025-11-11
**Maintained By**: Grafana Labs
