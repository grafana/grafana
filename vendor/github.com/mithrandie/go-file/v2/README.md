# go-file

Package file is a Go library to open files with file locking depending on the system.

[![Build Status](https://travis-ci.org/mithrandie/go-file.svg?branch=master)](https://travis-ci.org/mithrandie/go-file)
[![GoDoc](https://godoc.org/github.com/mithrandie/go-file?status.svg)](http://godoc.org/github.com/mithrandie/go-file)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](https://opensource.org/licenses/MIT)

## Install

```
go get github.com/mithrandie/go-file
```

#### Requirements

Go 1.17 or later (cf. [Getting Started - The Go Programming Language](https://golang.org/doc/install))

## Supported Systems

Currently, file locking on the following systems are supported.

### darwin dragonfly freebsd linux netbsd openbsd solaris

Advisory Lock

### windows

Mandatory Lock

### android nacl plan9 zos

Not Supported

## Example

```go
package main

import (
	"bufio"
	"context"
	"fmt"
	"time"
	 
	"github.com/mithrandie/go-file/v2"
)

func main() {
	// Try to lock and open the file with shared lock
	fp, err := file.TryOpenToRead("/path/to/file")
	if err != nil {
		panic(err)
	}
	defer func() {
		if e := file.Close(fp); e != nil {
			println(e.Error())
		}
	}()

	s := bufio.NewScanner(fp)
	for s.Scan() {
		fmt.Println(s.Text())
	}

	// Open the file with shared lock.
	// If the file is already locked, tries to lock repeatedly until the conditions is met.
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	cfp, err := file.OpenToReadContext(ctx, 50*time.Millisecond, "/path/to/file2")
	if err != nil {
		panic(err)
	}
	defer func() {
		cancel()
		if e := file.Close(cfp); e != nil {
			println(e.Error())
		}
	}()

	cs := bufio.NewScanner(cfp)
	for cs.Scan() {
		fmt.Println(cs.Text())
	}
}
```
