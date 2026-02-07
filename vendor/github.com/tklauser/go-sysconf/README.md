# go-sysconf

[![Go Reference](https://pkg.go.dev/badge/github.com/tklauser/go-sysconf.svg)](https://pkg.go.dev/github.com/tklauser/go-sysconf)
[![GitHub Action Status](https://github.com/tklauser/go-sysconf/workflows/Tests/badge.svg)](https://github.com/tklauser/go-sysconf/actions?query=workflow%3ATests)

`sysconf` for Go, without using cgo or external binaries (e.g. getconf).

Supported operating systems: Linux, macOS, DragonflyBSD, FreeBSD, NetBSD, OpenBSD, Solaris/Illumos.

All POSIX.1 and POSIX.2 variables are supported, see [References](#references) for a complete list.

Additionally, the following non-standard variables are supported on some operating systems:

| Variable | Supported on |
|---|---|
| `SC_PHYS_PAGES`       | Linux, macOS, FreeBSD, NetBSD, OpenBSD, Solaris/Illumos |
| `SC_AVPHYS_PAGES`     | Linux, OpenBSD, Solaris/Illumos |
| `SC_NPROCESSORS_CONF` | Linux, macOS, FreeBSD, NetBSD, OpenBSD, Solaris/Illumos |
| `SC_NPROCESSORS_ONLN` | Linux, macOS, FreeBSD, NetBSD, OpenBSD, Solaris/Illumos |
| `SC_UIO_MAXIOV`       | Linux |

## Usage

```Go
package main

import (
	"fmt"

	"github.com/tklauser/go-sysconf"
)

func main() {
	// get clock ticks, this will return the same as C.sysconf(C._SC_CLK_TCK)
	clktck, err := sysconf.Sysconf(sysconf.SC_CLK_TCK)
	if err == nil {
		fmt.Printf("SC_CLK_TCK: %v\n", clktck)
	}
}
```

## References

* [POSIX documenation for `sysconf`](http://pubs.opengroup.org/onlinepubs/9699919799/functions/sysconf.html)
* [Linux manpage for `sysconf(3)`](http://man7.org/linux/man-pages/man3/sysconf.3.html)
* [glibc constants for `sysconf` parameters](https://www.gnu.org/software/libc/manual/html_node/Constants-for-Sysconf.html)
