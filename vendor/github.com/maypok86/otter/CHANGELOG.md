## 1.2.4 - 2024-11-23

### 🐞 Bug Fixes

- Fixed a bug due to changing [gammazero/deque](https://github.com/gammazero/deque/pull/33) contracts without v2 release. ([#112](https://github.com/maypok86/otter/issues/112))

## 1.2.3 - 2024-09-30

### 🐞 Bug Fixes

- Added collection of eviction statistics for expired entries. ([#108](https://github.com/maypok86/otter/issues/108))

## 1.2.2 - 2024-08-14

### ✨️Features

- Implemented `fmt.Stringer` interface for `DeletionReason` type ([#100](https://github.com/maypok86/otter/issues/100))

### 🐞 Bug Fixes

- Fixed processing of an expired entry in the `Get` method ([#98](https://github.com/maypok86/otter/issues/98))
- Fixed inconsistent deletion listener behavior ([#98](https://github.com/maypok86/otter/issues/98))
- Fixed the behavior of `checkedAdd` when over/underflow ([#91](https://github.com/maypok86/otter/issues/91))

## 1.2.1 - 2024-04-15

### 🐞 Bug Fixes

- Fixed uint32 capacity overflow.

## 1.2.0 - 2024-03-12

The main innovation of this release is the addition of an `Extension`, which makes it easy to add a huge number of features to otter.

Usage example:

```go
key := 1
...
entry, ok := cache.Extension().GetEntry(key)
...
key := entry.Key()
value := entry.Value()
cost := entry.Cost()
expiration := entry.Expiration()
ttl := entry.TTL()
hasExpired := entry.HasExpired()
```

### ✨️Features

- Added `DeletionListener` to the builder ([#63](https://github.com/maypok86/otter/issues/63))
- Added `Extension` ([#56](https://github.com/maypok86/otter/issues/56))

### 🚀 Improvements

- Added support for Go 1.22
- Memory consumption with small cache sizes is reduced to the level of other libraries ([#66](https://github.com/maypok86/otter/issues/66))

## 1.1.1 - 2024-03-06

### 🐞 Bug Fixes

- Fixed alignment issues on 32-bit archs

## 1.1.0 - 2024-03-04

The main innovation of this release is node code generation. Thanks to it, the cache will no longer consume more memory due to features that it does not use. For example, if you do not need an expiration policy, then otter will not store the expiration time of each entry. It also allows otter to use more effective expiration policies.

Another expected improvement is the correction of minor synchronization problems due to the state machine. Now otter, unlike other contention-free caches in Go, should not have them at all.

### ✨️Features

- Added `DeleteByFunc` function to cache ([#44](https://github.com/maypok86/otter/issues/44))
- Added `InitialCapacity` function to builder ([#47](https://github.com/maypok86/otter/issues/47))
- Added collection of additional statistics ([#57](https://github.com/maypok86/otter/issues/57))

### 🚀 Improvements

- Added proactive queue-based and timer wheel-based expiration policies with O(1) time complexity ([#55](https://github.com/maypok86/otter/issues/55))
- Added node code generation ([#55](https://github.com/maypok86/otter/issues/55))
- Fixed the race condition when changing the order of events ([#59](https://github.com/maypok86/otter/issues/59))
- Reduced memory consumption on small caches

## 1.0.0 - 2024-01-26

### ✨️Features

- Builder pattern support
- Cleaner API compared to other caches ([#40](https://github.com/maypok86/otter/issues/40))
- Added `SetIfAbsent` and `Range` functions ([#27](https://github.com/maypok86/otter/issues/27))
- Statistics collection ([#4](https://github.com/maypok86/otter/issues/4))
- Cost based eviction
- Support for generics and any comparable types as keys
- Support ttl ([#14](https://github.com/maypok86/otter/issues/14))
- Excellent speed ([benchmark results](https://github.com/maypok86/otter?tab=readme-ov-file#-performance-))
- O(1) worst case time complexity for S3-FIFO instead of O(n)
- Improved hit ratio of S3-FIFO on many traces ([simulator results](https://github.com/maypok86/otter?tab=readme-ov-file#-hit-ratio-))
