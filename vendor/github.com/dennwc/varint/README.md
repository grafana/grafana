# varint

This package provides an optimized implementation of protobuf's varint encoding/decoding.
It has no dependencies.

Benchmarks comparing to a `binary.Uvarint`:

```
benchmark                      old ns/op     new ns/op     delta
BenchmarkUvarint/1-8           4.13          2.85          -30.99%
BenchmarkUvarint/1_large-8     4.01          2.28          -43.14%
BenchmarkUvarint/2-8           6.23          2.87          -53.93%
BenchmarkUvarint/2_large-8     5.60          2.86          -48.93%
BenchmarkUvarint/3-8           6.55          3.44          -47.48%
BenchmarkUvarint/3_large-8     6.54          2.86          -56.27%
BenchmarkUvarint/4-8           7.30          3.71          -49.18%
BenchmarkUvarint/4_large-8     7.46          3.10          -58.45%
BenchmarkUvarint/5-8           8.31          4.12          -50.42%
BenchmarkUvarint/5_large-8     8.56          3.48          -59.35%
BenchmarkUvarint/6-8           9.42          4.66          -50.53%
BenchmarkUvarint/6_large-8     9.91          4.07          -58.93%
BenchmarkUvarint/7-8           10.6          5.28          -50.19%
BenchmarkUvarint/7_large-8     11.0          4.70          -57.27%
BenchmarkUvarint/8-8           11.7          6.02          -48.55%
BenchmarkUvarint/8_large-8     12.1          5.19          -57.11%
BenchmarkUvarint/9-8           12.9          6.83          -47.05%
BenchmarkUvarint/9_large-8     13.1          5.71          -56.41%
```

It also provides additional functionality like `UvarintSize` (similar to `sov*` in `gogo/protobuf`):

```
benchmark                    old ns/op     new ns/op     delta
BenchmarkUvarintSize/1-8     1.71          0.43          -74.85%
BenchmarkUvarintSize/2-8     2.56          0.57          -77.73%
BenchmarkUvarintSize/3-8     3.22          0.72          -77.64%
BenchmarkUvarintSize/4-8     3.74          0.72          -80.75%
BenchmarkUvarintSize/5-8     4.29          0.57          -86.71%
BenchmarkUvarintSize/6-8     4.85          0.58          -88.04%
BenchmarkUvarintSize/7-8     5.43          0.71          -86.92%
BenchmarkUvarintSize/8-8     6.01          0.86          -85.69%
BenchmarkUvarintSize/9-8     6.64          1.00          -84.94%
```

# License

MIT