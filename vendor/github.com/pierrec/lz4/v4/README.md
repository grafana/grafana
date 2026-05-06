# lz4 : LZ4 compression in pure Go

[![Go Reference](https://pkg.go.dev/badge/github.com/pierrec/lz4/v4.svg)](https://pkg.go.dev/github.com/pierrec/lz4/v4)
[![CI](https://github.com/pierrec/lz4/workflows/ci/badge.svg)](https://github.com/pierrec/lz4/actions)
[![Go Report Card](https://goreportcard.com/badge/github.com/pierrec/lz4)](https://goreportcard.com/report/github.com/pierrec/lz4)
[![GitHub tag (latest SemVer)](https://img.shields.io/github/tag/pierrec/lz4.svg?style=social)](https://github.com/pierrec/lz4/tags)

## Overview

This package provides a streaming interface to [LZ4 data streams](http://fastcompression.blogspot.fr/2013/04/lz4-streaming-format-final.html) as well as low level compress and uncompress functions for LZ4 data blocks.
The implementation is based on the reference C [one](https://github.com/lz4/lz4).

## Install

Assuming you have the go toolchain installed:

```
go get github.com/pierrec/lz4/v4
```

There is a command line interface tool to compress and decompress LZ4 files.

```
go install github.com/pierrec/lz4/v4/cmd/lz4c@latest
```

Usage

```
Usage of lz4c:
  -version
        print the program version

Subcommands:
Compress the given files or from stdin to stdout.
compress [arguments] [<file name> ...]
  -bc
        enable block checksum
  -l int
        compression level (0=fastest)
  -sc
        disable stream checksum
  -size string
        block max size [64K,256K,1M,4M] (default "4M")

Uncompress the given files or from stdin to stdout.
uncompress [arguments] [<file name> ...]

```


## Example

```
// Compress and uncompress an input string.
s := "hello world"
r := strings.NewReader(s)

// The pipe will uncompress the data from the writer.
pr, pw := io.Pipe()
zw := lz4.NewWriter(pw)
zr := lz4.NewReader(pr)

go func() {
	// Compress the input string.
	_, _ = io.Copy(zw, r)
	_ = zw.Close() // Make sure the writer is closed
	_ = pw.Close() // Terminate the pipe
}()

_, _ = io.Copy(os.Stdout, zr)

// Output:
// hello world
```

## Contributing

Contributions are very welcome for bug fixing, performance improvements...!

- Open an issue with a proper description
- Send a pull request with appropriate test case(s)

## Contributors

Thanks to all [contributors](https://github.com/pierrec/lz4/graphs/contributors)  so far!

Special thanks to [@Zariel](https://github.com/Zariel) for his asm implementation of the decoder.

Special thanks to [@greatroar](https://github.com/greatroar) for his work on the asm implementations of the decoder for amd64 and arm64.

Special thanks to [@klauspost](https://github.com/klauspost) for his work on optimizing the code.
