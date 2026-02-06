# Release Notes

# 9.14.0 (2025-09-10)

## Highlights
- Added batch process method to the pipeline ([#3510](https://github.com/redis/go-redis/pull/3510))

# Changes

## 🚀 New Features

- Added batch process method to the pipeline ([#3510](https://github.com/redis/go-redis/pull/3510))

## 🐛 Bug Fixes

- fix: SetErr on Cmd if the command cannot be queued correctly in multi/exec ([#3509](https://github.com/redis/go-redis/pull/3509))

## 🧰 Maintenance

- Updates release drafter config to exclude dependabot ([#3511](https://github.com/redis/go-redis/pull/3511))
- chore(deps): bump actions/setup-go from 5 to 6 ([#3504](https://github.com/redis/go-redis/pull/3504))

## Contributors
We'd like to thank all the contributors who worked on this release!

[@elena-kolevska](https://github.com/elena-kolevksa), [@htemelski-redis](https://github.com/htemelski-redis) and [@ndyakov](https://github.com/ndyakov)


# 9.13.0 (2025-09-03)

## Highlights
- Pipeliner expose queued commands ([#3496](https://github.com/redis/go-redis/pull/3496))
- Ensure that JSON.GET returns Nil response ([#3470](https://github.com/redis/go-redis/pull/3470))
- Fixes on Read and Write buffer sizes and UniversalOptions

## Changes
- Pipeliner expose queued commands ([#3496](https://github.com/redis/go-redis/pull/3496))
- fix(test): fix a timing issue in pubsub test ([#3498](https://github.com/redis/go-redis/pull/3498))
- Allow users to enable read-write splitting in failover mode. ([#3482](https://github.com/redis/go-redis/pull/3482))
- Set the read/write buffer size of the sentinel client to 4KiB ([#3476](https://github.com/redis/go-redis/pull/3476))

## 🚀 New Features

- fix(otel): register wait metrics ([#3499](https://github.com/redis/go-redis/pull/3499))
- Support subscriptions against cluster slave nodes ([#3480](https://github.com/redis/go-redis/pull/3480))
- Add wait metrics to otel ([#3493](https://github.com/redis/go-redis/pull/3493))
- Clean failing timeout implementation ([#3472](https://github.com/redis/go-redis/pull/3472))

## 🐛 Bug Fixes

- Do not assume that all non-IP hosts are loopbacks ([#3085](https://github.com/redis/go-redis/pull/3085))
- Ensure that JSON.GET returns Nil response ([#3470](https://github.com/redis/go-redis/pull/3470))

## 🧰 Maintenance

- fix(otel): register wait metrics ([#3499](https://github.com/redis/go-redis/pull/3499))
- fix(make test): Add default env in makefile ([#3491](https://github.com/redis/go-redis/pull/3491))
- Update the introduction to running tests in README.md ([#3495](https://github.com/redis/go-redis/pull/3495))
- test: Add comprehensive edge case tests for IncrByFloat command ([#3477](https://github.com/redis/go-redis/pull/3477))
- Set the default read/write buffer size of Redis connection to 32KiB ([#3483](https://github.com/redis/go-redis/pull/3483))
- Bumps test image to 8.2.1-pre ([#3478](https://github.com/redis/go-redis/pull/3478))
- fix UniversalOptions miss ReadBufferSize and WriteBufferSize options ([#3485](https://github.com/redis/go-redis/pull/3485))
- chore(deps): bump actions/checkout from 4 to 5 ([#3484](https://github.com/redis/go-redis/pull/3484))
- Removes dry run for stale issues policy ([#3471](https://github.com/redis/go-redis/pull/3471))
- Update otel metrics URL ([#3474](https://github.com/redis/go-redis/pull/3474))

## Contributors
We'd like to thank all the contributors who worked on this release!

[@LINKIWI](https://github.com/LINKIWI), [@cxljs](https://github.com/cxljs), [@cybersmeashish](https://github.com/cybersmeashish), [@elena-kolevska](https://github.com/elena-kolevska), [@htemelski-redis](https://github.com/htemelski-redis), [@mwhooker](https://github.com/mwhooker), [@ndyakov](https://github.com/ndyakov), [@ofekshenawa](https://github.com/ofekshenawa), [@suever](https://github.com/suever)


# 9.12.1 (2025-08-11)
## 🚀 Highlights
In the last version (9.12.0) the client introduced bigger write and read buffer sized. The default value we set was 512KiB.
However, users reported that this is too big for most use cases and can lead to high memory usage.
In this version the default value is changed to 256KiB. The `README.md` was updated to reflect the
correct default value and include a note that the default value can be changed.

## 🐛 Bug Fixes

- fix(options): Add buffer sizes to failover. Update README ([#3468](https://github.com/redis/go-redis/pull/3468))

## 🧰 Maintenance

- fix(options): Add buffer sizes to failover. Update README ([#3468](https://github.com/redis/go-redis/pull/3468))
- chore: update & fix otel example ([#3466](https://github.com/redis/go-redis/pull/3466))

## Contributors
We'd like to thank all the contributors who worked on this release!

[@ndyakov](https://github.com/ndyakov) and [@vmihailenco](https://github.com/vmihailenco)

# 9.12.0 (2025-08-05)

## 🚀 Highlights

- This release includes support for [Redis 8.2](https://redis.io/docs/latest/operate/oss_and_stack/stack-with-enterprise/release-notes/redisce/redisos-8.2-release-notes/).
- Introduces an experimental Query Builders for `FTSearch`, `FTAggregate` and other search commands.
- Adds support for `EPSILON` option in `FT.VSIM`.
- Includes bug fixes and improvements contributed by the community related to ring and [redisotel](https://github.com/redis/go-redis/tree/master/extra/redisotel).

## Changes
- Improve stale issue workflow ([#3458](https://github.com/redis/go-redis/pull/3458))
- chore(ci): Add 8.2 rc2 pre build for CI ([#3459](https://github.com/redis/go-redis/pull/3459))
- Added new stream commands ([#3450](https://github.com/redis/go-redis/pull/3450))
- feat: Add "skip_verify" to Sentinel ([#3428](https://github.com/redis/go-redis/pull/3428))
- fix: `errors.Join` requires Go 1.20 or later ([#3442](https://github.com/redis/go-redis/pull/3442))
- DOC-4344 document quickstart examples ([#3426](https://github.com/redis/go-redis/pull/3426))
- feat(bitop): add support for the new bitop operations ([#3409](https://github.com/redis/go-redis/pull/3409))

## 🚀 New Features

- feat: recover addIdleConn may occur panic ([#2445](https://github.com/redis/go-redis/pull/2445))
- feat(ring): specify custom health check func via HeartbeatFn option ([#2940](https://github.com/redis/go-redis/pull/2940))
- Add Query Builder for RediSearch commands ([#3436](https://github.com/redis/go-redis/pull/3436))
- add configurable buffer sizes for Redis connections ([#3453](https://github.com/redis/go-redis/pull/3453))
- Add VAMANA vector type to RediSearch ([#3449](https://github.com/redis/go-redis/pull/3449))
- VSIM add `EPSILON` option ([#3454](https://github.com/redis/go-redis/pull/3454))
- Add closing support to otel metrics instrumentation ([#3444](https://github.com/redis/go-redis/pull/3444))

## 🐛 Bug Fixes

- fix(redisotel): fix buggy append in reportPoolStats ([#3122](https://github.com/redis/go-redis/pull/3122))
- fix(search): return results even if doc is empty ([#3457](https://github.com/redis/go-redis/pull/3457))
- [ISSUE-3402]: Ring.Pipelined return dial timeout error ([#3403](https://github.com/redis/go-redis/pull/3403))

## 🧰 Maintenance

- Merges stale issues jobs into one job with two steps ([#3463](https://github.com/redis/go-redis/pull/3463))
- improve code readability ([#3446](https://github.com/redis/go-redis/pull/3446))
- chore(release): 9.12.0-beta.1 ([#3460](https://github.com/redis/go-redis/pull/3460))
- DOC-5472 time series doc examples ([#3443](https://github.com/redis/go-redis/pull/3443))
- Add VAMANA compression algorithm tests ([#3461](https://github.com/redis/go-redis/pull/3461))
- bumped redis 8.2 version used in the CI/CD ([#3451](https://github.com/redis/go-redis/pull/3451))

## Contributors
We'd like to thank all the contributors who worked on this release!

[@andy-stark-redis](https://github.com/andy-stark-redis), [@cxljs](https://github.com/cxljs), [@elena-kolevska](https://github.com/elena-kolevska), [@htemelski-redis](https://github.com/htemelski-redis), [@jouir](https://github.com/jouir), [@monkey92t](https://github.com/monkey92t), [@ndyakov](https://github.com/ndyakov), [@ofekshenawa](https://github.com/ofekshenawa), [@rokn](https://github.com/rokn), [@smnvdev](https://github.com/smnvdev), [@strobil](https://github.com/strobil) and [@wzy9607](https://github.com/wzy9607)

## New Contributors
* [@htemelski-redis](https://github.com/htemelski-redis) made their first contribution in [#3409](https://github.com/redis/go-redis/pull/3409)
* [@smnvdev](https://github.com/smnvdev) made their first contribution in [#3403](https://github.com/redis/go-redis/pull/3403)
* [@rokn](https://github.com/rokn) made their first contribution in [#3444](https://github.com/redis/go-redis/pull/3444)

# 9.11.0 (2025-06-24)

## 🚀 Highlights

Fixes TxPipeline to work correctly in cluster scenarios, allowing execution of commands
only in the same slot.

# Changes

## 🚀 New Features

- Set cluster slot for `scan` commands, rather than random ([#2623](https://github.com/redis/go-redis/pull/2623))
- Add CredentialsProvider field to UniversalOptions ([#2927](https://github.com/redis/go-redis/pull/2927))
- feat(redisotel): add WithCallerEnabled option ([#3415](https://github.com/redis/go-redis/pull/3415))

## 🐛 Bug Fixes

- fix(txpipeline): keyless commands should take the slot of the keyed ([#3411](https://github.com/redis/go-redis/pull/3411))
- fix(loading): cache the loaded flag for slave nodes ([#3410](https://github.com/redis/go-redis/pull/3410))
- fix(txpipeline): should return error on multi/exec on multiple slots ([#3408](https://github.com/redis/go-redis/pull/3408))
- fix: check if the shard exists to avoid returning nil ([#3396](https://github.com/redis/go-redis/pull/3396))

## 🧰 Maintenance

- feat: optimize connection pool waitTurn ([#3412](https://github.com/redis/go-redis/pull/3412))
- chore(ci): update CI redis builds ([#3407](https://github.com/redis/go-redis/pull/3407))
- chore: remove a redundant method from `Ring`, `Client` and `ClusterClient` ([#3401](https://github.com/redis/go-redis/pull/3401))
- test: refactor TestBasicCredentials using table-driven tests ([#3406](https://github.com/redis/go-redis/pull/3406))
- perf: reduce unnecessary memory allocation operations ([#3399](https://github.com/redis/go-redis/pull/3399))
- fix: insert entry during iterating over a map ([#3398](https://github.com/redis/go-redis/pull/3398))
- DOC-5229 probabilistic data type examples ([#3413](https://github.com/redis/go-redis/pull/3413))
- chore(deps): bump rojopolis/spellcheck-github-actions from 0.49.0 to 0.51.0 ([#3414](https://github.com/redis/go-redis/pull/3414))

## Contributors
We'd like to thank all the contributors who worked on this release!

[@andy-stark-redis](https://github.com/andy-stark-redis), [@boekkooi-impossiblecloud](https://github.com/boekkooi-impossiblecloud), [@cxljs](https://github.com/cxljs), [@dcherubini](https://github.com/dcherubini), [@dependabot[bot]](https://github.com/apps/dependabot), [@iamamirsalehi](https://github.com/iamamirsalehi), [@ndyakov](https://github.com/ndyakov), [@pete-woods](https://github.com/pete-woods), [@twz915](https://github.com/twz915) and [dependabot[bot]](https://github.com/apps/dependabot)

# 9.10.0 (2025-06-06)

## 🚀 Highlights

`go-redis` now supports [vector sets](https://redis.io/docs/latest/develop/data-types/vector-sets/). This data type is marked
as "in preview" in Redis and its support in `go-redis` is marked as experimental. You can find examples in the documentation and
in the `doctests` folder.

# Changes

## 🚀 New Features

- feat: support vectorset ([#3375](https://github.com/redis/go-redis/pull/3375))

## 🧰 Maintenance

- Add the missing NewFloatSliceResult for testing ([#3393](https://github.com/redis/go-redis/pull/3393))
- DOC-5078 vector set examples ([#3394](https://github.com/redis/go-redis/pull/3394))

## Contributors
We'd like to thank all the contributors who worked on this release!

[@AndBobsYourUncle](https://github.com/AndBobsYourUncle), [@andy-stark-redis](https://github.com/andy-stark-redis), [@fukua95](https://github.com/fukua95) and [@ndyakov](https://github.com/ndyakov)



# 9.9.0 (2025-05-27)

## 🚀 Highlights
- **Token-based Authentication**: Added `StreamingCredentialsProvider` for dynamic credential updates (experimental)
  - Can be used with [go-redis-entraid](https://github.com/redis/go-redis-entraid) for Azure AD authentication
- **Connection Statistics**: Added connection waiting statistics for better monitoring
- **Failover Improvements**: Added `ParseFailoverURL` for easier failover configuration
- **Ring Client Enhancements**: Added shard access methods for better Pub/Sub management

## ✨ New Features
- Added `StreamingCredentialsProvider` for token-based authentication ([#3320](https://github.com/redis/go-redis/pull/3320))
  - Supports dynamic credential updates
  - Includes connection close hooks
  - Note: Currently marked as experimental
- Added `ParseFailoverURL` for parsing failover URLs ([#3362](https://github.com/redis/go-redis/pull/3362))
- Added connection waiting statistics ([#2804](https://github.com/redis/go-redis/pull/2804))
- Added new utility functions:
  - `ParseFloat` and `MustParseFloat` in public utils package ([#3371](https://github.com/redis/go-redis/pull/3371))
  - Unit tests for `Atoi`, `ParseInt`, `ParseUint`, and `ParseFloat` ([#3377](https://github.com/redis/go-redis/pull/3377))
- Added Ring client shard access methods:
  - `GetShardClients()` to retrieve all active shard clients
  - `GetShardClientForKey(key string)` to get the shard client for a specific key ([#3388](https://github.com/redis/go-redis/pull/3388))

## 🐛 Bug Fixes
- Fixed routing reads to loading slave nodes ([#3370](https://github.com/redis/go-redis/pull/3370))
- Added support for nil lag in XINFO GROUPS ([#3369](https://github.com/redis/go-redis/pull/3369))
- Fixed pool acquisition timeout issues ([#3381](https://github.com/redis/go-redis/pull/3381))
- Optimized unnecessary copy operations ([#3376](https://github.com/redis/go-redis/pull/3376))

## 📚 Documentation
- Updated documentation for XINFO GROUPS with nil lag support ([#3369](https://github.com/redis/go-redis/pull/3369))
- Added package-level comments for new features

## ⚡ Performance and Reliability
- Optimized `ReplaceSpaces` function ([#3383](https://github.com/redis/go-redis/pull/3383))
- Set default value for `Options.Protocol` in `init()` ([#3387](https://github.com/redis/go-redis/pull/3387))
- Exported pool errors for public consumption ([#3380](https://github.com/redis/go-redis/pull/3380))

## 🔧 Dependencies and Infrastructure
- Updated Redis CI to version 8.0.1 ([#3372](https://github.com/redis/go-redis/pull/3372))
- Updated spellcheck GitHub Actions ([#3389](https://github.com/redis/go-redis/pull/3389))
- Removed unused parameters ([#3382](https://github.com/redis/go-redis/pull/3382), [#3384](https://github.com/redis/go-redis/pull/3384))

## 🧪 Testing
- Added unit tests for pool acquisition timeout ([#3381](https://github.com/redis/go-redis/pull/3381))
- Added unit tests for utility functions ([#3377](https://github.com/redis/go-redis/pull/3377))

## 👥 Contributors

We would like to thank all the contributors who made this release possible:

[@ndyakov](https://github.com/ndyakov), [@ofekshenawa](https://github.com/ofekshenawa), [@LINKIWI](https://github.com/LINKIWI), [@iamamirsalehi](https://github.com/iamamirsalehi), [@fukua95](https://github.com/fukua95), [@lzakharov](https://github.com/lzakharov), [@DengY11](https://github.com/DengY11)

## 📝 Changelog

For a complete list of changes, see the [full changelog](https://github.com/redis/go-redis/compare/v9.8.0...v9.9.0).

# 9.8.0 (2025-04-30)

## 🚀 Highlights
- **Redis 8 Support**: Full compatibility with Redis 8.0, including testing and CI integration
- **Enhanced Hash Operations**: Added support for new hash commands (`HGETDEL`, `HGETEX`, `HSETEX`) and `HSTRLEN` command
- **Search Improvements**: Enabled Search DIALECT 2 by default and added `CountOnly` argument for `FT.Search`

## ✨ New Features
- Added support for new hash commands: `HGETDEL`, `HGETEX`, `HSETEX` ([#3305](https://github.com/redis/go-redis/pull/3305))
- Added `HSTRLEN` command for hash operations ([#2843](https://github.com/redis/go-redis/pull/2843))
- Added `Do` method for raw query by single connection from `pool.Conn()` ([#3182](https://github.com/redis/go-redis/pull/3182))
- Prevent false-positive marshaling by treating zero time.Time as empty in isEmptyValue ([#3273](https://github.com/redis/go-redis/pull/3273))
- Added FailoverClusterClient support for Universal client ([#2794](https://github.com/redis/go-redis/pull/2794))
- Added support for cluster mode with `IsClusterMode` config parameter ([#3255](https://github.com/redis/go-redis/pull/3255))
- Added client name support in `HELLO` RESP handshake ([#3294](https://github.com/redis/go-redis/pull/3294))
- **Enabled Search DIALECT 2 by default** ([#3213](https://github.com/redis/go-redis/pull/3213))
- Added read-only option for failover configurations ([#3281](https://github.com/redis/go-redis/pull/3281))
- Added `CountOnly` argument for `FT.Search` to use `LIMIT 0 0` ([#3338](https://github.com/redis/go-redis/pull/3338))
- Added `DB` option support in `NewFailoverClusterClient` ([#3342](https://github.com/redis/go-redis/pull/3342))
- Added `nil` check for the options when creating a client ([#3363](https://github.com/redis/go-redis/pull/3363))

## 🐛 Bug Fixes
- Fixed `PubSub` concurrency safety issues ([#3360](https://github.com/redis/go-redis/pull/3360))
- Fixed panic caused when argument is `nil` ([#3353](https://github.com/redis/go-redis/pull/3353))
- Improved error handling when fetching master node from sentinels ([#3349](https://github.com/redis/go-redis/pull/3349))
- Fixed connection pool timeout issues and increased retries ([#3298](https://github.com/redis/go-redis/pull/3298))
- Fixed context cancellation error leading to connection spikes on Primary instances ([#3190](https://github.com/redis/go-redis/pull/3190))
- Fixed RedisCluster client to consider `MASTERDOWN` a retriable error ([#3164](https://github.com/redis/go-redis/pull/3164))
- Fixed tracing to show complete commands instead of truncated versions ([#3290](https://github.com/redis/go-redis/pull/3290))
- Fixed OpenTelemetry instrumentation to prevent multiple span reporting ([#3168](https://github.com/redis/go-redis/pull/3168))
- Fixed `FT.Search` Limit argument and added `CountOnly` argument for limit 0 0 ([#3338](https://github.com/redis/go-redis/pull/3338))
- Fixed missing command in interface ([#3344](https://github.com/redis/go-redis/pull/3344))
- Fixed slot calculation for `COUNTKEYSINSLOT` command ([#3327](https://github.com/redis/go-redis/pull/3327))
- Updated PubSub implementation with correct context ([#3329](https://github.com/redis/go-redis/pull/3329))

## 📚 Documentation
- Added hash search examples ([#3357](https://github.com/redis/go-redis/pull/3357))
- Fixed documentation comments ([#3351](https://github.com/redis/go-redis/pull/3351))
- Added `CountOnly` search example ([#3345](https://github.com/redis/go-redis/pull/3345))
- Added examples for list commands: `LLEN`, `LPOP`, `LPUSH`, `LRANGE`, `RPOP`, `RPUSH` ([#3234](https://github.com/redis/go-redis/pull/3234))
- Added `SADD` and `SMEMBERS` command examples ([#3242](https://github.com/redis/go-redis/pull/3242))
- Updated `README.md` to use Redis Discord guild ([#3331](https://github.com/redis/go-redis/pull/3331))
- Updated `HExpire` command documentation ([#3355](https://github.com/redis/go-redis/pull/3355))
- Featured OpenTelemetry instrumentation more prominently ([#3316](https://github.com/redis/go-redis/pull/3316))
- Updated `README.md` with additional information ([#310ce55](https://github.com/redis/go-redis/commit/310ce55))

## ⚡ Performance and Reliability
- Bound connection pool background dials to configured dial timeout ([#3089](https://github.com/redis/go-redis/pull/3089))
- Ensured context isn't exhausted via concurrent query ([#3334](https://github.com/redis/go-redis/pull/3334))

## 🔧 Dependencies and Infrastructure
- Updated testing image to Redis 8.0-RC2 ([#3361](https://github.com/redis/go-redis/pull/3361))
- Enabled CI for Redis CE 8.0 ([#3274](https://github.com/redis/go-redis/pull/3274))
- Updated various dependencies:
  - Bumped golangci/golangci-lint-action from 6.5.0 to 7.0.0 ([#3354](https://github.com/redis/go-redis/pull/3354))
  - Bumped rojopolis/spellcheck-github-actions ([#3336](https://github.com/redis/go-redis/pull/3336))
  - Bumped golang.org/x/net in example/otel ([#3308](https://github.com/redis/go-redis/pull/3308))
- Migrated golangci-lint configuration to v2 format ([#3354](https://github.com/redis/go-redis/pull/3354))

## ⚠️ Breaking Changes
- **Enabled Search DIALECT 2 by default** ([#3213](https://github.com/redis/go-redis/pull/3213))
- Dropped RedisGears (Triggers and Functions) support ([#3321](https://github.com/redis/go-redis/pull/3321))
- Dropped FT.PROFILE command that was never enabled ([#3323](https://github.com/redis/go-redis/pull/3323))

## 🔒 Security
- Fixed network error handling on SETINFO (CVE-2025-29923) ([#3295](https://github.com/redis/go-redis/pull/3295))

## 🧪 Testing
- Added integration tests for Redis 8 behavior changes in Redis Search ([#3337](https://github.com/redis/go-redis/pull/3337))
- Added vector types INT8 and UINT8 tests ([#3299](https://github.com/redis/go-redis/pull/3299))
- Added test codes for search_commands.go ([#3285](https://github.com/redis/go-redis/pull/3285))
- Fixed example test sorting ([#3292](https://github.com/redis/go-redis/pull/3292))

## 👥 Contributors

We would like to thank all the contributors who made this release possible:

[@alexander-menshchikov](https://github.com/alexander-menshchikov), [@EXPEbdodla](https://github.com/EXPEbdodla), [@afti](https://github.com/afti), [@dmaier-redislabs](https://github.com/dmaier-redislabs), [@four_leaf_clover](https://github.com/four_leaf_clover), [@alohaglenn](https://github.com/alohaglenn), [@gh73962](https://github.com/gh73962), [@justinmir](https://github.com/justinmir), [@LINKIWI](https://github.com/LINKIWI), [@liushuangbill](https://github.com/liushuangbill), [@golang88](https://github.com/golang88), [@gnpaone](https://github.com/gnpaone), [@ndyakov](https://github.com/ndyakov), [@nikolaydubina](https://github.com/nikolaydubina), [@oleglacto](https://github.com/oleglacto), [@andy-stark-redis](https://github.com/andy-stark-redis), [@rodneyosodo](https://github.com/rodneyosodo), [@dependabot](https://github.com/dependabot), [@rfyiamcool](https://github.com/rfyiamcool), [@frankxjkuang](https://github.com/frankxjkuang), [@fukua95](https://github.com/fukua95), [@soleymani-milad](https://github.com/soleymani-milad), [@ofekshenawa](https://github.com/ofekshenawa), [@khasanovbi](https://github.com/khasanovbi)


# Old Changelog
## Unreleased

### Changed

* `go-redis` won't skip span creation if the parent spans is not recording. ([#2980](https://github.com/redis/go-redis/issues/2980))
  Users can use the OpenTelemetry sampler to control the sampling behavior.
  For instance, you can use the `ParentBased(NeverSample())` sampler from `go.opentelemetry.io/otel/sdk/trace` to keep
  a similar behavior (drop orphan spans) of `go-redis` as before.

## [9.0.5](https://github.com/redis/go-redis/compare/v9.0.4...v9.0.5) (2023-05-29)


### Features

* Add ACL LOG ([#2536](https://github.com/redis/go-redis/issues/2536)) ([31ba855](https://github.com/redis/go-redis/commit/31ba855ddebc38fbcc69a75d9d4fb769417cf602))
* add field protocol to setupClusterQueryParams ([#2600](https://github.com/redis/go-redis/issues/2600)) ([840c25c](https://github.com/redis/go-redis/commit/840c25cb6f320501886a82a5e75f47b491e46fbe))
* add protocol option ([#2598](https://github.com/redis/go-redis/issues/2598)) ([3917988](https://github.com/redis/go-redis/commit/391798880cfb915c4660f6c3ba63e0c1a459e2af))



## [9.0.4](https://github.com/redis/go-redis/compare/v9.0.3...v9.0.4) (2023-05-01)


### Bug Fixes

* reader float parser ([#2513](https://github.com/redis/go-redis/issues/2513)) ([46f2450](https://github.com/redis/go-redis/commit/46f245075e6e3a8bd8471f9ca67ea95fd675e241))


### Features

* add client info command ([#2483](https://github.com/redis/go-redis/issues/2483)) ([b8c7317](https://github.com/redis/go-redis/commit/b8c7317cc6af444603731f7017c602347c0ba61e))
* no longer verify HELLO error messages ([#2515](https://github.com/redis/go-redis/issues/2515)) ([7b4f217](https://github.com/redis/go-redis/commit/7b4f2179cb5dba3d3c6b0c6f10db52b837c912c8))
* read the structure to increase the judgment of the omitempty op… ([#2529](https://github.com/redis/go-redis/issues/2529)) ([37c057b](https://github.com/redis/go-redis/commit/37c057b8e597c5e8a0e372337f6a8ad27f6030af))



## [9.0.3](https://github.com/redis/go-redis/compare/v9.0.2...v9.0.3) (2023-04-02)

### New Features

- feat(scan): scan time.Time sets the default decoding (#2413)
- Add support for CLUSTER LINKS command (#2504)
- Add support for acl dryrun command (#2502)
- Add support for COMMAND GETKEYS & COMMAND GETKEYSANDFLAGS (#2500)
- Add support for LCS Command (#2480)
- Add support for BZMPOP (#2456)
- Adding support for ZMPOP command (#2408)
- Add support for LMPOP (#2440)
- feat: remove pool unused fields (#2438)
- Expiretime and PExpireTime (#2426)
- Implement `FUNCTION` group of commands (#2475)
- feat(zadd): add ZAddLT and ZAddGT (#2429)
- Add: Support for COMMAND LIST command (#2491)
- Add support for BLMPOP (#2442)
- feat: check pipeline.Do to prevent confusion with Exec (#2517)
- Function stats, function kill, fcall and fcall_ro (#2486)
- feat: Add support for CLUSTER SHARDS command (#2507)
- feat(cmd): support for adding byte,bit parameters to the bitpos command (#2498)

### Fixed

- fix: eval api cmd.SetFirstKeyPos (#2501)
- fix: limit the number of connections created (#2441)
- fixed #2462  v9 continue support dragonfly,  it's Hello command return "NOAUTH Authentication required" error (#2479)
- Fix for internal/hscan/structmap.go:89:23: undefined: reflect.Pointer (#2458)
- fix: group lag can be null (#2448)

### Maintenance

- Updating to the latest version of redis (#2508)
- Allowing for running tests on a port other than the fixed 6380 (#2466)
- redis 7.0.8 in tests (#2450)
- docs: Update redisotel example for v9 (#2425)
- chore: update go mod, Upgrade golang.org/x/net version to 0.7.0 (#2476)
- chore: add Chinese translation (#2436)
- chore(deps): bump github.com/bsm/gomega from 1.20.0 to 1.26.0 (#2421)
- chore(deps): bump github.com/bsm/ginkgo/v2 from 2.5.0 to 2.7.0 (#2420)
- chore(deps): bump actions/setup-go from 3 to 4 (#2495)
- docs: add instructions for the HSet api (#2503)
- docs: add reading lag field comment (#2451)
- test: update go mod before testing(go mod tidy) (#2423)
- docs: fix comment typo (#2505)
- test: remove testify (#2463)
- refactor: change ListElementCmd to KeyValuesCmd. (#2443)
- fix(appendArg): appendArg case special type (#2489)

## [9.0.2](https://github.com/redis/go-redis/compare/v9.0.1...v9.0.2) (2023-02-01)

### Features

* upgrade OpenTelemetry, use the new metrics API. ([#2410](https://github.com/redis/go-redis/issues/2410)) ([e29e42c](https://github.com/redis/go-redis/commit/e29e42cde2755ab910d04185025dc43ce6f59c65))

## v9 2023-01-30

### Breaking

- Changed Pipelines to not be thread-safe any more.

### Added

- Added support for [RESP3](https://github.com/antirez/RESP3/blob/master/spec.md) protocol. It was
  contributed by @monkey92t who has done the majority of work in this release.
- Added `ContextTimeoutEnabled` option that controls whether the client respects context timeouts
  and deadlines. See
  [Redis Timeouts](https://redis.uptrace.dev/guide/go-redis-debugging.html#timeouts) for details.
- Added `ParseClusterURL` to parse URLs into `ClusterOptions`, for example,
  `redis://user:password@localhost:6789?dial_timeout=3&read_timeout=6s&addr=localhost:6790&addr=localhost:6791`.
- Added metrics instrumentation using `redisotel.IstrumentMetrics`. See
  [documentation](https://redis.uptrace.dev/guide/go-redis-monitoring.html)
- Added `redis.HasErrorPrefix` to help working with errors.

### Changed

- Removed asynchronous cancellation based on the context timeout. It was racy in v8 and is
  completely gone in v9.
- Reworked hook interface and added `DialHook`.
- Replaced `redisotel.NewTracingHook` with `redisotel.InstrumentTracing`. See
  [example](example/otel) and
  [documentation](https://redis.uptrace.dev/guide/go-redis-monitoring.html).
- Replaced `*redis.Z` with `redis.Z` since it is small enough to be passed as value without making
  an allocation.
- Renamed the option `MaxConnAge` to `ConnMaxLifetime`.
- Renamed the option `IdleTimeout` to `ConnMaxIdleTime`.
- Removed connection reaper in favor of `MaxIdleConns`.
- Removed `WithContext` since `context.Context` can be passed directly as an arg.
- Removed `Pipeline.Close` since there is no real need to explicitly manage pipeline resources and
  it can be safely reused via `sync.Pool` etc. `Pipeline.Discard` is still available if you want to
  reset commands for some reason.

### Fixed

- Improved and fixed pipeline retries.
- As usually, added support for more commands and fixed some bugs.
