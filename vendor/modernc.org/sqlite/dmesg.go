// Copyright 2023 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build sqlite.dmesg
// +build sqlite.dmesg

package sqlite // import "modernc.org/sqlite"

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const dmesgs = true

var (
	pid  = fmt.Sprintf("[%v %v] ", os.Getpid(), filepath.Base(os.Args[0]))
	logf *os.File
)

func init() {
	t := time.Now()
	// 01/02 03:04:05PM '06 -0700
	dn := t.Format("sqlite-dmesg-2006-01-02-03-150405")
	dn = filepath.Join(os.TempDir(), fmt.Sprintf("%s.%d", dn, os.Getpid()))
	if err := os.Mkdir(dn, 0770); err != nil {
		panic(err.Error())
	}

	fn := filepath.Join(dn, "dmesg.log")
	var err error
	if logf, err = os.OpenFile(fn, os.O_APPEND|os.O_CREATE|os.O_WRONLY|os.O_SYNC, 0644); err != nil {
		panic(err.Error())
	}

	dmesg("%v", time.Now())
	fmt.Fprintf(os.Stderr, "debug messages in %s\n", fn)
}

func dmesg(s string, args ...interface{}) {
	if s == "" {
		s = strings.Repeat("%v ", len(args))
	}
	s = fmt.Sprintf(pid+s, args...)
	s += fmt.Sprintf(" (%v: %v:)", origin(3), origin(2))
	switch {
	case len(s) != 0 && s[len(s)-1] == '\n':
		fmt.Fprint(logf, s)
	default:
		fmt.Fprintln(logf, s)
	}
}
