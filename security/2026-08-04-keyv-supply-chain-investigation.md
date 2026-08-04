# Security Investigation: keyv npm Package Supply Chain Compromise

**Date**: 2026-08-04
**Investigator**: Automated security scan
**Status**: No immediate impact to Grafana (details below)

## Summary

The `keyv` npm package ecosystem was investigated for supply chain compromise indicators.
A suspicious `keyv@6.0.0` was published on 2026-08-04 by an unknown publisher and subsequently
**unpublished/removed** from the npm registry (returns "version not found"). This is consistent
with a supply chain attack attempt that was caught and reverted.

**Grafana is NOT currently affected** because the lockfile pins to known-good older versions
that predate the suspicious activity, and multiple defense layers prevent pulling malicious versions.

## Keyv Versions Resolved in This Repository

### File: `yarn.lock`

| Package | Resolved Version | Published | Introduced By |
|---------|-----------------|-----------|---------------|
| `keyv` | **4.5.4** | 2023-10-07 | `flat-cache@^3.0.4` and `flat-cache@^4.0.0` |
| `keyv` | **5.4.0** | 2025-07-19 | `cacheable@^1.10.3` |
| `@keyv/serialize` | **1.1.0** | 2025-07-19 | `keyv@^5.4.0` |

### Installed in `node_modules/`

- `node_modules/keyv/` → version **4.5.4**
- `node_modules/cacheable/node_modules/keyv/` → version **5.4.0**

## Dependency Chains

```
Chain 1 (keyv 4.5.4):
  eslint@9.32.0
    → file-entry-cache@^8.0.0 (resolves to 8.0.0)
      → flat-cache@^4.0.0 (resolves to 4.0.1)
        → keyv@^4.5.4 (resolves to 4.5.4)

  @storybook/react-docgen-typescript-plugin@1.0.6--canary.9.0c3f3b7.0
    → flat-cache@^3.0.4 (resolves to 3.1.1)
      → keyv@^4.5.3 (resolves to 4.5.4)

Chain 2 (keyv 5.4.0):
  stylelint@16.23.0
    → file-entry-cache@^10.1.3 (resolves to 10.1.3)
      → flat-cache@^6.1.12 (resolves to 6.1.12)
        → cacheable@^1.10.3 (resolves to 1.10.3)
          → keyv@^5.4.0 (resolves to 5.4.0)
```

## Direct Usage

- **No direct dependency**: `keyv` does NOT appear in any `package.json` as a direct dependency.
- **No source code imports**: No `.ts`/`.js` files import or require `keyv` directly.
- **Dev-only exposure**: Both dependency chains lead through dev tooling only (eslint, stylelint, storybook). Keyv is NOT bundled into production Grafana builds.

## Suspicious Activity on npm Registry

| Version | Published | Publisher | Status |
|---------|-----------|-----------|--------|
| `6.0.0-rc.1` | 2026-08-03T19:21:08Z | GitHub Actions (OIDC) | Available |
| **`6.0.0`** | **2026-08-04T09:35:00Z** | **unknown** | **UNPUBLISHED (removed)** |

- `keyv@6.0.0` was briefly published with empty metadata (no dependencies, no scripts, no files, no dist info, unknown publisher) and has since been removed from the registry.
- This pattern is consistent with an account compromise or unauthorized publish that was reverted.
- The `latest` dist-tag remains at `5.6.0` (published 2026-01-21).

## Risk Assessment

### Why Grafana is NOT currently affected:

1. **Lockfile pins versions**: `yarn.lock` resolves `keyv` to `4.5.4` and `5.4.0` — both predate the suspicious activity.
2. **Semver ranges exclude 6.x**: The specifiers `^4.5.3`/`^4.5.4` and `^5.4.0` will NEVER resolve to `6.0.0`.
3. **No malicious 4.x or 5.x patches**: No new 4.x versions after 4.5.4 (Oct 2023), no new 5.x versions after 5.6.0 (Jan 2026). No suspicious patches were injected into the 4.x or 5.x lines.
4. **Scripts disabled**: `.yarnrc.yml` sets `enableScripts: false`, preventing `postinstall` execution.
5. **Age gate**: `.yarnrc.yml` sets `npmMinimalAgeGate: 3d`, blocking packages published less than 72 hours ago.
6. **Dev tooling only**: Even if compromised, keyv only runs during linting/formatting, not in production code.
7. **Source inspection clean**: Installed keyv 4.5.4 and 5.4.0 source files show no obfuscated code, no network calls, no eval/Function constructors, no child_process usage.

### Potential risk if lockfile is regenerated without pinning:

If the lockfile were deleted and regenerated, `^5.4.0` would resolve to `5.6.0` (the current `latest`) which appears safe. The 6.0.0 version was unpublished and would not be pulled.

## Git History for keyv Lockfile Entries

| Commit | Date | Description |
|--------|------|-------------|
| `d71924ea7bcf` | 2025-07-31 | Update dependency stylelint to v16.23.0 — introduced `keyv@5.4.0` and `@keyv/serialize@1.1.0` |
| `59b246dbeaa0` | 2025-01-23 | Update dependency stylelint to v16.13.2 — updated keyv/cacheable entries |
| `8c41137bcf1` | 2024-11-07 | Frontend: Update to Eslint 9 — introduced `flat-cache@^4.0.0` → `keyv@^4.5.4` |
| `6f773c4bbeeb` | 2023-10-19 | Update dependency stylelint to v15.11.0 — introduced `keyv@4.5.4` |

No lockfile changes touching keyv in the past week (since 2026-07-28).

## Recommendations

1. **No immediate action required** — current installations are safe.
2. **Monitor npm advisories** for formal CVE/GHSA publication regarding keyv supply chain compromise.
3. **Do not regenerate the lockfile** without verifying resolved versions of keyv and related packages.
4. **Consider pinning** keyv versions explicitly in `resolutions` if further compromise attempts are observed.
5. **Watch for patches** to 4.5.x or 5.x lines — these would be the vectors that could affect this repo via semver ranges.

## No Advisory Published Yet

As of 2026-08-04:
- No npm security advisory exists for keyv
- No GitHub Security Advisory (GHSA) exists for keyv
- The `yarn npm audit` command reports no keyv vulnerabilities
