# strftime

Fast strftime for Go

[![Build Status](https://travis-ci.org/lestrrat-go/strftime.png?branch=master)](https://travis-ci.org/lestrrat-go/strftime)

[![GoDoc](https://godoc.org/github.com/lestrrat-go/strftime?status.svg)](https://godoc.org/github.com/lestrrat-go/strftime)

# SYNOPSIS

```go
f := strftime.New(`.... pattern ...`)
if err := f.Format(buf, time.Now()); err != nil {
    log.Println(err.Error())
}
```

# DESCRIPTION

The goals for this library are

* Optimized for the same pattern being called repeatedly
* Be flexible about destination to write the results out
* Be as complete as possible in terms of conversion specifications

# API

## Format(string, time.Time) (string, error)

Takes the pattern and the time, and formats it. This function is a utility function that recompiles the pattern every time the function is called. If you know beforehand that you will be formatting the same pattern multiple times, consider using `New` to create a `Strftime` object and reuse it.

## New(string) (\*Strftime, error)

Takes the pattern and creates a new `Strftime` object.

## obj.Pattern() string

Returns the pattern string used to create this `Strftime` object

## obj.Format(io.Writer, time.Time) error

Formats the time according to the pre-compiled pattern, and writes the result to the specified `io.Writer`

## obj.FormatString(time.Time) string

Formats the time according to the pre-compiled pattern, and returns the result string.

# SUPPORTED CONVERSION SPECIFICATIONS

| pattern | description |
|:--------|:------------|
| %A      | national representation of the full weekday name |
| %a      | national representation of the abbreviated weekday |
| %B      | national representation of the full month name |
| %b      | national representation of the abbreviated month name |
| %C      | (year / 100) as decimal number; single digits are preceded by a zero |
| %c      | national representation of time and date |
| %D      | equivalent to %m/%d/%y |
| %d      | day of the month as a decimal number (01-31) |
| %e      | the day of the month as a decimal number (1-31); single digits are preceded by a blank |
| %F      | equivalent to %Y-%m-%d |
| %H      | the hour (24-hour clock) as a decimal number (00-23) |
| %h      | same as %b |
| %I      | the hour (12-hour clock) as a decimal number (01-12) |
| %j      | the day of the year as a decimal number (001-366) |
| %k      | the hour (24-hour clock) as a decimal number (0-23); single digits are preceded by a blank |
| %l      | the hour (12-hour clock) as a decimal number (1-12); single digits are preceded by a blank |
| %M      | the minute as a decimal number (00-59) |
| %m      | the month as a decimal number (01-12) |
| %n      | a newline |
| %p      | national representation of either "ante meridiem" (a.m.)  or "post meridiem" (p.m.)  as appropriate. |
| %R      | equivalent to %H:%M |
| %r      | equivalent to %I:%M:%S %p |
| %S      | the second as a decimal number (00-60) |
| %T      | equivalent to %H:%M:%S |
| %t      | a tab |
| %U      | the week number of the year (Sunday as the first day of the week) as a decimal number (00-53) |
| %u      | the weekday (Monday as the first day of the week) as a decimal number (1-7) |
| %V      | the week number of the year (Monday as the first day of the week) as a decimal number (01-53) |
| %v      | equivalent to %e-%b-%Y |
| %W      | the week number of the year (Monday as the first day of the week) as a decimal number (00-53) |
| %w      | the weekday (Sunday as the first day of the week) as a decimal number (0-6) |
| %X      | national representation of the time |
| %x      | national representation of the date |
| %Y      | the year with century as a decimal number |
| %y      | the year without century as a decimal number (00-99) |
| %Z      | the time zone name |
| %z      | the time zone offset from UTC |
| %%      | a '%' |

# EXTENSIONS / CUSTOM SPECIFICATIONS

This library in general tries to be POSIX compliant, but sometimes you just need that
extra specification or two that is relatively widely used but is not included in the
POSIX specification.

For example, POSIX does not specify how to print out milliseconds,
but popular implementations allow `%f` or `%L` to achieve this.

For those instances, `strftime.Strftime` can be configured to use a custom set of
specifications:

```
ss := strftime.NewSpecificationSet()
ss.Set('L', ...) // provide implementation for `%L`

// pass this new specification set to the strftime instance
p, err := strftime.New(`%L`, strftime.WithSpecificationSet(ss))
p.Format(..., time.Now())
```

The implementation must implement the `Appender` interface, which is

```
type Appender interface {
  Append([]byte, time.Time) []byte
}
```

For commonly used extensions such as the millisecond example and Unix timestamp, we provide a default
implementation so the user can do one of the following:

```
// (1) Pass a specification byte and the Appender
//     This allows you to pass arbitrary Appenders
p, err := strftime.New(
  `%L`,
  strftime.WithSpecification('L', strftime.Milliseconds),
)

// (2) Pass an option that knows to use strftime.Milliseconds
p, err := strftime.New(
  `%L`,
  strftime.WithMilliseconds('L'),
)
```

Similarly for Unix Timestamp:
```
// (1) Pass a specification byte and the Appender
//     This allows you to pass arbitrary Appenders
p, err := strftime.New(
  `%s`,
  strftime.WithSpecification('s', strftime.UnixSeconds),
)

// (2) Pass an option that knows to use strftime.UnixSeconds
p, err := strftime.New(
  `%s`,
  strftime.WithUnixSeconds('s'),
)
```

If a common specification is missing, please feel free to submit a PR
(but please be sure to be able to defend how "common" it is)

## List of available extensions

- [`Milliseconds`](https://pkg.go.dev/github.com/lestrrat-go/strftime?tab=doc#Milliseconds) (related option: [`WithMilliseconds`](https://pkg.go.dev/github.com/lestrrat-go/strftime?tab=doc#WithMilliseconds));

- [`Microseconds`](https://pkg.go.dev/github.com/lestrrat-go/strftime?tab=doc#Microseconds) (related option: [`WithMicroseconds`](https://pkg.go.dev/github.com/lestrrat-go/strftime?tab=doc#WithMicroseconds));

- [`UnixSeconds`](https://pkg.go.dev/github.com/lestrrat-go/strftime?tab=doc#UnixSeconds) (related option: [`WithUnixSeconds`](https://pkg.go.dev/github.com/lestrrat-go/strftime?tab=doc#WithUnixSeconds)).


# PERFORMANCE / OTHER LIBRARIES

The following benchmarks were run separately because some libraries were using cgo on specific platforms (notabley, the fastly version)

```
// On my OS X 10.14.6, 2.3 GHz Intel Core i5, 16GB memory.
// go version go1.13.4 darwin/amd64
hummingbird% go test -tags bench -benchmem -bench .
<snip>
BenchmarkTebeka-4                 	  297471	      3905 ns/op	     257 B/op	      20 allocs/op
BenchmarkJehiah-4                 	  818444	      1773 ns/op	     256 B/op	      17 allocs/op
BenchmarkFastly-4                 	 2330794	       550 ns/op	      80 B/op	       5 allocs/op
BenchmarkLestrrat-4               	  916365	      1458 ns/op	      80 B/op	       2 allocs/op
BenchmarkLestrratCachedString-4   	 2527428	       546 ns/op	     128 B/op	       2 allocs/op
BenchmarkLestrratCachedWriter-4   	  537422	      2155 ns/op	     192 B/op	       3 allocs/op
PASS
ok  	github.com/lestrrat-go/strftime	25.618s
```

```
// On a host on Google Cloud Platform, machine-type: f1-micro (vCPU x 1, memory: 0.6GB)
// (Yes, I was being skimpy)
// Linux <snip> 4.9.0-11-amd64 #1 SMP Debian 4.9.189-3+deb9u1 (2019-09-20) x86_64 GNU/Linux
// go version go1.13.4 linux/amd64
hummingbird% go test -tags bench -benchmem -bench .
<snip>
BenchmarkTebeka                   254997              4726 ns/op             256 B/op         20 allocs/op
BenchmarkJehiah                   659289              1882 ns/op             256 B/op         17 allocs/op
BenchmarkFastly                   389150              3044 ns/op             224 B/op         13 allocs/op
BenchmarkLestrrat                 699069              1780 ns/op              80 B/op          2 allocs/op
BenchmarkLestrratCachedString    2081594               589 ns/op             128 B/op          2 allocs/op
BenchmarkLestrratCachedWriter     825763              1480 ns/op             192 B/op          3 allocs/op
PASS
ok      github.com/lestrrat-go/strftime 11.355s
```

This library is much faster than other libraries *IF* you can reuse the format pattern.

Here's the annotated list from the benchmark results. You can clearly see that (re)using a `Strftime` object
and producing a string is the fastest. Writing to an `io.Writer` seems a bit sluggish, but since
the one producing the string is doing almost exactly the same thing, we believe this is purely the overhead of
writing to an `io.Writer`

| Import Path                         | Score   | Note                            |
|:------------------------------------|--------:|:--------------------------------|
| github.com/lestrrat-go/strftime     | 3000000 | Using `FormatString()` (cached) |
| github.com/fastly/go-utils/strftime | 2000000 | Pure go version on OS X         |
| github.com/lestrrat-go/strftime     | 1000000 | Using `Format()` (NOT cached)   |
| github.com/jehiah/go-strftime       | 1000000 |                                 |
| github.com/fastly/go-utils/strftime | 1000000 | cgo version on Linux            |
| github.com/lestrrat-go/strftime     | 500000  | Using `Format()` (cached)       |
| github.com/tebeka/strftime          | 300000  |                                 |

However, depending on your pattern, this speed may vary. If you find a particular pattern that seems sluggish,
please send in patches or tests.

Please also note that this benchmark only uses the subset of conversion specifications that are supported by *ALL* of the libraries compared.

Somethings to consider when making performance comparisons in the future:

* Can it write to io.Writer?
* Which `%specification` does it handle?
