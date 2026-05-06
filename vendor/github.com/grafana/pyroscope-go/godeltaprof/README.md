# godeltaprof

godeltaprof is an efficient delta profiler for memory, mutex, and block.

# Why

In Golang, allocation, mutex and block profiles are cumulative. They only grow over time and show allocations that happened since the beginning of the running program.
Not only values grow, but the size of the profile itself grows as well. It could grow up to megabytes in size for long-running processes. These megabytes profiles are called huge profiles in this document.

In many cases, it's more useful to see the differences between two points in time.
You can use the original runtime/pprof package, called a delta profile, to see these differences. 
Using the delta profile requires passing seconds argument to the pprof endpoint query.

```
go tool pprof http://localhost:6060/debug/pprof/heap?seconds=30
```

What this does:
1. Dump profile `p0`
2. Sleep
3. Dump profile `p1`
4. Decompress and parse protobuf `p0`
5. Decompress and parse protobuf `p1`
6. Subtract `p0` from `p1`
7. Serialize protobuf and compress the result

The resulting profile is *usually* much smaller (`p0` may be megabytes, while result is usually tens of kilobytes).

There are number of issues with this approach:

1. Heap profile contains both allocation values and in-use values. In-use values are not cumulative. In-use values are corrupted by the subtraction.
  **Note:** It can be fixed if runtime/pprof package uses `p0.ScaleN([]float64{-1,-1,0,0})`, instead of `p0.Scale(-1)` - that would subtract allocation values and zero out in-use values in `p0`.
2. It requires dumping two profiles.
3. It produces a lot of allocations putting pressure on GC.


## DataDog's fastdelta

DataDog's [fastdelta profiler](https://github.com/DataDog/dd-trace-go/blob/30e1406c2cb62af749df03d559853e1d1de0e3bf/profiler/internal/fastdelta/fd.go#L75) uses another approach. 

It improves the runtime/pprof approach by keeping a copy of the previous profile and subtracting the current profile from it.
The fastdelta profiler uses a custom protobuf pprof parser that doesn't allocate as much memory.
This approach is more efficient, faster, and produces less garbage. It also doesn't require using two profiles. 
However, the fastdelta profiler still parses huge profiles up to megabytes, just to discard most of it.

## godeltaprof

godeltaprof does a similar job but slightly differently.

Delta computation happens before serializing any pprof files using `runtime.MemprofileRecord` and `BlockProfileRecord`.
This way, huge profiles don't need to be parsed. The delta is computed on raw records, all zeros are rejected, and results are serialized and compressed.

The source code for godeltaprof is based (forked) on the original [runtime/pprof package](https://github.com/golang/go/tree/master/src/runtime/pprof).
godeltaprof is modified to include delta computation before serialization and to expose the new endpoints.
There are other small improvements and benefits:
- Using `github.com/klauspost/compress/gzip` instead of `compress/gzip`
- Optional lazy mappings reading (they don't change over time for most applications)
- Separate package from runtime, so updated independently 

# benchmarks

These benchmarks used memory profiles from the [pyroscope](https://github.com/grafana/pyroscope) server.

BenchmarkOG - dumps memory profile with runtime/pprof package
BenchmarkFastDelta - dumps memory profile with runtime/pprof package and computes delta using fastdelta
BenchmarkGodeltaprof - does not dump profile with runtime/pprof, computes delta, outputs it results

Each benchmark also outputs produced profile sizes.
```
BenchmarkOG
      63         181862189 ns/op
profile sizes: [209117 209107 209077 209089 209095 209076 209088 209082 209090 209092]

BenchmarkFastDelta
      43         273936764 ns/op
profile sizes: [169300 10815 8969 9511 9752 9376 9545 8959 10357 9536]

BenchmarkGodeltaprof
     366          31148264 ns/op
profile sizes: [208898 11485 9347 9967 10291 9848 10085 9285 11033 9986]
```

Notice how BenchmarkOG profiles sizes are ~200k and BenchmarkGodeltaprof and BenchmarkFastDelta are ~10k - that is because a lof of samples
with zero values are discarded after delta computation.

Source code of benchmarks could be found [here](https://github.com/grafana/pyroscope/compare/godeltaprofbench?expand=1) 

CPU profiles: [BenchmarkOG](https://flamegraph.com/share/a8f68312-98c7-11ee-a502-466f68d203a5), [BenchmarkFastDelta](https://flamegraph.com/share/c23821f3-98c7-11ee-a502-466f68d203a5),  [BenchmarkGodeltaprof]( https://flamegraph.com/share/ea66df36-98c7-11ee-9a0d-f2c25703e557)



# upstreaming

In the perfect world, this functionality exists in golang runtime/stdlib and we don't need godeltaprof library at all.

See golang proposals:
https://github.com/golang/go/issues/57765
https://github.com/golang/go/issues/67942



