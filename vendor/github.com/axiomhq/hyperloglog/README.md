HyperLogLog - an algorithm for approximating the number of distinct elements
---

[![GoDoc](https://godoc.org/github.com/axiomhq/hyperloglog?status.svg)](https://godoc.org/github.com/axiomhq/hyperloglog) [![Go Report Card](https://goreportcard.com/badge/github.com/axiomhq/hyperloglog)](https://goreportcard.com/report/github.com/axiomhq/hyperloglog) [![CircleCI](https://circleci.com/gh/axiomhq/hyperloglog/tree/master.svg?style=svg)](https://circleci.com/gh/axiomhq/hyperloglog/tree/master)

An improved version of [HyperLogLog](https://en.wikipedia.org/wiki/HyperLogLog) for the count-distinct problem, approximating the number of distinct elements in a multiset **using 33-50% less space** than other usual HyperLogLog implementations.

This work is based on ["Better with fewer bits: Improving the performance of cardinality estimation of large data streams - Qingjun Xiao, You Zhou, Shigang Chen"](http://cse.seu.edu.cn/PersonalPage/csqjxiao/csqjxiao_files/papers/INFOCOM17.pdf).

## Implementation

The core differences between this and other implementations are:
* **use metro hash** instead of xxhash
* **sparse representation** for lower cardinalities (like HyperLogLog++)
* **loglog-beta** for dynamic bias correction medium and high cardinalities.
* **4-bit register** instead of 5 (HLL) and 6 (HLL++), but most implementations use 1-byte registers out of convenience

In general it borrows a lot from [InfluxData's fork](https://github.com/influxdata/influxdb/tree/master/pkg/estimator/hll) of [Clark Duvall's HyperLogLog++ implementation](https://github.com/clarkduvall/hyperloglog), but uses **50% less space**.

## Results
A direct comparison with the [HyperLogLog++ implementation used by InfluxDB](https://github.com/influxdata/influxdb/tree/master/pkg/estimator/hll) yielded the following results:

| Exact | Axiom (8.2 KB) | Influx (16.39 KB) |
| --- | --- | --- |
| 10 | 10 (0.0% off) | 10 (0.0% off) |
| 50 |  50 (0.0% off) | 50 (0.0% off) |
| 250 | 250 (0.0% off) | 250 (0.0% off) |
| 1250 | 1249 (0.08% off) | 1249 (0.08% off) |
| 6250 | 6250 (0.0% off) | 6250 (0.0% off) |
| 31250 | **31008 (0.7744% off)** | 31565 (1.0080% off) |
| 156250 | **156013 (0.1517% off)** | 156652 (0.2573% off) |
| 781250 | **782364 (0.1426% off)** | 775988 (0.6735% off) |
| 3906250 | 3869332 (0.9451% off) | **3889909 (0.4183% off)** |
| 10000000 | **9952682 (0.4732% off)** |9889556 (1.1044% off) |


## Note
A big thank you to Prof. Shigang Chen and his team at the University of Florida who are actively conducting research around "Big Network Data".


## Contributing

Kindly check our [contributing guide](https://github.com/axiomhq/hyperloglog/blob/main/Contributing.md) on how to propose bugfixes and improvements, and submitting pull requests to the project

## License

&copy; Axiom, Inc., 2024

Distributed under MIT License (`The MIT License`).

See [LICENSE](LICENSE) for more information.
