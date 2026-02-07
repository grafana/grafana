# xsync benchmarks

If you're interested in `MapOf` comparison with some of the popular concurrent hash maps written in Go, check [this](https://github.com/cornelk/hashmap/pull/70) and [this](https://github.com/alphadose/haxmap/pull/22) PRs.

The below results were obtained for xsync v2.3.1 on a c6g.metal EC2 instance (64 CPU, 128GB RAM) running Linux and Go 1.19.3. I'd like to thank [@felixge](https://github.com/felixge) who kindly ran the benchmarks.

The following commands were used to run the benchmarks:
```bash
$ go test -run='^$' -cpu=1,2,4,8,16,32,64 -bench . -count=30 -timeout=0 | tee bench.txt
$ benchstat bench.txt | tee benchstat.txt
```

The below sections contain some of the results. Refer to [this gist](https://gist.github.com/puzpuzpuz/e62e38e06feadecfdc823c0f941ece0b) for the complete output.

Please note that `MapOf` got a number of optimizations since v2.3.1, so the current result is likely to be different.

### Counter vs. atomic int64

```
name                                            time/op
Counter                                         27.3ns ± 1%
Counter-2                                       27.2ns ±11%
Counter-4                                       15.3ns ± 8%
Counter-8                                       7.43ns ± 7%
Counter-16                                      3.70ns ±10%
Counter-32                                      1.77ns ± 3%
Counter-64                                      0.96ns ±10%
AtomicInt64                                     7.60ns ± 0%
AtomicInt64-2                                   12.6ns ±13%
AtomicInt64-4                                   13.5ns ±14%
AtomicInt64-8                                   12.7ns ± 9%
AtomicInt64-16                                  12.8ns ± 8%
AtomicInt64-32                                  13.0ns ± 6%
AtomicInt64-64                                  12.9ns ± 7%
```

Here `time/op` stands for average time spent on operation. If you divide `10^9` by the result in nanoseconds per operation, you'd get the throughput in operations per second. Thus, the ideal theoretical scalability of a concurrent data structure implies that the reported `time/op` decreases proportionally with the increased number of CPU cores. On the contrary, if the measured time per operation increases when run on more cores, it means performance degradation.

### MapOf vs. sync.Map

1,000 `[int, int]` entries with a warm-up, 100% Loads:
```
IntegerMapOf_WarmUp/reads=100%                  24.0ns ± 0%
IntegerMapOf_WarmUp/reads=100%-2                12.0ns ± 0%
IntegerMapOf_WarmUp/reads=100%-4                6.02ns ± 0%
IntegerMapOf_WarmUp/reads=100%-8                3.01ns ± 0%
IntegerMapOf_WarmUp/reads=100%-16               1.50ns ± 0%
IntegerMapOf_WarmUp/reads=100%-32               0.75ns ± 0%
IntegerMapOf_WarmUp/reads=100%-64               0.38ns ± 0%
IntegerMapStandard_WarmUp/reads=100%            55.3ns ± 0%
IntegerMapStandard_WarmUp/reads=100%-2          27.6ns ± 0%
IntegerMapStandard_WarmUp/reads=100%-4          16.1ns ± 3%
IntegerMapStandard_WarmUp/reads=100%-8          8.35ns ± 7%
IntegerMapStandard_WarmUp/reads=100%-16         4.24ns ± 7%
IntegerMapStandard_WarmUp/reads=100%-32         2.18ns ± 6%
IntegerMapStandard_WarmUp/reads=100%-64         1.11ns ± 3%
```

1,000 `[int, int]` entries with a warm-up, 99% Loads, 0.5% Stores, 0.5% Deletes:
```
IntegerMapOf_WarmUp/reads=99%                   31.0ns ± 0%
IntegerMapOf_WarmUp/reads=99%-2                 16.4ns ± 1%
IntegerMapOf_WarmUp/reads=99%-4                 8.42ns ± 0%
IntegerMapOf_WarmUp/reads=99%-8                 4.41ns ± 0%
IntegerMapOf_WarmUp/reads=99%-16                2.38ns ± 2%
IntegerMapOf_WarmUp/reads=99%-32                1.37ns ± 4%
IntegerMapOf_WarmUp/reads=99%-64                0.85ns ± 2%
IntegerMapStandard_WarmUp/reads=99%              121ns ± 1%
IntegerMapStandard_WarmUp/reads=99%-2            109ns ± 3%
IntegerMapStandard_WarmUp/reads=99%-4            115ns ± 4%
IntegerMapStandard_WarmUp/reads=99%-8            114ns ± 2%
IntegerMapStandard_WarmUp/reads=99%-16           105ns ± 2%
IntegerMapStandard_WarmUp/reads=99%-32          97.0ns ± 3%
IntegerMapStandard_WarmUp/reads=99%-64          98.0ns ± 2%
```

1,000 `[int, int]` entries with a warm-up, 75% Loads, 12.5% Stores, 12.5% Deletes:
```
IntegerMapOf_WarmUp/reads=75%-reads             46.2ns ± 1%
IntegerMapOf_WarmUp/reads=75%-reads-2           36.7ns ± 2%
IntegerMapOf_WarmUp/reads=75%-reads-4           22.0ns ± 1%
IntegerMapOf_WarmUp/reads=75%-reads-8           12.8ns ± 2%
IntegerMapOf_WarmUp/reads=75%-reads-16          7.69ns ± 1%
IntegerMapOf_WarmUp/reads=75%-reads-32          5.16ns ± 1%
IntegerMapOf_WarmUp/reads=75%-reads-64          4.91ns ± 1%
IntegerMapStandard_WarmUp/reads=75%-reads        156ns ± 0%
IntegerMapStandard_WarmUp/reads=75%-reads-2      177ns ± 1%
IntegerMapStandard_WarmUp/reads=75%-reads-4      197ns ± 1%
IntegerMapStandard_WarmUp/reads=75%-reads-8      221ns ± 2%
IntegerMapStandard_WarmUp/reads=75%-reads-16     242ns ± 1%
IntegerMapStandard_WarmUp/reads=75%-reads-32     258ns ± 1%
IntegerMapStandard_WarmUp/reads=75%-reads-64     264ns ± 1%
```

### MPMCQueue vs. Go channels

Concurrent producers and consumers (1:1), queue/channel size 1,000, some work done by both producers and consumers:
```
QueueProdConsWork100                             252ns ± 0%
QueueProdConsWork100-2                           206ns ± 5%
QueueProdConsWork100-4                           136ns ±12%
QueueProdConsWork100-8                           110ns ± 6%
QueueProdConsWork100-16                          108ns ± 2%
QueueProdConsWork100-32                          102ns ± 2%
QueueProdConsWork100-64                          101ns ± 0%
ChanProdConsWork100                              283ns ± 0%
ChanProdConsWork100-2                            406ns ±21%
ChanProdConsWork100-4                            549ns ± 7%
ChanProdConsWork100-8                            754ns ± 7%
ChanProdConsWork100-16                           828ns ± 7%
ChanProdConsWork100-32                           810ns ± 8%
ChanProdConsWork100-64                           832ns ± 4%
```

### RBMutex vs. sync.RWMutex

The writer locks on each 100,000 iteration with some work in the critical section for both readers and the writer:
```
RBMutexWorkWrite100000                           146ns ± 0%
RBMutexWorkWrite100000-2                        73.3ns ± 0%
RBMutexWorkWrite100000-4                        36.7ns ± 0%
RBMutexWorkWrite100000-8                        18.6ns ± 0%
RBMutexWorkWrite100000-16                       9.83ns ± 3%
RBMutexWorkWrite100000-32                       5.53ns ± 0%
RBMutexWorkWrite100000-64                       4.04ns ± 3%
RWMutexWorkWrite100000                           121ns ± 0%
RWMutexWorkWrite100000-2                         128ns ± 1%
RWMutexWorkWrite100000-4                         124ns ± 2%
RWMutexWorkWrite100000-8                         101ns ± 1%
RWMutexWorkWrite100000-16                       92.9ns ± 1%
RWMutexWorkWrite100000-32                       89.9ns ± 1%
RWMutexWorkWrite100000-64                       88.4ns ± 1%
```
