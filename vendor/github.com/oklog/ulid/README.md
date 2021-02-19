# Universally Unique Lexicographically Sortable Identifier

![Project status](https://img.shields.io/badge/version-1.3.0-yellow.svg)
[![Build Status](https://secure.travis-ci.org/oklog/ulid.png)](http://travis-ci.org/oklog/ulid)
[![Go Report Card](https://goreportcard.com/badge/oklog/ulid?cache=0)](https://goreportcard.com/report/oklog/ulid)
[![Coverage Status](https://coveralls.io/repos/github/oklog/ulid/badge.svg?branch=master&cache=0)](https://coveralls.io/github/oklog/ulid?branch=master)
[![GoDoc](https://godoc.org/github.com/oklog/ulid?status.svg)](https://godoc.org/github.com/oklog/ulid)
[![Apache 2 licensed](https://img.shields.io/badge/license-Apache2-blue.svg)](https://raw.githubusercontent.com/oklog/ulid/master/LICENSE)

A Go port of [alizain/ulid](https://github.com/alizain/ulid) with binary format implemented.

## Background

A GUID/UUID can be suboptimal for many use-cases because:

- It isn't the most character efficient way of encoding 128 bits
- UUID v1/v2 is impractical in many environments, as it requires access to a unique, stable MAC address
- UUID v3/v5 requires a unique seed and produces randomly distributed IDs, which can cause fragmentation in many data structures
- UUID v4 provides no other information than randomness which can cause fragmentation in many data structures

A ULID however:

- Is compatible with UUID/GUID's
- 1.21e+24 unique ULIDs per millisecond (1,208,925,819,614,629,174,706,176 to be exact)
- Lexicographically sortable
- Canonically encoded as a 26 character string, as opposed to the 36 character UUID
- Uses Crockford's base32 for better efficiency and readability (5 bits per character)
- Case insensitive
- No special characters (URL safe)
- Monotonic sort order (correctly detects and handles the same millisecond)

## Install

```shell
go get github.com/oklog/ulid
```

## Usage

An ULID is constructed with a `time.Time` and an `io.Reader` entropy source.
This design allows for greater flexibility in choosing your trade-offs.

Please note that `rand.Rand` from the `math` package is *not* safe for concurrent use.
Instantiate one per long living go-routine or use a `sync.Pool` if you want to avoid the potential contention of a locked `rand.Source` as its been frequently observed in the package level functions.


```go
func ExampleULID() {
	t := time.Unix(1000000, 0)
	entropy := ulid.Monotonic(rand.New(rand.NewSource(t.UnixNano())), 0)
	fmt.Println(ulid.MustNew(ulid.Timestamp(t), entropy))
	// Output: 0000XSNJG0MQJHBF4QX1EFD6Y3
}

```

## Specification

Below is the current specification of ULID as implemented in this repository.

### Components

**Timestamp**
- 48 bits
- UNIX-time in milliseconds
- Won't run out of space till the year 10895 AD

**Entropy**
- 80 bits
- User defined entropy source.
- Monotonicity within the same millisecond with [`ulid.Monotonic`](https://godoc.org/github.com/oklog/ulid#Monotonic)

### Encoding

[Crockford's Base32](http://www.crockford.com/wrmg/base32.html) is used as shown.
This alphabet excludes the letters I, L, O, and U to avoid confusion and abuse.

```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```

### Binary Layout and Byte Order

The components are encoded as 16 octets. Each component is encoded with the Most Significant Byte first (network byte order).

```
0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      32_bit_uint_time_high                    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     16_bit_uint_time_low      |       16_bit_uint_random      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       32_bit_uint_random                      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       32_bit_uint_random                      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### String Representation

```
 01AN4Z07BY      79KA1307SR9X4MV3
|----------|    |----------------|
 Timestamp           Entropy
  10 chars           16 chars
   48bits             80bits
   base32             base32
```

## Test

```shell
go test ./...
```

## Benchmarks

On a Intel Core i7 Ivy Bridge 2.7 GHz, MacOS 10.12.1 and Go 1.8.0beta1

```
BenchmarkNew/WithCryptoEntropy-8      2000000        771 ns/op      20.73 MB/s   16 B/op   1 allocs/op
BenchmarkNew/WithEntropy-8            20000000      65.8 ns/op     243.01 MB/s   16 B/op   1 allocs/op
BenchmarkNew/WithoutEntropy-8         50000000      30.0 ns/op     534.06 MB/s   16 B/op   1 allocs/op
BenchmarkMustNew/WithCryptoEntropy-8  2000000        781 ns/op      20.48 MB/s   16 B/op   1 allocs/op
BenchmarkMustNew/WithEntropy-8        20000000      70.0 ns/op     228.51 MB/s   16 B/op   1 allocs/op
BenchmarkMustNew/WithoutEntropy-8     50000000      34.6 ns/op     462.98 MB/s   16 B/op   1 allocs/op
BenchmarkParse-8                      50000000      30.0 ns/op     866.16 MB/s    0 B/op   0 allocs/op
BenchmarkMustParse-8                  50000000      35.2 ns/op     738.94 MB/s    0 B/op   0 allocs/op
BenchmarkString-8                     20000000      64.9 ns/op     246.40 MB/s   32 B/op   1 allocs/op
BenchmarkMarshal/Text-8               20000000      55.8 ns/op     286.84 MB/s   32 B/op   1 allocs/op
BenchmarkMarshal/TextTo-8             100000000     22.4 ns/op     714.91 MB/s    0 B/op   0 allocs/op
BenchmarkMarshal/Binary-8             300000000     4.02 ns/op    3981.77 MB/s    0 B/op   0 allocs/op
BenchmarkMarshal/BinaryTo-8           2000000000    1.18 ns/op   13551.75 MB/s    0 B/op   0 allocs/op
BenchmarkUnmarshal/Text-8             100000000     20.5 ns/op    1265.27 MB/s    0 B/op   0 allocs/op
BenchmarkUnmarshal/Binary-8           300000000     4.94 ns/op    3240.01 MB/s    0 B/op   0 allocs/op
BenchmarkNow-8                        100000000     15.1 ns/op     528.09 MB/s    0 B/op   0 allocs/op
BenchmarkTimestamp-8                  2000000000    0.29 ns/op   27271.59 MB/s    0 B/op   0 allocs/op
BenchmarkTime-8                       2000000000    0.58 ns/op   13717.80 MB/s    0 B/op   0 allocs/op
BenchmarkSetTime-8                    2000000000    0.89 ns/op    9023.95 MB/s    0 B/op   0 allocs/op
BenchmarkEntropy-8                    200000000     7.62 ns/op    1311.66 MB/s    0 B/op   0 allocs/op
BenchmarkSetEntropy-8                 2000000000    0.88 ns/op   11376.54 MB/s    0 B/op   0 allocs/op
BenchmarkCompare-8                    200000000     7.34 ns/op    4359.23 MB/s    0 B/op   0 allocs/op
```

## Prior Art

- [alizain/ulid](https://github.com/alizain/ulid)
- [RobThree/NUlid](https://github.com/RobThree/NUlid)
- [imdario/go-ulid](https://github.com/imdario/go-ulid)
