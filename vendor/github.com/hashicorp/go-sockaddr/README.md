# go-sockaddr

## `sockaddr` Library

Socket address convenience functions for Go.  `go-sockaddr` is a convenience
library that makes doing the right thing with IP addresses easy.  `go-sockaddr`
is loosely modeled after the UNIX `sockaddr_t` and creates a union of the family
of `sockaddr_t` types (see below for an ascii diagram).  Library documentation
is available
at
[https://godoc.org/github.com/hashicorp/go-sockaddr](https://godoc.org/github.com/hashicorp/go-sockaddr).
The primary intent of the library was to make it possible to define heuristics
for selecting the correct IP addresses when a configuration is evaluated at
runtime.  See
the
[docs](https://godoc.org/github.com/hashicorp/go-sockaddr),
[`template` package](https://godoc.org/github.com/hashicorp/go-sockaddr/template),
tests,
and
[CLI utility](https://github.com/hashicorp/go-sockaddr/tree/master/cmd/sockaddr)
for details and hints as to how to use this library.

For example, with this library it is possible to find an IP address that:

* is attached to a default route
  ([`GetDefaultInterfaces()`](https://godoc.org/github.com/hashicorp/go-sockaddr#GetDefaultInterfaces))
* is contained within a CIDR block ([`IfByNetwork()`](https://godoc.org/github.com/hashicorp/go-sockaddr#IfByNetwork))
* is an RFC1918 address
  ([`IfByRFC("1918")`](https://godoc.org/github.com/hashicorp/go-sockaddr#IfByRFC))
* is ordered
  ([`OrderedIfAddrBy(args)`](https://godoc.org/github.com/hashicorp/go-sockaddr#OrderedIfAddrBy) where
  `args` includes, but is not limited
  to,
  [`AscIfType`](https://godoc.org/github.com/hashicorp/go-sockaddr#AscIfType),
  [`AscNetworkSize`](https://godoc.org/github.com/hashicorp/go-sockaddr#AscNetworkSize))
* excludes all IPv6 addresses
  ([`IfByType("^(IPv4)$")`](https://godoc.org/github.com/hashicorp/go-sockaddr#IfByType))
* is larger than a `/32`
  ([`IfByMaskSize(32)`](https://godoc.org/github.com/hashicorp/go-sockaddr#IfByMaskSize))
* is not on a `down` interface
  ([`ExcludeIfs("flags", "down")`](https://godoc.org/github.com/hashicorp/go-sockaddr#ExcludeIfs))
* preferences an IPv6 address over an IPv4 address
  ([`SortIfByType()`](https://godoc.org/github.com/hashicorp/go-sockaddr#SortIfByType) +
  [`ReverseIfAddrs()`](https://godoc.org/github.com/hashicorp/go-sockaddr#ReverseIfAddrs)); and
* excludes any IP in RFC6890 address
  ([`IfByRFC("6890")`](https://godoc.org/github.com/hashicorp/go-sockaddr#IfByRFC))

Or any combination or variation therein.

There are also a few simple helper functions such as `GetPublicIP` and
`GetPrivateIP` which both return strings and select the first public or private
IP address on the default interface, respectively.  Similarly, there is also a
helper function called `GetInterfaceIP` which returns the first usable IP
address on the named interface.

## `sockaddr` CLI

Given the possible complexity of the `sockaddr` library, there is a CLI utility
that accompanies the library, also
called
[`sockaddr`](https://github.com/hashicorp/go-sockaddr/tree/master/cmd/sockaddr).
The
[`sockaddr`](https://github.com/hashicorp/go-sockaddr/tree/master/cmd/sockaddr)
utility exposes nearly all of the functionality of the library and can be used
either as an administrative tool or testing tool.  To install
the
[`sockaddr`](https://github.com/hashicorp/go-sockaddr/tree/master/cmd/sockaddr),
run:

```text
$ go install github.com/hashicorp/go-sockaddr/cmd/sockaddr@latest
```

If you're familiar with UNIX's `sockaddr` struct's, the following diagram
mapping the C `sockaddr` (top) to `go-sockaddr` structs (bottom) and
interfaces will be helpful:

```
+-------------------------------------------------------+
|                                                       |
|                        sockaddr                       |
|                        SockAddr                       |
|                                                       |
| +--------------+ +----------------------------------+ |
| | sockaddr_un  | |                                  | |
| | SockAddrUnix | |           sockaddr_in{,6}        | |
| +--------------+ |                IPAddr            | |
|                  |                                  | |
|                  | +-------------+ +--------------+ | |
|                  | | sockaddr_in | | sockaddr_in6 | | |
|                  | |   IPv4Addr  | |   IPv6Addr   | | |
|                  | +-------------+ +--------------+ | |
|                  |                                  | |
|                  +----------------------------------+ |
|                                                       |
+-------------------------------------------------------+
```

## Inspiration and Design

There were many subtle inspirations that led to this design, but the most direct
inspiration for the filtering syntax was
OpenBSD's
[`pf.conf(5)`](https://www.freebsd.org/cgi/man.cgi?query=pf.conf&apropos=0&sektion=0&arch=default&format=html#PARAMETERS) firewall
syntax that lets you select the first IP address on a given named interface.
The original problem stemmed from:

* needing to create immutable images using [Packer](https://www.packer.io) that
  ran the [Consul](https://www.consul.io) process (Consul can only use one IP
  address at a time);
* images that may or may not have multiple interfaces or IP addresses at
  runtime; and
* we didn't want to rely on configuration management to render out the correct
  IP address if the VM image was being used in an auto-scaling group.

Instead we needed some way to codify a heuristic that would correctly select the
right IP address but the input parameters were not known when the image was
created.
