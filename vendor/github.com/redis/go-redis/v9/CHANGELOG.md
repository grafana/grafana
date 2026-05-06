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
