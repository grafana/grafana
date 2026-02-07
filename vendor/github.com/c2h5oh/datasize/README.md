# datasize [![Build Status](https://travis-ci.org/c2h5oh/datasize.svg?branch=master)](https://travis-ci.org/c2h5oh/datasize)

Golang helpers for data sizes

### Constants

Just like `time` package provides `time.Second`, `time.Day` constants `datasize` provides:

* `datasize.B` 1 byte
* `datasize.KB` 1 kilobyte
* `datasize.MB` 1 megabyte
* `datasize.GB` 1 gigabyte
* `datasize.TB` 1 terabyte
* `datasize.PB` 1 petabyte
* `datasize.EB` 1 exabyte

### Helpers

Just like `time` package provides `duration.Nanoseconds() uint64 `, `duration.Hours() float64` helpers `datasize` has.

* `ByteSize.Bytes() uint64`
* `ByteSize.Kilobytes() float64`
* `ByteSize.Megabytes() float64`
* `ByteSize.Gigabytes() float64`
* `ByteSize.Terabytes() float64`
* `ByteSize.Petabytes() float64`
* `ByteSize.Exabytes() float64`

Warning: see limitations at the end of this document about a possible precision loss

### Parsing strings

`datasize.ByteSize` implements `TextUnmarshaler` interface and will automatically parse human readable strings into correct values where it is used:

* `"10 MB"` -> `10* datasize.MB`
* `"10240 g"` -> `10 * datasize.TB`
* `"2000"` -> `2000 * datasize.B`
* `"1tB"` -> `datasize.TB`
* `"5 peta"` -> `5 * datasize.PB`
* `"28 kilobytes"` -> `28 * datasize.KB`
* `"1 gigabyte"` -> `1 * datasize.GB`

You can also do it manually:

```go
var v datasize.ByteSize
err := v.UnmarshalText([]byte("100 mb"))
```

### Printing

`Bytesize.String()` uses largest unit allowing an integer value:

* `(102400 * datasize.MB).String()` -> `"100GB"`
* `(datasize.MB + datasize.KB).String()` -> `"1025KB"`

Use `%d` format string to get value in bytes without a unit.

### JSON and other encoding

Both `TextMarshaler` and `TextUnmarshaler` interfaces are implemented - JSON will just work. Other encoders will work provided they use those interfaces.

### Human readable

`ByteSize.HumanReadable()` or `ByteSize.HR()` returns a string with 1-3 digits, followed by 1 decimal place, a space and unit big enough to get 1-3 digits

* `(102400 * datasize.MB).String()` -> `"100.0 GB"`
* `(datasize.MB + 512 * datasize.KB).String()` -> `"1.5 MB"`

### Limitations

* The underlying data type for `data.ByteSize` is `uint64`, so values outside of 0 to 2^64-1 range will overflow
* size helper functions (like `ByteSize.Kilobytes()`) return `float64`, which can't represent all possible values of `uint64` accurately:
  * if the returned value is supposed to have no fraction (ie `(10 * datasize.MB).Kilobytes()`) accuracy loss happens when value is more than 2^53 larger than unit: `.Kilobytes()` over 8 petabytes, `.Megabytes()` over 8 exabytes
  * if the returned value is supposed to have a fraction (ie `(datasize.PB + datasize.B).Megabytes()`) in addition to the above note accuracy loss may occur in fractional part too - larger integer part leaves fewer bytes to store fractional part, the smaller the remainder vs unit the move bytes are required to store the fractional part
* Parsing a string with `Mb`, `Tb`, etc units will return a syntax error, because capital followed by lower case is commonly used for bits, not bytes
* Parsing a string with value exceeding 2^64-1 bytes will return 2^64-1 and an out of range error
