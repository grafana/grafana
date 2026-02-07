# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/).

## [Unreleased]

- chore(deps): Remove dependency on github.com/pkg/errors (#2184)
- chore(deps): Migrate from OpenCensus to OpenTelemetry (#2169)

## [4.5.1] - 2025-01-21

- chore(deps): bump google.golang.org/protobuf from 1.36.2 to 1.36.3 in the patch group (#2150)
- bump github.com/dgraph-io/ristretto/v2 from 2.0.1 to 2.1.0 in the minor group (#2151)
- feat(info): print total size of listed keys (#2149)
- chore(deps): bump google.golang.org/protobuf from 1.36.1 to 1.36.2 in the patch group (#2146)
- chore(deps): bump the minor group with 2 updates (#2147)
- fix(info): print Total BloomFilter Size with totalBloomFilter instead of totalIndex (#2145)
- chore(deps): bump the minor group with 2 updates (#2141)
- chore(deps): bump google.golang.org/protobuf from 1.36.0 to 1.36.1 in the patch group (#2140)
- chore(deps): bump google.golang.org/protobuf from 1.35.2 to 1.36.0 in the minor group (#2139)
- chore(deps): bump github.com/dgraph-io/ristretto/v2 from 2.0.0 to 2.0.1 in the patch group (#2136)
- chore(deps): bump golang.org/x/net from 0.31.0 to 0.32.0 in the minor group (#2137)
- chore(deps): bump the minor group with 2 updates (#2135)
- docs: Add pagination explanation to docs (#2134)
- Fix build for GOARCH=wasm with GOOS=js or GOOS=wasip1 (#2048)

**Full Changelog**: https://github.com/hypermodeinc/badger/compare/v4.5.0...v4.5.1

## [4.5.0] - 2024-11-29

- fix the cd pipeline by @mangalaman93 in https://github.com/hypermodeinc/badger/pull/2127
- chore(deps): bump the minor group with 2 updates by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2128
- chore(deps): bump github.com/stretchr/testify from 1.9.0 to 1.10.0 in the minor group by
  @dependabot in https://github.com/hypermodeinc/badger/pull/2130
- upgrade protobuf library by @shivaji-kharse in https://github.com/hypermodeinc/badger/pull/2131

**Full Changelog**: https://github.com/hypermodeinc/badger/compare/v4.4.0...v4.5.0

## [4.4.0] - 2024-10-26

- retract v4.3.0 due to #2121 and #2113, upgrade to Go v1.23, use ristretto v2 in
  https://github.com/hypermodeinc/badger/pull/2122
- Allow stream custom maxsize per batch in https://github.com/hypermodeinc/badger/pull/2063
- chore(deps): bump github.com/klauspost/compress from 1.17.10 to 1.17.11 in the patch group in
  https://github.com/hypermodeinc/badger/pull/2120
- fix: sentinel errors should not have stack traces in
  https://github.com/hypermodeinc/badger/pull/2042
- chore(deps): bump the minor group with 2 updates in
  https://github.com/hypermodeinc/badger/pull/2119

**Full Changelog**: https://github.com/hypermodeinc/badger/compare/v4.3.1...v4.4.0

## [4.3.1] - 2024-10-06

- chore: update docs links by @ryanfoxtyler in https://github.com/hypermodeinc/badger/pull/2097
- chore(deps): bump golang.org/x/sys from 0.24.0 to 0.25.0 in the minor group by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2100
- chore(deps): bump golang.org/x/net from 0.28.0 to 0.29.0 in the minor group by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2106
- fix: fix reverse iterator broken by seek by @harshil-goel in
  https://github.com/hypermodeinc/badger/pull/2109
- chore(deps): bump github.com/klauspost/compress from 1.17.9 to 1.17.10 in the patch group by
  @dependabot in https://github.com/hypermodeinc/badger/pull/2114
- chore(deps): bump github.com/hypermodeinc/ristretto from 0.1.2-0.20240116140435-c67e07994f91 to
  1.0.0 by @dependabot in https://github.com/hypermodeinc/badger/pull/2112

**Full Changelog**: https://github.com/hypermodeinc/badger/compare/v4.3.0...v4.3.1

## [4.3.0] - 2024-08-29

> **Warning** The tag v4.3.0 has been retracted due to an issue go.sum. Use v4.3.1 (see #2121 and
> #2113)

**Fixes**

- chore(changelog): add a missed entry in CHANGELOG for v4.2.0 by @mangalaman93 in
  https://github.com/hypermodeinc/badger/pull/1988
- update README with project KVS using badger by @tauraamui in
  https://github.com/hypermodeinc/badger/pull/1989
- fix edge case for watermark when index is zero by @mangalaman93 in
  https://github.com/hypermodeinc/badger/pull/1999
- upgrade spf13/cobra to version v1.7.0 by @mangalaman93 in
  https://github.com/hypermodeinc/badger/pull/2001
- chore: update readme by @joshua-goldstein in https://github.com/hypermodeinc/badger/pull/2011
- perf: upgrade compress package test and benchmark. by @siddhant2001 in
  https://github.com/hypermodeinc/badger/pull/2009
- fix(Transactions): Fix resource consumption on empty write transaction by @Zach-Johnson in
  https://github.com/hypermodeinc/badger/pull/2018
- chore(deps): bump golang.org/x/net from 0.7.0 to 0.17.0 by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2017
- perf(compactor): optimize allocations: use buffer for priorities by @deff7 in
  https://github.com/hypermodeinc/badger/pull/2006
- fix(Transaction): discard empty transactions on CommitWith by @Wondertan in
  https://github.com/hypermodeinc/badger/pull/2031
- fix(levelHandler): use lock for levelHandler sort tables instead of rlock by @xgzlucario in
  https://github.com/hypermodeinc/badger/pull/2034
- Docs: update README with project LLS using badger by @Boc-chi-no in
  https://github.com/hypermodeinc/badger/pull/2032
- chore: MaxTableSize has been renamed to BaseTableSize by @mitar in
  https://github.com/hypermodeinc/badger/pull/2038
- Update CODEOWNERS by @ryanfoxtyler in https://github.com/hypermodeinc/badger/pull/2043
- Chore(): add Stale Action by @ryanfoxtyler in https://github.com/hypermodeinc/badger/pull/2070
- Update ristretto and refactor for use of generics by @paralin in
  https://github.com/hypermodeinc/badger/pull/2047
- chore: Remove obsolete comment by @mitar in https://github.com/hypermodeinc/badger/pull/2039
- chore(Docs): Update jQuery 3.2.1 to 3.7.1 by @kokizzu in
  https://github.com/hypermodeinc/badger/pull/2023
- chore(deps): bump the go_modules group with 3 updates by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2074
- docs(): update docs path by @ryanfoxtyler in https://github.com/hypermodeinc/badger/pull/2076
- perf: fix operation in seek by @harshil-goel in https://github.com/hypermodeinc/badger/pull/2077
- Add lakeFS to README.md by @N-o-Z in https://github.com/hypermodeinc/badger/pull/2078
- chore(): add Dependabot by @ryanfoxtyler in https://github.com/hypermodeinc/badger/pull/2080
- chore(deps): bump golangci/golangci-lint-action from 4 to 6 by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2083
- chore(deps): bump actions/upload-artifact from 3 to 4 by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2081
- chore(deps): bump github/codeql-action from 2 to 3 by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2082
- chore(deps): bump the minor group with 7 updates by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2089
- Action Manager by @madhu72 in https://github.com/hypermodeinc/badger/pull/2050
- chore(deps): bump golang.org/x/sys from 0.23.0 to 0.24.0 in the minor group by @dependabot in
  https://github.com/hypermodeinc/badger/pull/2091
- chore(deps): bump github.com/golang/protobuf from 1.5.3 to 1.5.4 in the patch group by @dependabot
  in https://github.com/hypermodeinc/badger/pull/2090
- chore: fix some comments by @dufucun in https://github.com/hypermodeinc/badger/pull/2092
- chore(deps): bump github.com/google/flatbuffers from 1.12.1 to 24.3.25+incompatible by @dependabot
  in https://github.com/hypermodeinc/badger/pull/2084

**CI**

- ci: change cron frequency to fix ghost jobs by @joshua-goldstein in
  https://github.com/hypermodeinc/badger/pull/2010
- fix(CI): Update to pull_request trigger by @ryanfoxtyler in
  https://github.com/hypermodeinc/badger/pull/2056
- ci/cd optimization by @ryanfoxtyler in https://github.com/hypermodeinc/badger/pull/2051
- fix(cd): fixed cd pipeline by @harshil-goel in https://github.com/hypermodeinc/badger/pull/2093
- fix(cd): change name by @harshil-goel in https://github.com/hypermodeinc/badger/pull/2094
- fix(cd): added more debug things to cd by @harshil-goel in
  https://github.com/hypermodeinc/badger/pull/2095
- fix(cd): removing some debug items by @harshil-goel in
  https://github.com/hypermodeinc/badger/pull/2096

**Full Changelog**: https://github.com/hypermodeinc/badger/compare/v4.2.0...v4.3.0

## [4.2.0] - 2023-08-03

**Breaking**

- feat(metrics): fix and update metrics in badger (#1948)
- fix(metrics): remove badger version in the metrics name (#1982)

**Fixed**

- fix(db): avoid panic in parallel reads after closing DB (#1987)
- fix(logging): fix direct access to logger (#1980)
- fix(sec): bump google.golang.org/grpc from 1.20.1 to 1.53.0 (#1977)
- fix(sec): update gopkg.in/yaml.v2 package (#1969)
- fix(test): fix flakiness of TestPersistLFDiscardStats (#1963)
- fix(stream): setup oracle correctly in stream writer (#1968) (#1904)
- fix(stream): improve incremental stream writer (#1901)
- fix(test): improve the params in BenchmarkDbGrowth (#1967)
- fix(sync): sync active memtable and value log on Db.Sync (#1847) (#1953)
- fix(test): handle draining of closed channel, speed up test. (#1957)
- fix(test): fix table checksum test. Test on uncompressed. (#1952)
- fix(level): change split key range right key to use ts=0 (#1932)
- fix(test): the new test case PagebufferReader5 introduced an error. (#1936)
- fix(test): add missing unlock in TestPersistLFDiscardStats (#1924)
- fix(PageBufferReader): should conform to io.Reader interface (#1935)
- fix(publisher): publish updates after persistence in WAL (#1917)

**CI**

- chore(ci): split off coverage workflow (#1944)
- chore(ci): adding trivy scanning workflow (#1925)

## [4.1.0] - 2023-03-30

This release adds support for incremental stream writer. We also do some cleanup in the docs and
resolve some CI issues for community PR's. We resolve high and medium CVE's and fix
[#1833](https://github.com/hypermodeinc/badger/issues/1833).

**Features**

- feat(stream): add support for incremental stream writer (#1722) (#1874)

**Fixes**

- chore: upgrade xxhash from v1.1.0 to v2.1.2 (#1910) (fixes
  [#1833](https://github.com/hypermodeinc/badger/issues/1833))

**Security**

- chore(deps): bump golang.org/x/net from 0.0.0-20201021035429-f5854403a974 to 0.7.0 (#1885)

**CVEs**

- [CVE-2021-31525](https://github.com/hypermodeinc/badger/security/dependabot/7)
- [CVE-2022-41723](https://github.com/hypermodeinc/badger/security/dependabot/4)
- [CVE-2022-27664](https://github.com/hypermodeinc/badger/security/dependabot/5)
- [CVE-2021-33194](https://github.com/hypermodeinc/badger/security/dependabot/9)
- [CVE-2022-41723](https://github.com/hypermodeinc/badger/security/dependabot/13)
- [CVE-2021-33194](https://github.com/hypermodeinc/badger/security/dependabot/16)
- [CVE-2021-38561](https://github.com/hypermodeinc/badger/security/dependabot/8)

**Chores**

- fix(docs): update README (#1915)
- cleanup sstable file after tests (#1912)
- chore(ci): add dgraph regression tests (#1908)
- docs: fix the default value in docs (#1909)
- chore: update URL for unsupported manifest version error (#1905)
- docs(README): add raft-badger to projects using badger (#1902)
- sync the docs with README with projects using badger (#1903)
- fix: update code comments for WithNumCompactors (#1900)
- docs: add loggie to projects using badger (#1882)
- chore(memtable): refactor code for memtable flush (#1866)
- resolve coveralls issue for community PR's (#1892, #1894, #1896)

## [4.0.1] - 2023-02-28

We issue a follow up release in order to resolve a bug in subscriber. We also generate updated
protobufs for Badger v4.

**Fixed**

- fix(pb): fix generated protos #1888
- fix(publisher): initialize the atomic variable #1889

**Chores**

- chore(cd): tag based deployments #1887
- chore(ci): fail fast when testing #1890

## [4.0.0] - 2023-02-27

> **Warning** The tag v4.0.0 has been retracted due to a bug in publisher. Use v4.0.1 (see #1889)

This release fixes a bug in the maxHeaderSize parameter that could lead to panics. We introduce an
external magic number to keep track of external dependencies. We bump up the minimum required Go
version to 1.19. No changes were made to the format of data on disk. This is a major release because
we are making a switch to SemVer in order to make it easier for the community to understand when
breaking API and data format changes are made.

**Fixed**

- fix: update maxHeaderSize #1877
- feat(externalMagic): Introduce external magic number (#1745) #1852
- fix(bench): bring in benchmark fixes from main #1863

**Chores**

- upgrade go to 1.19 #1868
- enable linters (gosimple, govet, lll, unused, staticcheck, errcheck, ineffassign, gofmt) #1871
  #1870 #1876
- remove dependency on io/ioutil #1879
- various doc and comment fixes #1857
- moving from CalVer to SemVer

## [3.2103.5] - 2022-12-15

We release Badger CLI tool binaries for amd64 and now arm64. This release does not involve any core
code changes to Badger. We add a CD job for building Badger for arm64.

## [3.2103.4] - 2022-11-04

**Fixed**

- fix(manifest): fix manifest corruption due to race condition in concurrent compactions (#1756)

**Chores**

- We bring the release branch to parity with main by updating the CI/CD jobs, Readme, Codeowners, PR
  and issue templates, etc.

## [3.2103.3] - 2022-10-14

**Remarks**

- This is a minor patch release that fixes arm64 related issues. The issues in the `z` package in
  Ristretto were resolved in Ristretto v0.1.1.

**Fixed**

- fix(arm64): bump ristretto v0.1.0 --> v0.1.1 (#1806)

## [3.2103.2] - 2021-10-07

**Fixed**

- fix(compact): close vlog after the compaction at L0 has completed (#1752)
- fix(builder): put the upper limit on reallocation (#1748)
- deps: Bump github.com/google/flatbuffers to v1.12.1 (#1746)
- fix(levels): Avoid a deadlock when acquiring read locks in levels (#1744)
- fix(pubsub): avoid deadlock in publisher and subscriber (#1749) (#1751)

## [3.2103.1] - 2021-07-08

**Fixed**

- fix(compaction): copy over the file ID when building tables #1713
- fix: Fix conflict detection for managed DB (#1716)
- fix(pendingWrites): don't skip the pending entries with version=0 (#1721)

**Features**

- feat(zstd): replace datadog's zstd with Klauspost's zstd (#1709)

## [3.2103.0] - 2021-06-02

**Breaking**

- Subscribe: Add option to subscribe with holes in prefixes. (#1658)

**Fixed**

- fix(compaction): Remove compaction backoff mechanism (#1686)
- Add a name to mutexes to make them unexported (#1678)
- fix(merge-operator): don't read the deleted keys (#1675)
- fix(discard): close the discard stats file on db close (#1672)
- fix(iterator): fix iterator when data does not exist in read only mode (#1670)
- fix(badger): Do not reuse variable across badger commands (#1624)
- fix(dropPrefix): check properly if the key is present in a table (#1623)

**Performance**

- Opt(Stream): Optimize how we deduce key ranges for iteration (#1687)
- Increase value threshold from 1 KB to 1 MB (#1664)
- opt(DropPrefix): check if there exist some data to drop before dropping prefixes (#1621)

**Features**

- feat(options): allow special handling and checking when creating options from superflag (#1688)
- overwrite default Options from SuperFlag string (#1663)
- Support SinceTs in iterators (#1653)
- feat(info): Add a flag to parse and print DISCARD file (#1662)
- feat(vlog): making vlog threshold dynamic 6ce3b7c (#1635)
- feat(options): add NumGoroutines option for default Stream.numGo (#1656)
- feat(Trie): Working prefix match with holes (#1654)
- feat: add functionality to ban a prefix (#1638)
- feat(compaction): Support Lmax to Lmax compaction (#1615)

**New APIs**

- Badger.DB
  - BanNamespace
  - BannedNamespaces
  - Ranges
- Badger.Options
  - FromSuperFlag
  - WithNumGoRoutines
  - WithNamespaceOffset
  - WithVLogPercentile
- Badger.Trie
  - AddMatch
  - DeleteMatch
- Badger.Table
  - StaleDataSize
- Badger.Table.Builder
  - AddStaleKey
- Badger.InitDiscardStats

**Removed APIs**

- Badger.DB
  - KeySplits
- Badger.Options
  - SkipVlog

### Changed APIs

- Badger.DB
  - Subscribe
- Badger.Options
  - WithValueThreshold

## [3.2011.1] - 2021-01-22

**Fixed**

- Fix(compaction): Set base level correctly after stream (#1651)
- Fix: update ristretto and use filepath (#1652)
- Fix(badger): Do not reuse variable across badger commands (#1650)
- Fix(build): fix 32-bit build (#1646)
- Fix(table): always sync SST to disk (#1645)

## [3.2011.0] - 2021-01-15

This release is not backward compatible with Badger v2.x.x

**Breaking**:

- opt(compactions): Improve compaction performance (#1574)
- Change how Badger handles WAL (#1555)
- feat(index): Use flatbuffers instead of protobuf (#1546)

**Fixed**:

- Fix(GC): Set bits correctly for moved keys (#1619)
- Fix(tableBuilding): reduce scope of valuePointer (#1617)
- Fix(compaction): fix table size estimation on compaction (#1613)
- Fix(OOM): Reuse pb.KVs in Stream (#1609)
- Fix race condition in L0StallMs variable (#1605)
- Fix(stream): Stop produceKVs on error (#1604)
- Fix(skiplist): Remove z.Buffer from skiplist (#1600)
- Fix(readonly): fix the file opening mode (#1592)
- Fix: Disable CompactL0OnClose by default (#1586)
- Fix(compaction): Don't drop data when split overlaps with top tables (#1587)
- Fix(subcompaction): Close builder before throttle.Done (#1582)
- Fix(table): Add onDisk size (#1569)
- Fix(Stream): Only send done markers if told to do so
- Fix(value log GC): Fix a bug which caused value log files to not be GCed.
- Fix segmentation fault when cache sizes are small. (#1552)
- Fix(builder): Too many small tables when compression is enabled (#1549)
- Fix integer overflow error when building for 386 (#1541)
- Fix(writeBatch): Avoid deadlock in commit callback (#1529)
- Fix(db): Handle nil logger (#1534)
- Fix(maxVersion): Use choosekey instead of KeyToList (#1532)
- Fix(Backup/Restore): Keep all versions (#1462)
- Fix(build): Fix nocgo builds. (#1493)
- Fix(cleanup): Avoid truncating in value.Open on error (#1465)
- Fix(compaction): Don't use cache for table compaction (#1467)
- Fix(compaction): Use separate compactors for L0, L1 (#1466)
- Fix(options): Do not implicitly enable cache (#1458)
- Fix(cleanup): Do not close cache before compaction (#1464)
- Fix(replay): Update head for LSM entires also (#1456)
- fix(levels): Cleanup builder resources on building an empty table (#1414)

**Performance**

- perf(GC): Remove move keys (#1539)
- Keep the cheaper parts of the index within table struct. (#1608)
- Opt(stream): Use z.Buffer to stream data (#1606)
- opt(builder): Use z.Allocator for building tables (#1576)
- opt(memory): Use z.Calloc for allocating KVList (#1563)
- opt: Small memory usage optimizations (#1562)
- KeySplits checks tables and memtables when number of splits is small. (#1544)
- perf: Reduce memory usage by better struct packing (#1528)
- perf(tableIterator): Don't do next on NewIterator (#1512)
- Improvements: Manual Memory allocation via Calloc (#1459)
- Various bug fixes: Break up list and run DropAll func (#1439)
- Add a limit to the size of the batches sent over a stream. (#1412)
- Commit does not panic after Finish, instead returns an error (#1396)
- levels: Compaction incorrectly drops some delete markers (#1422)
- Remove vlog file if bootstrap, syncDir or mmap fails (#1434)

**Features**:

- Use opencensus for tracing (#1566)
- Export functions from Key Registry (#1561)
- Allow sizes of block and index caches to be updated. (#1551)
- Add metric for number of tables being compacted (#1554)
- feat(info): Show index and bloom filter size (#1543)
- feat(db): Add db.MaxVersion API (#1526)
- Expose DB options in Badger. (#1521)
- Feature: Add a Calloc based Buffer (#1471)
- Add command to stream contents of DB into another DB. (#1463)
- Expose NumAlloc metrics via expvar (#1470)
- Support fully disabling the bloom filter (#1319)
- Add --enc-key flag in badger info tool (#1441)

**New APIs**

- Badger.DB
  - CacheMaxCost (#1551)
  - Levels (#1574)
  - LevelsToString (#1574)
  - Opts (#1521)
- Badger.Options
  - WithBaseLevelSize (#1574)
  - WithBaseTableSize (#1574)
  - WithMemTableSize (#1574)
- Badger.KeyRegistry
  - DataKey (#1561)
  - LatestDataKey (#1561)

**Removed APIs**

- Badger.Options
  - WithKeepL0InMemory (#1555)
  - WithLevelOneSize (#1574)
  - WithLoadBloomsOnOpen (#1555)
  - WithLogRotatesToFlush (#1574)
  - WithMaxTableSize (#1574)
  - WithTableLoadingMode (#1555)
  - WithTruncate (#1555)
  - WithValueLogLoadingMode (#1555)

## [2.2007.4] - 2021-08-25

**Fixed**

- Fix build on Plan 9 (#1451) (#1508) (#1738)

**Features**

- feat(zstd): backport replacement of DataDog's zstd with Klauspost's zstd (#1736)

## [2.2007.3] - 2021-07-21

**Fixed**

- fix(maxVersion): Use choosekey instead of KeyToList (#1532) #1533
- fix(flatten): Add --num_versions flag (#1518) #1520
- fix(build): Fix integer overflow on 32-bit architectures #1558
- fix(pb): avoid protobuf warning due to common filename (#1519)

**Features**

- Add command to stream contents of DB into another DB. (#1486)

**New APIs**

- DB.StreamDB
- DB.MaxVersion

## [2.2007.2] - 2020-08-31

**Fixed**

- Compaction: Use separate compactors for L0, L1 (#1466)
- Rework Block and Index cache (#1473)
- Add IsClosed method (#1478)
- Cleanup: Avoid truncating in vlog.Open on error (#1465)
- Cleanup: Do not close cache before compactions (#1464)

**New APIs**

- Badger.DB
  - BlockCacheMetrics (#1473)
  - IndexCacheMetrics (#1473)
- Badger.Option
  - WithBlockCacheSize (#1473)
  - WithIndexCacheSize (#1473)

**Removed APIs** [Breaking Changes]

- Badger.DB
  - DataCacheMetrics (#1473)
  - BfCacheMetrics (#1473)
- Badger.Option
  - WithMaxCacheSize (#1473)
  - WithMaxBfCacheSize (#1473)
  - WithKeepBlockIndicesInCache (#1473)
  - WithKeepBlocksInCache (#1473)

## [2.2007.1] - 2020-08-19

**Fixed**

- Remove vlog file if bootstrap, syncDir or mmap fails (#1434)
- levels: Compaction incorrectly drops some delete markers (#1422)
- Replay: Update head for LSM entires also (#1456)

## [2.2007.0] - 2020-08-10

**Fixed**

- Add a limit to the size of the batches sent over a stream. (#1412)
- Fix Sequence generates duplicate values (#1281)
- Fix race condition in DoesNotHave (#1287)
- Fail fast if cgo is disabled and compression is ZSTD (#1284)
- Proto: make badger/v2 compatible with v1 (#1293)
- Proto: Rename dgraph.badger.v2.pb to badgerpb2 (#1314)
- Handle duplicates in ManagedWriteBatch (#1315)
- Ensure `bitValuePointer` flag is cleared for LSM entry values written to LSM (#1313)
- DropPrefix: Return error on blocked writes (#1329)
- Confirm `badgerMove` entry required before rewrite (#1302)
- Drop move keys when its key prefix is dropped (#1331)
- Iterator: Always add key to txn.reads (#1328)
- Restore: Account for value size as well (#1358)
- Compaction: Expired keys and delete markers are never purged (#1354)
- GC: Consider size of value while rewriting (#1357)
- Force KeepL0InMemory to be true when InMemory is true (#1375)
- Rework DB.DropPrefix (#1381)
- Update head while replaying value log (#1372)
- Avoid panic on multiple closer.Signal calls (#1401)
- Return error if the vlog writes exceeds more than 4GB (#1400)

**Performance**

- Clean up transaction oracle as we go (#1275)
- Use cache for storing block offsets (#1336)

**Features**

- Support disabling conflict detection (#1344)
- Add leveled logging (#1249)
- Support entry version in Write batch (#1310)
- Add Write method to batch write (#1321)
- Support multiple iterators in read-write transactions (#1286)

**New APIs**

- Badger.DB
  - NewManagedWriteBatch (#1310)
  - DropPrefix (#1381)
- Badger.Option
  - WithDetectConflicts (#1344)
  - WithKeepBlockIndicesInCache (#1336)
  - WithKeepBlocksInCache (#1336)
- Badger.WriteBatch
  - DeleteAt (#1310)
  - SetEntryAt (#1310)
  - Write (#1321)

### Changes to Default Options

- DefaultOptions: Set KeepL0InMemory to false (#1345)
- Increase default valueThreshold from 32B to 1KB (#1346)

### Deprecated

- Badger.Option
  - WithEventLogging (#1203)

### Reverts

This sections lists the changes which were reverted because of non-reproducible crashes.

- Compress/Encrypt Blocks in the background (#1227)

## [2.0.3] - 2020-03-24

**Fixed**

- Add support for watching nil prefix in subscribe API (#1246)

**Performance**

- Compress/Encrypt Blocks in the background (#1227)
- Disable cache by default (#1257)

**Features**

- Add BypassDirLock option (#1243)
- Add separate cache for bloomfilters (#1260)

**New APIs**

- badger.DB
  - BfCacheMetrics (#1260)
  - DataCacheMetrics (#1260)
- badger.Options
  - WithBypassLockGuard (#1243)
  - WithLoadBloomsOnOpen (#1260)
  - WithMaxBfCacheSize (#1260)

## [2.0.2] - 2020-03-02

**Fixed**

- Cast sz to uint32 to fix compilation on 32 bit. (#1175)
- Fix checkOverlap in compaction. (#1166)
- Avoid sync in inmemory mode. (#1190)
- Support disabling the cache completely. (#1185)
- Add support for caching bloomfilters. (#1204)
- Fix int overflow for 32bit. (#1216)
- Remove the 'this entry should've caught' log from value.go. (#1170)
- Rework concurrency semantics of valueLog.maxFid. (#1187)

**Performance**

- Use fastRand instead of locked-rand in skiplist. (#1173)
- Improve write stalling on level 0 and 1. (#1186)
- Disable compression and set ZSTD Compression Level to 1. (#1191)

## [2.0.1] - 2020-01-02

**New APIs**

- badger.Options

  - WithInMemory (f5b6321)
  - WithZSTDCompressionLevel (3eb4e72)

- Badger.TableInfo
  - EstimatedSz (f46f8ea)

**Features**

- Introduce in-memory mode in badger. (#1113)

**Fixed**

- Limit manifest's change set size. (#1119)
- Cast idx to uint32 to fix compilation on i386. (#1118)
- Fix request increment ref bug. (#1121)
- Fix windows dataloss issue. (#1134)
- Fix VerifyValueChecksum checks. (#1138)
- Fix encryption in stream writer. (#1146)
- Fix segmentation fault in vlog.Read. (header.Decode) (#1150)
- Fix merge iterator duplicates issue. (#1157)

**Performance**

- Set level 15 as default compression level in Zstd. (#1111)
- Optimize createTable in stream_writer.go. (#1132)

## [2.0.0] - 2019-11-12

**New APIs**

- badger.DB

  - NewWriteBatchAt (7f43769)
  - CacheMetrics (b9056f1)

- badger.Options
  - WithMaxCacheSize (b9056f1)
  - WithEventLogging (75c6a44)
  - WithBlockSize (1439463)
  - WithBloomFalsePositive (1439463)
  - WithKeepL0InMemory (ee70ff2)
  - WithVerifyValueChecksum (ee70ff2)
  - WithCompression (5f3b061)
  - WithEncryptionKey (a425b0e)
  - WithEncryptionKeyRotationDuration (a425b0e)
  - WithChecksumVerificationMode (7b4083d)

**Features**

- Data cache to speed up lookups and iterations. (#1066)
- Data compression. (#1013)
- Data encryption-at-rest. (#1042)

**Fixed**

- Fix deadlock when flushing discard stats. (#976)
- Set move key's expiresAt for keys with TTL. (#1006)
- Fix unsafe usage in Decode. (#1097)
- Fix race condition on db.orc.nextTxnTs. (#1101)
- Fix level 0 GC dataloss bug. (#1090)
- Fix deadlock in discard stats. (#1070)
- Support checksum verification for values read from vlog. (#1052)
- Store entire L0 in memory. (#963)
- Fix table.Smallest/Biggest and iterator Prefix bug. (#997)
- Use standard proto functions for Marshal/Unmarshal and Size. (#994)
- Fix boundaries on GC batch size. (#987)
- VlogSize to store correct directory name to expvar.Map. (#956)
- Fix transaction too big issue in restore. (#957)
- Fix race condition in updateDiscardStats. (#973)
- Cast results of len to uint32 to fix compilation in i386 arch. (#961)
- Making the stream writer APIs goroutine-safe. (#959)
- Fix prefix bug in key iterator and allow all versions. (#950)
- Drop discard stats if we can't unmarshal it. (#936)
- Fix race condition in flushDiscardStats function. (#921)
- Ensure rewrite in vlog is within transactional limits. (#911)
- Fix discard stats moved by GC bug. (#929)
- Fix busy-wait loop in Watermark. (#920)

**Performance**

- Introduce fast merge iterator. (#1080)
- Binary search based table picker. (#983)
- Flush vlog buffer if it grows beyond threshold. (#1067)
- Introduce StreamDone in Stream Writer. (#1061)
- Performance Improvements to block iterator. (#977)
- Prevent unnecessary safecopy in iterator parseKV. (#971)
- Use pointers instead of binary encoding. (#965)
- Reuse block iterator inside table iterator. (#972)
- [breaking/format] Remove vlen from entry header. (#945)
- Replace FarmHash with AESHash for Oracle conflicts. (#952)
- [breaking/format] Optimize Bloom filters. (#940)
- [breaking/format] Use varint for header encoding (without header length). (#935)
- Change file picking strategy in compaction. (#894)
- [breaking/format] Block level changes. (#880)
- [breaking/format] Add key-offset index to the end of SST table. (#881)

## [1.6.0] - 2019-07-01

This is a release including almost 200 commits, so expect many changes - some of them not backward
compatible.

Regarding backward compatibility in Badger versions, you might be interested on reading
[VERSIONING.md](VERSIONING.md).

_Note_: The hashes in parentheses correspond to the commits that impacted the given feature.

**New APIs**

- badger.DB

  - DropPrefix (291295e)
  - Flatten (7e41bba)
  - KeySplits (4751ef1)
  - MaxBatchCount (b65e2a3)
  - MaxBatchSize (b65e2a3)
  - PrintKeyValueHistogram (fd59907)
  - Subscribe (26128a7)
  - Sync (851e462)

- badger.DefaultOptions() and badger.LSMOnlyOptions() (91ce687)

  - badger.Options.WithX methods

- badger.Entry (e9447c9)

  - NewEntry
  - WithMeta
  - WithDiscard
  - WithTTL

- badger.Item

  - KeySize (fd59907)
  - ValueSize (5242a99)

- badger.IteratorOptions

  - PickTable (7d46029, 49a49e3)
  - Prefix (7d46029)

- badger.Logger (fbb2778)

- badger.Options

  - CompactL0OnClose (7e41bba)
  - Logger (3f66663)
  - LogRotatesToFlush (2237832)

- badger.Stream (14cbd89, 3258067)
- badger.StreamWriter (7116e16)
- badger.TableInfo.KeyCount (fd59907)
- badger.TableManifest (2017987)
- badger.Tx.NewKeyIterator (49a49e3)
- badger.WriteBatch (6daccf9, 7e78e80)

**Modified APIs**

**Breaking**

- badger.DefaultOptions and badger.LSMOnlyOptions are now functions rather than variables (91ce687)
- badger.Item.Value now receives a function that returns an error (439fd46)
- badger.Txn.Commit doesn't receive any params now (6daccf9)
- badger.DB.Tables now receives a boolean (76b5341)

**Features**

- badger.LSMOptions changed values (799c33f)
- badger.DB.NewIterator now allows multiple iterators per RO txn (41d9656)
- badger.Options.TableLoadingMode's new default is options.MemoryMap (6b97bac)

**Removed APIs**

- badger.ManagedDB (d22c0e8)
- badger.Options.DoNotCompact (7e41bba)
- badger.Txn.SetWithX (e9447c9)

**Tools**

- badger bank disect (13db058)
- badger bank test (13db058) --mmap (03870e3)
- badger fill (7e41bba)
- badger flatten (7e41bba)
- badger info --histogram (fd59907) --history --lookup --show-keys --show-meta --with-prefix
  (09e9b63) --show-internal (fb2eed9)
- badger benchmark read (239041e)
- badger benchmark write (6d3b67d)

## [1.5.5] - 2019-06-20

- Introduce support for Go Modules

## [1.5.3] - 2018-07-11

Bug Fixes:

- Fix a panic caused due to item.vptr not copying over vs.Value, when looking for a move key.

## [1.5.2] - 2018-06-19

Bug Fixes:

- Fix the way move key gets generated.
- If a transaction has unclosed, or multiple iterators running simultaneously, throw a panic. Every
  iterator must be properly closed. At any point in time, only one iterator per transaction can be
  running. This is to avoid bugs in a transaction data structure which is thread unsafe.

- _Warning: This change might cause panics in user code. Fix is to properly close your iterators,
  and only have one running at a time per transaction._

## [1.5.1] - 2018-06-04

Bug Fixes:

- Fix for infinite yieldItemValue recursion. #503
- Fix recursive addition of `badgerMove` prefix.
  https://github.com/hypermodeinc/badger/commit/2e3a32f0ccac3066fb4206b28deb39c210c5266f
- Use file size based window size for sampling, instead of fixing it to 10MB. #501

Cleanup:

- Clarify comments and documentation.
- Move badger tool one directory level up.

## [1.5.0] - 2018-05-08

- Introduce `NumVersionsToKeep` option. This option is used to discard many versions of the same
  key, which saves space.
- Add a new `SetWithDiscard` method, which would indicate that all the older versions of the key are
  now invalid. Those versions would be discarded during compactions.
- Value log GC moves are now bound to another keyspace to ensure latest versions of data are always
  at the top in LSM tree.
- Introduce `ValueLogMaxEntries` to restrict the number of key-value pairs per value log file. This
  helps bound the time it takes to garbage collect one file.

## [1.4.0] - 2018-05-04

- Make mmap-ing of value log optional.
- Run GC multiple times, based on recorded discard statistics.
- Add MergeOperator.
- Force compact L0 on clsoe (#439).
- Add truncate option to warn about data loss (#452).
- Discard key versions during compaction (#464).
- Introduce new `LSMOnlyOptions`, to make Badger act like a typical LSM based DB.

Bug fix:

- (Temporary) Check max version across all tables in Get (removed in next release).
- Update commit and read ts while loading from backup.
- Ensure all transaction entries are part of the same value log file.
- On commit, run unlock callbacks before doing writes (#413).
- Wait for goroutines to finish before closing iterators (#421).

## [1.3.0] - 2017-12-12

- Add `DB.NextSequence()` method to generate monotonically increasing integer sequences.
- Add `DB.Size()` method to return the size of LSM and value log files.
- Tweaked mmap code to make Windows 32-bit builds work.
- Tweaked build tags on some files to make iOS builds work.
- Fix `DB.PurgeOlderVersions()` to not violate some constraints.

## [1.2.0] - 2017-11-30

- Expose a `Txn.SetEntry()` method to allow setting the key-value pair and all the metadata at the
  same time.

## [1.1.1] - 2017-11-28

- Fix bug where txn.Get was returing key deleted in same transaction.
- Fix race condition while decrementing reference in oracle.
- Update doneCommit in the callback for CommitAsync.
- Iterator see writes of current txn.

## [1.1.0] - 2017-11-13

- Create Badger directory if it does not exist when `badger.Open` is called.
- Added `Item.ValueCopy()` to avoid deadlocks in long-running iterations
- Fixed 64-bit alignment issues to make Badger run on Arm v7

## [1.0.1] - 2017-11-06

- Fix an uint16 overflow when resizing key slice

[Unreleased]: https://github.com/hypermodeinc/badger/compare/v2.2007.2...HEAD
[2.2007.2]: https://github.com/hypermodeinc/badger/compare/v2.2007.1...v2.2007.2
[2.2007.1]: https://github.com/hypermodeinc/badger/compare/v2.2007.0...v2.2007.1
[2.2007.0]: https://github.com/hypermodeinc/badger/compare/v2.0.3...v2.2007.0
[2.0.3]: https://github.com/hypermodeinc/badger/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/hypermodeinc/badger/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/hypermodeinc/badger/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/hypermodeinc/badger/compare/v1.6.0...v2.0.0
[1.6.0]: https://github.com/hypermodeinc/badger/compare/v1.5.5...v1.6.0
[1.5.5]: https://github.com/hypermodeinc/badger/compare/v1.5.3...v1.5.5
[1.5.3]: https://github.com/hypermodeinc/badger/compare/v1.5.2...v1.5.3
[1.5.2]: https://github.com/hypermodeinc/badger/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/hypermodeinc/badger/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/hypermodeinc/badger/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/hypermodeinc/badger/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/hypermodeinc/badger/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/hypermodeinc/badger/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/hypermodeinc/badger/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/hypermodeinc/badger/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/hypermodeinc/badger/compare/v1.0.0...v1.0.1
