This is much better than `skiplist` and `slist`.

```sh
BenchmarkReadWrite/frac_0-8            3000000         537 ns/op
BenchmarkReadWrite/frac_1-8            3000000         503 ns/op
BenchmarkReadWrite/frac_2-8            3000000         492 ns/op
BenchmarkReadWrite/frac_3-8            3000000         475 ns/op
BenchmarkReadWrite/frac_4-8            3000000         440 ns/op
BenchmarkReadWrite/frac_5-8            5000000         442 ns/op
BenchmarkReadWrite/frac_6-8            5000000         380 ns/op
BenchmarkReadWrite/frac_7-8            5000000         338 ns/op
BenchmarkReadWrite/frac_8-8            5000000         294 ns/op
BenchmarkReadWrite/frac_9-8            10000000        268 ns/op
BenchmarkReadWrite/frac_10-8           100000000       26.3 ns/op
```

And even better than a simple map with read-write lock:

```sh
BenchmarkReadWriteMap/frac_0-8         2000000         774 ns/op
BenchmarkReadWriteMap/frac_1-8         2000000         647 ns/op
BenchmarkReadWriteMap/frac_2-8         3000000         605 ns/op
BenchmarkReadWriteMap/frac_3-8         3000000         603 ns/op
BenchmarkReadWriteMap/frac_4-8         3000000         556 ns/op
BenchmarkReadWriteMap/frac_5-8         3000000         472 ns/op
BenchmarkReadWriteMap/frac_6-8         3000000         476 ns/op
BenchmarkReadWriteMap/frac_7-8         3000000         457 ns/op
BenchmarkReadWriteMap/frac_8-8         5000000         444 ns/op
BenchmarkReadWriteMap/frac_9-8         5000000         361 ns/op
BenchmarkReadWriteMap/frac_10-8        10000000        212 ns/op
```

# Node Pooling

Command used

```sh
rm -Rf tmp && /usr/bin/time -l ./populate -keys_mil 10
```

For pprof results, we run without using /usr/bin/time. There are four runs below.

Results seem to vary quite a bit between runs.

## Before node pooling

```sh
1311.53MB of 1338.69MB total (97.97%)
Dropped 30 nodes (cum <= 6.69MB)
Showing top 10 nodes out of 37 (cum >= 12.50MB)
      flat  flat%   sum%        cum   cum%
  523.04MB 39.07% 39.07%   523.04MB 39.07%  github.com/dgraph-io/badger/skl.(*Skiplist).Put
  184.51MB 13.78% 52.85%   184.51MB 13.78%  runtime.stringtoslicebyte
  166.01MB 12.40% 65.25%   689.04MB 51.47%  github.com/dgraph-io/badger/mem.(*Table).Put
     165MB 12.33% 77.58%      165MB 12.33%  runtime.convT2E
  116.92MB  8.73% 86.31%   116.92MB  8.73%  bytes.makeSlice
   62.50MB  4.67% 90.98%    62.50MB  4.67%  main.newValue
   34.50MB  2.58% 93.56%    34.50MB  2.58%  github.com/dgraph-io/badger/table.(*BlockIterator).parseKV
   25.50MB  1.90% 95.46%   100.06MB  7.47%  github.com/dgraph-io/badger/y.(*MergeIterator).Next
   21.06MB  1.57% 97.04%    21.06MB  1.57%  github.com/dgraph-io/badger/table.(*Table).read
   12.50MB  0.93% 97.97%    12.50MB  0.93%  github.com/dgraph-io/badger/table.header.Encode

      128.31 real       329.37 user        17.11 sys
3355660288  maximum resident set size
         0  average shared memory size
         0  average unshared data size
         0  average unshared stack size
   2203080  page reclaims
       764  page faults
         0  swaps
       275  block input operations
        76  block output operations
         0  messages sent
         0  messages received
         0  signals received
     49173  voluntary context switches
    599922  involuntary context switches
```

## After node pooling

```sh
1963.13MB of 2026.09MB total (96.89%)
Dropped 29 nodes (cum <= 10.13MB)
Showing top 10 nodes out of 41 (cum >= 185.62MB)
      flat  flat%   sum%        cum   cum%
  658.05MB 32.48% 32.48%   658.05MB 32.48%  github.com/dgraph-io/badger/skl.glob..func1
  297.51MB 14.68% 47.16%   297.51MB 14.68%  runtime.convT2E
  257.51MB 12.71% 59.87%   257.51MB 12.71%  runtime.stringtoslicebyte
  249.01MB 12.29% 72.16%  1007.06MB 49.70%  github.com/dgraph-io/badger/mem.(*Table).Put
  142.43MB  7.03% 79.19%   142.43MB  7.03%  bytes.makeSlice
     100MB  4.94% 84.13%   758.05MB 37.41%  github.com/dgraph-io/badger/skl.newNode
   99.50MB  4.91% 89.04%    99.50MB  4.91%  main.newValue
      75MB  3.70% 92.74%       75MB  3.70%  github.com/dgraph-io/badger/table.(*BlockIterator).parseKV
   44.62MB  2.20% 94.94%    44.62MB  2.20%  github.com/dgraph-io/badger/table.(*Table).read
   39.50MB  1.95% 96.89%   185.62MB  9.16%  github.com/dgraph-io/badger/y.(*MergeIterator).Next

      135.58 real       374.29 user        17.65 sys
3740614656  maximum resident set size
         0  average shared memory size
         0  average unshared data size
         0  average unshared stack size
   2276566  page reclaims
       770  page faults
         0  swaps
       128  block input operations
        90  block output operations
         0  messages sent
         0  messages received
         0  signals received
     46434  voluntary context switches
    597049  involuntary context switches
```
