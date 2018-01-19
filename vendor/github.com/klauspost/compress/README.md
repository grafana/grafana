# compress

This package is based on an optimized Deflate function, which is used by gzip/zip/zlib packages.

It offers slightly better compression at lower compression settings, and up to 3x faster encoding at highest compression level.

* [High Throughput Benchmark](http://blog.klauspost.com/go-gzipdeflate-benchmarks/).
* [Small Payload/Webserver Benchmarks](http://blog.klauspost.com/gzip-performance-for-go-webservers/).
* [Linear Time Compression](http://blog.klauspost.com/constant-time-gzipzip-compression/).
* [Re-balancing Deflate Compression Levels](https://blog.klauspost.com/rebalancing-deflate-compression-levels/)

[![Build Status](https://travis-ci.org/klauspost/compress.svg?branch=master)](https://travis-ci.org/klauspost/compress)

# changelog
* Jan 14, 2017: Reduce stack pressure due to array copies. See [Issue #18625(https://github.com/golang/go/issues/18625).
* Oct 25, 2016: Level 2-4 have been rewritten and now offers significantly better performance than before.
* Oct 20, 2016: Port zlib changes from Go 1.7 to fix zlib writer issue. Please update.
* Oct 16, 2016: Go 1.7 changes merged. Apples to apples this package is a few percent faster, but has a significantly better balance between speed and compression per level. 
* Mar 24, 2016: Always attempt Huffman encoding on level 4-7. This improves base 64 encoded data compression.
* Mar 24, 2016: Small speedup for level 1-3.
* Feb 19, 2016: Faster bit writer, level -2 is 15% faster, level 1 is 4% faster.
* Feb 19, 2016: Handle small payloads faster in level 1-3.
* Feb 19, 2016: Added faster level 2 + 3 compression modes.
* Feb 19, 2016: [Rebalanced compression levels](https://blog.klauspost.com/rebalancing-deflate-compression-levels/), so there is a more even progresssion in terms of compression. New default level is 5.
* Feb 14, 2016: Snappy: Merge upstream changes. 
* Feb 14, 2016: Snappy: Fix aggressive skipping.
* Feb 14, 2016: Snappy: Update benchmark.
* Feb 13, 2016: Deflate: Fixed assembler problem that could lead to sub-optimal compression.
* Feb 12, 2016: Snappy: Added AMD64 SSE 4.2 optimizations to matching, which makes easy to compress material run faster. Typical speedup is around 25%.
* Feb 9, 2016: Added Snappy package fork. This version is 5-7% faster, much more on hard to compress content.
* Jan 30, 2016: Optimize level 1 to 3 by not considering static dictionary or storing uncompressed. ~4-5% speedup.
* Jan 16, 2016: Optimization on deflate level 1,2,3 compression.
* Jan 8 2016: Merge [CL 18317](https://go-review.googlesource.com/#/c/18317): fix reading, writing of zip64 archives.
* Dec 8 2015: Make level 1 and -2 deterministic even if write size differs.
* Dec 8 2015: Split encoding functions, so hashing and matching can potentially be inlined. 1-3% faster on AMD64. 5% faster on other platforms.
* Dec 8 2015: Fixed rare [one byte out-of bounds read](https://github.com/klauspost/compress/issues/20). Please update!
* Nov 23 2015: Optimization on token writer. ~2-4% faster. Contributed by [@dsnet](https://github.com/dsnet).
* Nov 20 2015: Small optimization to bit writer on 64 bit systems.
* Nov 17 2015: Fixed out-of-bound errors if the underlying Writer returned an error. See [#15](https://github.com/klauspost/compress/issues/15).
* Nov 12 2015: Added [io.WriterTo](https://golang.org/pkg/io/#WriterTo) support to gzip/inflate.
* Nov 11 2015: Merged [CL 16669](https://go-review.googlesource.com/#/c/16669/4): archive/zip: enable overriding (de)compressors per file
* Oct 15 2015: Added skipping on uncompressible data. Random data speed up >5x.

# usage

The packages are drop-in replacements for standard libraries. Simply replace the import path to use them:

| old import         | new import                              |
|--------------------|-----------------------------------------|
| `compress/gzip`    | `github.com/klauspost/compress/gzip`    |
| `compress/zlib`    | `github.com/klauspost/compress/zlib`    |
| `archive/zip`      | `github.com/klauspost/compress/zip`     |
| `compress/deflate` | `github.com/klauspost/compress/deflate` |

You may also be interested in [pgzip](https://github.com/klauspost/pgzip), which is a drop in replacement for gzip, which support multithreaded compression on big files and the optimized [crc32](https://github.com/klauspost/crc32) package used by these packages.

The packages contains the same as the standard library, so you can use the godoc for that: [gzip](http://golang.org/pkg/compress/gzip/), [zip](http://golang.org/pkg/archive/zip/),  [zlib](http://golang.org/pkg/compress/zlib/), [flate](http://golang.org/pkg/compress/flate/).

Currently there is only minor speedup on decompression (mostly CRC32 calculation).

# deflate optimizations

* Minimum matches are 4 bytes, this leads to fewer searches and better compression. (In Go 1.7)
* Stronger hash (iSCSI CRC32) for matches on x64 with SSE 4.2 support. This leads to fewer hash collisions. (Go 1.7 also has improved hashes)
* Literal byte matching using SSE 4.2 for faster match comparisons. (not in Go)
* Bulk hashing on matches. (In Go 1.7)
* Much faster dictionary indexing with `NewWriterDict()`/`Reset()`. (In Go 1.7)
* Make Bit Coder faster by assuming we are on a 64 bit CPU. (In Go 1.7)
* Level 1 compression replaced by converted "Snappy" algorithm. (In Go 1.7)
* Uncompressible content is detected and skipped faster. (Only in BestSpeed in Go)
* A lot of branching eliminated by having two encoders for levels 4-6 and 7-9. (not in Go)
* All heap memory allocations eliminated. (In Go 1.7)

```
benchmark                              old ns/op     new ns/op     delta
BenchmarkEncodeDigitsSpeed1e4-4        554029        265175        -52.14%
BenchmarkEncodeDigitsSpeed1e5-4        3908558       2416595       -38.17%
BenchmarkEncodeDigitsSpeed1e6-4        37546692      24875330      -33.75%
BenchmarkEncodeDigitsDefault1e4-4      781510        486322        -37.77%
BenchmarkEncodeDigitsDefault1e5-4      15530248      6740175       -56.60%
BenchmarkEncodeDigitsDefault1e6-4      174915710     76498625      -56.27%
BenchmarkEncodeDigitsCompress1e4-4     769995        485652        -36.93%
BenchmarkEncodeDigitsCompress1e5-4     15450113      6929589       -55.15%
BenchmarkEncodeDigitsCompress1e6-4     175114660     73348495      -58.11%
BenchmarkEncodeTwainSpeed1e4-4         560122        275977        -50.73%
BenchmarkEncodeTwainSpeed1e5-4         3740978       2506095       -33.01%
BenchmarkEncodeTwainSpeed1e6-4         35542802      21904440      -38.37%
BenchmarkEncodeTwainDefault1e4-4       828534        549026        -33.74%
BenchmarkEncodeTwainDefault1e5-4       13667153      7528455       -44.92%
BenchmarkEncodeTwainDefault1e6-4       141191770     79952170      -43.37%
BenchmarkEncodeTwainCompress1e4-4      830050        545694        -34.26%
BenchmarkEncodeTwainCompress1e5-4      16620852      8460600       -49.10%
BenchmarkEncodeTwainCompress1e6-4      193326820     90808750      -53.03%

benchmark                              old MB/s     new MB/s     speedup
BenchmarkEncodeDigitsSpeed1e4-4        18.05        37.71        2.09x
BenchmarkEncodeDigitsSpeed1e5-4        25.58        41.38        1.62x
BenchmarkEncodeDigitsSpeed1e6-4        26.63        40.20        1.51x
BenchmarkEncodeDigitsDefault1e4-4      12.80        20.56        1.61x
BenchmarkEncodeDigitsDefault1e5-4      6.44         14.84        2.30x
BenchmarkEncodeDigitsDefault1e6-4      5.72         13.07        2.28x
BenchmarkEncodeDigitsCompress1e4-4     12.99        20.59        1.59x
BenchmarkEncodeDigitsCompress1e5-4     6.47         14.43        2.23x
BenchmarkEncodeDigitsCompress1e6-4     5.71         13.63        2.39x
BenchmarkEncodeTwainSpeed1e4-4         17.85        36.23        2.03x
BenchmarkEncodeTwainSpeed1e5-4         26.73        39.90        1.49x
BenchmarkEncodeTwainSpeed1e6-4         28.14        45.65        1.62x
BenchmarkEncodeTwainDefault1e4-4       12.07        18.21        1.51x
BenchmarkEncodeTwainDefault1e5-4       7.32         13.28        1.81x
BenchmarkEncodeTwainDefault1e6-4       7.08         12.51        1.77x
BenchmarkEncodeTwainCompress1e4-4      12.05        18.33        1.52x
BenchmarkEncodeTwainCompress1e5-4      6.02         11.82        1.96x
BenchmarkEncodeTwainCompress1e6-4      5.17         11.01        2.13x
```
* "Speed" is compression level 1
* "Default" is compression level 6
* "Compress" is compression level 9
* Test files are [Digits](https://github.com/klauspost/compress/blob/master/testdata/e.txt) (no matches) and [Twain](https://github.com/klauspost/compress/blob/master/testdata/Mark.Twain-Tom.Sawyer.txt) (plain text) .

As can be seen it shows a very good speedup all across the line.

`Twain` is a much more realistic benchmark, and will be closer to JSON/HTML performance. Here speed is equivalent or faster, up to 2 times.

**Without assembly**. This is what you can expect on systems that does not have amd64 and SSE 4:
```
benchmark                              old ns/op     new ns/op     delta
BenchmarkEncodeDigitsSpeed1e4-4        554029        249558        -54.96%
BenchmarkEncodeDigitsSpeed1e5-4        3908558       2295216       -41.28%
BenchmarkEncodeDigitsSpeed1e6-4        37546692      22594905      -39.82%
BenchmarkEncodeDigitsDefault1e4-4      781510        579850        -25.80%
BenchmarkEncodeDigitsDefault1e5-4      15530248      10096561      -34.99%
BenchmarkEncodeDigitsDefault1e6-4      174915710     111470780     -36.27%
BenchmarkEncodeDigitsCompress1e4-4     769995        579708        -24.71%
BenchmarkEncodeDigitsCompress1e5-4     15450113      10266373      -33.55%
BenchmarkEncodeDigitsCompress1e6-4     175114660     110170120     -37.09%
BenchmarkEncodeTwainSpeed1e4-4         560122        260679        -53.46%
BenchmarkEncodeTwainSpeed1e5-4         3740978       2097372       -43.94%
BenchmarkEncodeTwainSpeed1e6-4         35542802      20353449      -42.74%
BenchmarkEncodeTwainDefault1e4-4       828534        646016        -22.03%
BenchmarkEncodeTwainDefault1e5-4       13667153      10056369      -26.42%
BenchmarkEncodeTwainDefault1e6-4       141191770     105268770     -25.44%
BenchmarkEncodeTwainCompress1e4-4      830050        642401        -22.61%
BenchmarkEncodeTwainCompress1e5-4      16620852      11157081      -32.87%
BenchmarkEncodeTwainCompress1e6-4      193326820     121780770     -37.01%

benchmark                              old MB/s     new MB/s     speedup
BenchmarkEncodeDigitsSpeed1e4-4        18.05        40.07        2.22x
BenchmarkEncodeDigitsSpeed1e5-4        25.58        43.57        1.70x
BenchmarkEncodeDigitsSpeed1e6-4        26.63        44.26        1.66x
BenchmarkEncodeDigitsDefault1e4-4      12.80        17.25        1.35x
BenchmarkEncodeDigitsDefault1e5-4      6.44         9.90         1.54x
BenchmarkEncodeDigitsDefault1e6-4      5.72         8.97         1.57x
BenchmarkEncodeDigitsCompress1e4-4     12.99        17.25        1.33x
BenchmarkEncodeDigitsCompress1e5-4     6.47         9.74         1.51x
BenchmarkEncodeDigitsCompress1e6-4     5.71         9.08         1.59x
BenchmarkEncodeTwainSpeed1e4-4         17.85        38.36        2.15x
BenchmarkEncodeTwainSpeed1e5-4         26.73        47.68        1.78x
BenchmarkEncodeTwainSpeed1e6-4         28.14        49.13        1.75x
BenchmarkEncodeTwainDefault1e4-4       12.07        15.48        1.28x
BenchmarkEncodeTwainDefault1e5-4       7.32         9.94         1.36x
BenchmarkEncodeTwainDefault1e6-4       7.08         9.50         1.34x
BenchmarkEncodeTwainCompress1e4-4      12.05        15.57        1.29x
BenchmarkEncodeTwainCompress1e5-4      6.02         8.96         1.49x
BenchmarkEncodeTwainCompress1e6-4      5.17         8.21         1.59x
```
So even without the assembly optimizations there is a general speedup across the board.

## level 1-3 "snappy" compression

Levels 1 "Best Speed", 2 and 3 are completely replaced by a converted version of the algorithm found in Snappy, modified to be fully
compatible with the deflate bitstream (and thus still compatible with all existing zlib/gzip libraries and tools).
This version is considerably faster than the "old" deflate at level 1. It does however come at a compression loss, usually in the order of 3-4% compared to the old level 1. However, the speed is usually 1.75 times that of the fastest deflate mode.

In my previous experiments the most common case for "level 1" was that it provided no significant speedup, only lower compression compared to level 2 and sometimes even 3. However, the modified Snappy algorithm provides a very good sweet spot. Usually about 75% faster and with only little compression loss. Therefore I decided to *replace* level 1 with this mode entirely.

Input is split into blocks of 64kb of, and they are encoded independently (no backreferences across blocks) for the best speed. Contrary to Snappy the output is entropy-encoded, so you will almost always see better compression than Snappy. But Snappy is still about twice as fast as Snappy in deflate mode.

Level 2 and 3 have also been replaced. Level 2 is capable is matching between blocks and level 3 checks up to two hashes for matches it will try.

## compression levels

This table shows the compression at each level, and the percentage of the output size compared to output
at the similar level with the standard library. Compression data is `Twain`, see above.

(Not up-to-date after rebalancing)

| Level | Bytes  | % size |
|-------|--------|--------|
| 1     | 194622 | 103.7% |
| 2     | 174684 | 96.85% |
| 3     | 170301 | 98.45% |
| 4     | 165253 | 97.69% |
| 5     | 161274 | 98.65% |
| 6     | 160464 | 99.71% |
| 7     | 160304 | 99.87% |
| 8     | 160279 | 99.99% |
| 9     | 160279 | 99.99% |

To interpret and example, this version of deflate compresses input of 407287 bytes to 161274 bytes at level 5, which is 98.6% of the size of what the standard library produces; 161274 bytes.

This means that from level 4 you can expect a compression level increase of a few percent. Level 1 is about 3% worse, as descibed above.

# linear time compression (huffman only)

This compression library adds a special compression level, named `ConstantCompression`, which allows near linear time compression. This is done by completely disabling matching of previous data, and only reduce the number of bits to represent each character. 

This means that often used characters, like 'e' and ' ' (space) in text use the fewest bits to represent, and rare characters like '¤' takes more bits to represent. For more information see [wikipedia](https://en.wikipedia.org/wiki/Huffman_coding) or this nice [video](https://youtu.be/ZdooBTdW5bM).

Since this type of compression has much less variance, the compression speed is mostly unaffected by the input data, and is usually more than *180MB/s* for a single core.

The downside is that the compression ratio is usually considerably worse than even the fastest conventional compression. The compression raio can never be better than 8:1 (12.5%). 

The linear time compression can be used as a "better than nothing" mode, where you cannot risk the encoder to slow down on some content. For comparison, the size of the "Twain" text is *233460 bytes* (+29% vs. level 1) and encode speed is 144MB/s (4.5x level 1). So in this case you trade a 30% size increase for a 4 times speedup.

For more information see my blog post on [Fast Linear Time Compression](http://blog.klauspost.com/constant-time-gzipzip-compression/).

This is implemented on Go 1.7 as "Huffman Only" mode, though not exposed for gzip.


# gzip/zip optimizations
 * Uses the faster deflate
 * Uses SSE 4.2 CRC32 calculations.

Speed increase is up to 3x of the standard library, but usually around 2x. 

This is close to a real world benchmark as you will get. A 2.3MB JSON file. (NOTE: not up-to-date)

```
benchmark             old ns/op     new ns/op     delta
BenchmarkGzipL1-4     95212470      59938275      -37.05%
BenchmarkGzipL2-4     102069730     76349195      -25.20%
BenchmarkGzipL3-4     115472770     82492215      -28.56%
BenchmarkGzipL4-4     153197780     107570890     -29.78%
BenchmarkGzipL5-4     203930260     134387930     -34.10%
BenchmarkGzipL6-4     233172100     145495400     -37.60%
BenchmarkGzipL7-4     297190260     197926950     -33.40%
BenchmarkGzipL8-4     512819750     376244733     -26.63%
BenchmarkGzipL9-4     563366800     403266833     -28.42%

benchmark             old MB/s     new MB/s     speedup
BenchmarkGzipL1-4     52.11        82.78        1.59x
BenchmarkGzipL2-4     48.61        64.99        1.34x
BenchmarkGzipL3-4     42.97        60.15        1.40x
BenchmarkGzipL4-4     32.39        46.13        1.42x
BenchmarkGzipL5-4     24.33        36.92        1.52x
BenchmarkGzipL6-4     21.28        34.10        1.60x
BenchmarkGzipL7-4     16.70        25.07        1.50x
BenchmarkGzipL8-4     9.68         13.19        1.36x
BenchmarkGzipL9-4     8.81         12.30        1.40x
```

Multithreaded compression using [pgzip](https://github.com/klauspost/pgzip) comparison, Quadcore, CPU = 8:

(Not updated, old numbers)

```
benchmark           old ns/op     new ns/op     delta
BenchmarkGzipL1     96155500      25981486      -72.98%
BenchmarkGzipL2     101905830     24601408      -75.86%
BenchmarkGzipL3     113506490     26321506      -76.81%
BenchmarkGzipL4     143708220     31761818      -77.90%
BenchmarkGzipL5     188210770     39602266      -78.96%
BenchmarkGzipL6     209812000     40402313      -80.74%
BenchmarkGzipL7     270015440     56103210      -79.22%
BenchmarkGzipL8     461359700     91255220      -80.22%
BenchmarkGzipL9     498361833     88755075      -82.19%

benchmark           old MB/s     new MB/s     speedup
BenchmarkGzipL1     51.60        190.97       3.70x
BenchmarkGzipL2     48.69        201.69       4.14x
BenchmarkGzipL3     43.71        188.51       4.31x
BenchmarkGzipL4     34.53        156.22       4.52x
BenchmarkGzipL5     26.36        125.29       4.75x
BenchmarkGzipL6     23.65        122.81       5.19x
BenchmarkGzipL7     18.38        88.44        4.81x
BenchmarkGzipL8     10.75        54.37        5.06x
BenchmarkGzipL9     9.96         55.90        5.61x
```

# snappy package

The standard snappy package has now been improved. This repo contains a copy of the snappy repo.

I would advise to use the standard package: https://github.com/golang/snappy


# license

This code is licensed under the same conditions as the original Go code. See LICENSE file.
