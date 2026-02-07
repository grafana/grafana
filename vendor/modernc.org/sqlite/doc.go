// Copyright 2017 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package sqlite is a sql/database driver using a CGo-free port of the C
// SQLite3 library.
//
// SQLite is an in-process implementation of a self-contained, serverless,
// zero-configuration, transactional SQL database engine.
//
// # Fragile modernc.org/libc dependency
//
// When you import this package you should use in your go.mod file the exact
// same version of modernc.org/libc as seen in the go.mod file of this
// repository.
//
// See the discussion at https://gitlab.com/cznic/sqlite/-/issues/177 for more details.
//
// # Thanks
//
// This project is sponsored by Schleibinger Geräte Teubert u. Greim GmbH by
// allowing one of the maintainers to work on it also in office hours.
//
// # Supported platforms and architectures
//
// These combinations of GOOS and GOARCH are currently supported
//
//	OS      Arch    SQLite version
//	------------------------------
//	darwin	amd64   3.50.4
//	darwin	arm64   3.50.4
//	freebsd	amd64   3.50.4
//	freebsd	arm64   3.50.4
//	linux	386     3.50.4
//	linux	amd64   3.50.4
//	linux	arm     3.50.4
//	linux	arm64   3.50.4
//	linux	loong64 3.50.4
//	linux	ppc64le 3.50.4
//	linux	riscv64 3.50.4
//	linux	s390x   3.50.4
//	windows	386     3.50.4
//	windows	amd64   3.50.4
//	windows	arm64   3.50.4
//
// # Benchmarks
//
// [The SQLite Drivers Benchmarks Game]
//
// # Builders
//
// Builder results available at:
//
// https://modern-c.appspot.com/-/builder/?importpath=modernc.org%2fsqlite
//
// # Changelog
//
//   - 2025-10-10 v1.39.1: Upgrade to SQLite 3.50.4.
//
//   - 2025-06-09 v1.38.0: Upgrade to SQLite 3.50.1.
// 
//   - 2025-02-26 v1.36.0: Upgrade to SQLite 3.49.0.
//
//   - 2024-11-16 v1.34.0: Implement ResetSession and IsValid methods in connection
//
//   - 2024-07-22 v1.31.0: Support windows/386.
//
//   - 2024-06-04 v1.30.0: Upgrade to SQLite 3.46.0, release notes at
//     https://sqlite.org/releaselog/3_46_0.html.
//
//   - 2024-02-13 v1.29.0: Upgrade to SQLite 3.45.1, release notes at
//     https://sqlite.org/releaselog/3_45_1.html.
//
//   - 2023-12-14: v1.28.0: Add (*Driver).RegisterConnectionHook,
//     ConnectionHookFn, ExecQuerierContext, RegisterConnectionHook.
//
//   - 2023-08-03 v1.25.0: enable SQLITE_ENABLE_DBSTAT_VTAB.
//
//   - 2023-07-11 v1.24.0: Add
//     (*conn).{Serialize,Deserialize,NewBackup,NewRestore} methods, add Backup
//     type.
//
//   - 2023-06-01 v1.23.0: Allow registering aggregate functions.
//
//   - 2023-04-22 v1.22.0: Support linux/s390x.
//
//   - 2023-02-23 v1.21.0: Upgrade to SQLite 3.41.0, release notes at
//     https://sqlite.org/releaselog/3_41_0.html.
//
//   - 2022-11-28 v1.20.0: Support linux/ppc64le.
//
//   - 2022-09-16 v1.19.0: Support frebsd/arm64.
//
//   - 2022-07-26 v1.18.0: Add support for Go fs.FS based SQLite virtual
//     filesystems, see function New in modernc.org/sqlite/vfs and/or TestVFS in
//     all_test.go
//
//   - 2022-04-24 v1.17.0: Support windows/arm64.
//
//   - 2022-04-04 v1.16.0: Support scalar application defined functions written
//     in Go. See https://www.sqlite.org/appfunc.html
//
//   - 2022-03-13 v1.15.0: Support linux/riscv64.
//
//   - 2021-11-13 v1.14.0: Support windows/amd64. This target had previously
//     only experimental status because of a now resolved memory leak.
//
//   - 2021-09-07 v1.13.0: Support freebsd/amd64.
//
//   - 2021-06-23 v1.11.0: Upgrade to use sqlite 3.36.0, release notes at
//     https://www.sqlite.org/releaselog/3_36_0.html.
//
//   - 2021-05-06 v1.10.6: Fixes a memory corruption issue
//     (https://gitlab.com/cznic/sqlite/-/issues/53).  Versions since v1.8.6 were
//     affected and should be updated to v1.10.6.
//
//   - 2021-03-14 v1.10.0: Update to use sqlite 3.35.0, release notes at
//     https://www.sqlite.org/releaselog/3_35_0.html.
//
//   - 2021-03-11 v1.9.0: Support darwin/arm64.
//
//   - 2021-01-08 v1.8.0: Support darwin/amd64.
//
//   - 2020-09-13 v1.7.0: Support linux/arm and linux/arm64.
//
//   - 2020-09-08 v1.6.0: Support linux/386.
//
//   - 2020-09-03 v1.5.0: This project is now completely CGo-free, including
//     the Tcl tests.
//
//   - 2020-08-26 v1.4.0: First stable release for linux/amd64.  The
//     database/sql driver and its tests are CGo free.  Tests of the translated
//     sqlite3.c library still require CGo.
//
//   - 2020-07-26 v1.4.0-beta1: The project has reached beta status while
//     supporting linux/amd64 only at the moment. The 'extraquick' Tcl testsuite
//     reports
//
//   - 2019-12-28 v1.2.0-alpha.3: Third alpha fixes issue #19.
//
//   - 2019-12-26 v1.1.0-alpha.2: Second alpha release adds support for
//     accessing a database concurrently by multiple goroutines and/or processes.
//     v1.1.0 is now considered feature-complete. Next planed release should be a
//     beta with a proper test suite.
//
//   - 2019-12-18 v1.1.0-alpha.1: First alpha release using the new cc/v3,
//     gocc, qbe toolchain. Some primitive tests pass on linux_{amd64,386}. Not
//     yet safe for concurrent access by multiple goroutines. Next alpha release
//     is planed to arrive before the end of this year.
//
//   - 2017-06-10: Windows/Intel no more uses the VM (thanks Steffen Butzer).
//
//   - 2017-06-05 Linux/Intel no more uses the VM (cznic/virtual).
//
// # Connecting to a database
//
// To access a Sqlite database do something like
//
//	import (
//		"database/sql"
//
//		_ "modernc.org/sqlite"
//	)
//
//	...
//
//
//	db, err := sql.Open("sqlite", dsnURI)
//
//	...
//
// # Debug and development versions
//
// A comma separated list of options can be passed to `go generate` via the
// environment variable GO_GENERATE. Some useful options include for example:
//
//	-DSQLITE_DEBUG
//	-DSQLITE_MEM_DEBUG
//	-ccgo-verify-structs
//
// To create a debug/development version, issue for example:
//
//	$ GO_GENERATE=-DSQLITE_DEBUG,-DSQLITE_MEM_DEBUG go generate
//
// Note: To run `go generate` you need to have modernc.org/ccgo/v3 installed.
//
// # Hacking
//
// This is an example of how to use the debug logs in modernc.org/libc when hunting a bug.
//
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$ git status
//	On branch master
//	Your branch is up to date with 'origin/master'.
//
//	nothing to commit, working tree clean
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$ git log -1
//	commit df33b8d15107f3cc777799c0fe105f74ef499e62 (HEAD -> master, tag: v1.21.1, origin/master, origin/HEAD, wips, ok)
//	Author: Jan Mercl <0xjnml@gmail.com>
//	Date:   Mon Mar 27 16:18:28 2023 +0200
//
//	    upgrade to SQLite 3.41.2
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$ rm -f /tmp/libc.log ; go test -v -tags=libc.dmesg -run TestScalar ; ls -l /tmp/libc.log
//	test binary compiled for linux/amd64
//	=== RUN   TestScalar
//	--- PASS: TestScalar (0.09s)
//	PASS
//	ok  modernc.org/sqlite 0.128s
//	-rw-r--r-- 1 jnml jnml 76 Apr  6 11:22 /tmp/libc.log
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$ cat /tmp/libc.log
//	[10723 sqlite.test] 2023-04-06 11:22:48.288066057 +0200 CEST m=+0.000707150
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$
//
// The /tmp/libc.log file is created as requested. No useful messages there because none are enabled in libc. Let's try to enable Xwrite as an example.
//
//	0:jnml@e5-1650:~/src/modernc.org/libc$ git status
//	On branch master
//	Your branch is up to date with 'origin/master'.
//
//	Changes not staged for commit:
//	  (use "git add <file>..." to update what will be committed)
//	  (use "git restore <file>..." to discard changes in working directory)
//	modified:   libc_linux.go
//
//	no changes added to commit (use "git add" and/or "git commit -a")
//	0:jnml@e5-1650:~/src/modernc.org/libc$ git log -1
//	commit 1e22c18cf2de8aa86d5b19b165f354f99c70479c (HEAD -> master, tag: v1.22.3, origin/master, origin/HEAD)
//	Author: Jan Mercl <0xjnml@gmail.com>
//	Date:   Wed Feb 22 20:27:45 2023 +0100
//
//	    support sqlite 3.41 on linux targets
//	0:jnml@e5-1650:~/src/modernc.org/libc$ git diff
//	diff --git a/libc_linux.go b/libc_linux.go
//	index 1c2f482..ac1f08d 100644
//	--- a/libc_linux.go
//	+++ b/libc_linux.go
//	@@ -332,19 +332,19 @@ func Xwrite(t *TLS, fd int32, buf uintptr, count types.Size_t) types.Ssize_t {
//	                var n uintptr
//	                switch n, _, err = unix.Syscall(unix.SYS_WRITE, uintptr(fd), buf, uintptr(count)); err {
//	                case 0:
//	-                       // if dmesgs {
//	-                       //      // dmesg("%v: %d %#x: %#x\n%s", origin(1), fd, count, n, hex.Dump(GoBytes(buf, int(n))))
//	-                       //      dmesg("%v: %d %#x: %#x", origin(1), fd, count, n)
//	-                       // }
//	+                       if dmesgs {
//	+                               // dmesg("%v: %d %#x: %#x\n%s", origin(1), fd, count, n, hex.Dump(GoBytes(buf, int(n))))
//	+                               dmesg("%v: %d %#x: %#x", origin(1), fd, count, n)
//	+                       }
//	                        return types.Ssize_t(n)
//	                case errno.EAGAIN:
//	                        // nop
//	                }
//	        }
//
//	-       // if dmesgs {
//	-       //      dmesg("%v: fd %v, count %#x: %v", origin(1), fd, count, err)
//	-       // }
//	+       if dmesgs {
//	+               dmesg("%v: fd %v, count %#x: %v", origin(1), fd, count, err)
//	+       }
//	        t.setErrno(err)
//	        return -1
//	 }
//	0:jnml@e5-1650:~/src/modernc.org/libc$
//
// We need to tell the Go build system to use our local, patched/debug libc:
//
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$ go work use $(go env GOPATH)/src/modernc.org/libc
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$ go work use .
//
// And run the test again:
//
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$ rm -f /tmp/libc.log ; go test -v -tags=libc.dmesg -run TestScalar ; ls -l /tmp/libc.log
//	test binary compiled for linux/amd64
//	=== RUN   TestScalar
//	--- PASS: TestScalar (0.26s)
//	PASS
//	ok   modernc.org/sqlite 0.285s
//	-rw-r--r-- 1 jnml jnml 918 Apr  6 11:29 /tmp/libc.log
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$ cat /tmp/libc.log
//	[11910 sqlite.test] 2023-04-06 11:29:13.143589542 +0200 CEST m=+0.000689270
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0x200: 0x200
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0xc: 0xc
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 7 0x1000: 0x1000
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 7 0x1000: 0x1000
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0x200: 0x200
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0x4: 0x4
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0x1000: 0x1000
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0x4: 0x4
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0x4: 0x4
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0x1000: 0x1000
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0x4: 0x4
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 8 0xc: 0xc
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 7 0x1000: 0x1000
//	[11910 sqlite.test] libc_linux.go:337:Xwrite: 7 0x1000: 0x1000
//	0:jnml@e5-1650:~/src/modernc.org/sqlite$
//
// # Sqlite documentation
//
// See https://sqlite.org/docs.html
//
// [The SQLite Drivers Benchmarks Game]: https://pkg.go.dev/modernc.org/sqlite-bench#readme-tl-dr-scorecard
package sqlite // import "modernc.org/sqlite"
