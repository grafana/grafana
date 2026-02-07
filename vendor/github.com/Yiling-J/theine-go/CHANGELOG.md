## 0.6.1 (2025-03-02)

### API Changes:
-  the `StringKey` method is marked as deprecated starting from Go 1.24. See https://github.com/Yiling-J/theine-go/pull/61 for more details.

### Enhancements:
- Fix data race after `Close`: https://github.com/Yiling-J/theine-go/pull/60
- Use `maphash.Comparable` as the hash function for Go 1.24 onward https://github.com/Yiling-J/theine-go/pull/61

## 0.6.0 (2024-10-29)

### API Changes:
- Added a new option, `UseEntryPool`, to the builder, which defaults to false. Enabling this option will reuse evicted entries through a sync pool. The sync pool was used by default before v0.6.0 and could not be turned off; but it only benefits systems optimized for allocation and those with heavy concurrent writes. See the README for more details.

### Enhancements:
- Theine now uses a single LRU window as the "W" part of W-TinyLFU, adaptively changing its size based on hit ratio. This approach is consistent with Caffeine and should improve hit ratios across various workloads.

## 0.5.0 (2024-10-10)

### API Changes:
- The NVM secondary cache has been moved to a separate package: https://github.com/Yiling-J/theine-nvm.

### Enhancements:
- Reduced `Set` allocations, making Theine zero allocation (amortized).
- Improved read performance slightly by utilizing a cached `now` value.
- Fixed race conditions in cost (weight) updates that could cause inaccurate policy cost.
- Added benchmarks for different `GOMAXPROC` values in the README.

## 0.4.1 (2024-08-22)

### Enhancements:
* Use x/sys/cpu cacheline size by @Yiling-J in https://github.com/Yiling-J/theine-go/pull/43
* Add Size method on cache by @nlachfr in https://github.com/Yiling-J/theine-go/pull/41
* Accurate hits/misses counter by @Yiling-J in https://github.com/Yiling-J/theine-go/pull/44
* Add stats API by @Yiling-J in https://github.com/Yiling-J/theine-go/pull/45
