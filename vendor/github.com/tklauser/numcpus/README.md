# numcpus

[![Go Reference](https://pkg.go.dev/badge/github.com/tklauser/numcpus.svg)](https://pkg.go.dev/github.com/tklauser/numcpus)
[![GitHub Action Status](https://github.com/tklauser/numcpus/workflows/Tests/badge.svg)](https://github.com/tklauser/numcpus/actions?query=workflow%3ATests)

Package numcpus provides information about the number of CPUs in the system.

It gets the number of CPUs (online, offline, present, possible, configured or
kernel maximum) on Linux, Darwin, FreeBSD, NetBSD, OpenBSD, DragonflyBSD or
Solaris/Illumos systems.

On Linux, the information is retrieved by reading the corresponding CPU
topology files in `/sys/devices/system/cpu`.

On BSD systems, the information is retrieved using the `hw.ncpu` and
`hw.ncpuonline` sysctls, if supported.

Not all functions are supported on Darwin, FreeBSD, NetBSD, OpenBSD,
DragonflyBSD and Solaris/Illumos. ErrNotSupported is returned in case a
function is not supported on a particular platform.

## Usage

```Go
package main

import (
	"fmt"
	"os"

	"github.com/tklauser/numcpus"
)

func main() {
	online, err := numcpus.GetOnline()
	if err != nil {
		fmt.Fprintf(os.Stderr, "GetOnline: %v\n", err)
	}
	fmt.Printf("online CPUs: %v\n", online)

	possible, err := numcpus.GetPossible()
	if err != nil {
		fmt.Fprintf(os.Stderr, "GetPossible: %v\n", err)
	}
	fmt.Printf("possible CPUs: %v\n", possible)
}
```

## References

* [Linux kernel sysfs documentation for CPU attributes](https://www.kernel.org/doc/Documentation/ABI/testing/sysfs-devices-system-cpu)
* [Linux kernel CPU topology documentation](https://www.kernel.org/doc/Documentation/cputopology.txt)
