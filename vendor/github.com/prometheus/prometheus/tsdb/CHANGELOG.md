## master / unreleased

## 0.10.0

 - [FEATURE] Added `DBReadOnly` to allow opening a database in read only mode.
    - `DBReadOnly.Blocks()` exposes a slice of `BlockReader`s.
    - `BlockReader` interface - removed MinTime/MaxTime methods and now exposes the full block meta via `Meta()`.
 - [FEATURE] `chunkenc.Chunk.Iterator` method now takes a `chunkenc.Iterator` interface as an argument for reuse.

## 0.9.1

 - [CHANGE] LiveReader metrics are now injected rather than global.

## 0.9.0

 - [FEATURE] Provide option to compress WAL records using Snappy. [#609](https://github.com/prometheus/tsdb/pull/609)
 - [BUGFIX] Re-calculate block size when calling `block.Delete`.
 - [BUGFIX] Re-encode all head chunks at compaction that are open (being appended to) or outside the Maxt block range. This avoids writing out corrupt data. It happens when snapshotting with the head included.
 - [BUGFIX] Improved handling of multiple refs for the same series in WAL reading.
 - [BUGFIX] `prometheus_tsdb_compactions_failed_total` is now incremented on any compaction failure.
 - [CHANGE] The meta file `BlockStats` no longer holds size information. This is now dynamically calculated and kept in memory. It also includes the meta file size which was not included before.
 - [CHANGE] Create new clean segment when starting the WAL.
 - [CHANGE] Renamed metric from `prometheus_tsdb_wal_reader_corruption_errors` to `prometheus_tsdb_wal_reader_corruption_errors_total`.
 - [ENHANCEMENT] Improved atomicity of .tmp block replacement during compaction for usual case.
 - [ENHANCEMENT] Improved postings intersection matching.
 - [ENHANCEMENT] Reduced disk usage for WAL for small setups.
 - [ENHANCEMENT] Optimize queries using regexp for set lookups.


## 0.8.0

 - [BUGFIX] Calling `Close` more than once on a querier returns an error instead of a panic.
 - [BUGFIX] Don't panic and recover nicely when running out of disk space.
 - [BUGFIX] Correctly handle empty labels.
 - [BUGFIX] Don't crash on an unknown tombstone ref.
 - [ENHANCEMENT] Re-add FromData function to create a chunk from bytes. It is used by Cortex and Thanos.
 - [ENHANCEMENT] Simplify mergedPostings.Seek.
 - [FEATURE]  Added `currentSegment` metric for the current WAL segment it is being written to.

## 0.7.1

 - [ENHANCEMENT] Reduce memory usage in mergedPostings.Seek

## 0.7.0

 - [CHANGE] tsdb now requires golang 1.12 or higher.
 - [REMOVED] `chunks.NewReader` is removed as it wasn't used anywhere.
 - [REMOVED] `FromData` is considered unused so was removed.
 - [FEATURE] Added option WALSegmentSize -1 to disable the WAL.
 - [BUGFIX] Bugfix in selectOverlappingDirs. Only return the first overlapping blocks.
 - [BUGFIX] Fsync the meta file to persist it on disk to avoid data loss in case of a host crash.
 - [BUGFIX] Fix fd and vm_area leak on error path in chunks.NewDirReader.
 - [BUGFIX] Fix fd and vm_area leak on error path in index.NewFileReader.
 - [BUGFIX] Force persisting the tombstone file to avoid data loss in case of a host crash.
 - [BUGFIX] Keep series that are still in WAL in checkpoints.
 - [ENHANCEMENT] Fast path for EmptyPostings cases in Merge, Intersect and Without.
 - [ENHANCEMENT] Be smarter in how we look at matchers.
 - [ENHANCEMENT] PostListings and NotMatcher now public.

## 0.6.1

  - [BUGFIX] Update `last` after appending a non-overlapping chunk in `chunks.MergeOverlappingChunks`. [#539](https://github.com/prometheus/tsdb/pull/539)

## 0.6.0

  - [CHANGE] `AllowOverlappingBlock` is now `AllowOverlappingBlocks`.

## 0.5.0

 - [FEATURE] Time-overlapping blocks are now allowed. [#370](https://github.com/prometheus/tsdb/pull/370)
   - Disabled by default and can be enabled via `AllowOverlappingBlock` option.
   - Added `MergeChunks` function in `chunkenc/xor.go` to merge 2 time-overlapping chunks.
   - Added `MergeOverlappingChunks` function in `chunks/chunks.go` to merge multiple time-overlapping Chunk Metas.
   - Added `MinTime` and `MaxTime` method for `BlockReader`.
 - [FEATURE] New `dump` command to tsdb tool to dump all samples.
 - [FEATURE] New `encoding` package for common binary encoding/decoding helpers.
    - Added to remove some code duplication.
 - [ENHANCEMENT] When closing the db any running compaction will be cancelled so it doesn't block.
   - `NewLeveledCompactor` takes a context.
 - [CHANGE] `prometheus_tsdb_storage_blocks_bytes_total` is now `prometheus_tsdb_storage_blocks_bytes`.
 - [BUGFIX] Improved Postings Merge performance. Fixes a regression from the previous release.
 - [BUGFIX] LiveReader can get into an infinite loop on corrupt WALs.

## 0.4.0

 - [CHANGE] New `WALSegmentSize` option to override the `DefaultOptions.WALSegmentSize`. Added to allow using smaller wal files. For example using tmpfs on a RPI to minimise the SD card wear out from the constant WAL writes. As part of this change the `DefaultOptions.WALSegmentSize` constant was also exposed.
 - [CHANGE] Empty blocks are not written during compaction [#374](https://github.com/prometheus/tsdb/pull/374)
 - [FEATURE]  Size base retention through `Options.MaxBytes`.  As part of this change:
   - Added new metrics - `prometheus_tsdb_storage_blocks_bytes_total`, `prometheus_tsdb_size_retentions_total`, `prometheus_tsdb_time_retentions_total`
   - New public interface `SizeReader: Size() int64`
   - `OpenBlock` signature changed to take a logger.
 - [REMOVED] `PrefixMatcher` is considered unused so was removed.
 - [CLEANUP] `Options.WALFlushInterval` is removed as it wasn't used anywhere.
 - [FEATURE] Add new `LiveReader` to WAL package. Added to allow live tailing of a WAL segment, used by Prometheus Remote Write after refactor. The main difference between the new reader and the existing `Reader` is that for `LiveReader` a call to `Next()` that returns false does not mean that there will never be more data to read.

## 0.3.1

 - [BUGFIX] Fixed most windows test and some actual bugs for unclosed file readers.

## 0.3.0

 - [CHANGE] `LastCheckpoint()` used to return just the segment name and now it returns the full relative path.
 - [CHANGE] `NewSegmentsRangeReader()` can now read over multiple wal ranges by using the new `SegmentRange{}` struct.
 - [CHANGE] `CorruptionErr{}` now also exposes the Segment `Dir` which is added when displaying any errors.
 - [CHANGE] `Head.Init()` is changed to `Head.Init(minValidTime int64)`
 - [CHANGE] `SymbolTable()` renamed to `SymbolTableSize()` to make the name consistent with the  `Block{ symbolTableSize uint64 }` field.
 - [CHANGE] `wal.Reader{}` now exposes `Segment()` for the current segment being read  and `Offset()` for the current offset.
 - [FEATURE] tsdbutil analyze subcomand to find churn, high cardinality, etc.
