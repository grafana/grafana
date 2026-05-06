# netipx [![Test Status](https://github.com/go4org/netipx/workflows/Linux/badge.svg)](https://github.com/go4org/netipx/actions) [![Go Reference](https://pkg.go.dev/badge/go4.org/netipx.svg)](https://pkg.go.dev/go4.org/netipx)

## What

This is a package containing the bits of the old `inet.af/netaddr` package that didn't make it
into Go 1.18's `net/netip` standard library package.

As background, see:

* https://github.com/inetaf/netaddr/ (now deprecated)
* https://tailscale.com/blog/netaddr-new-ip-type-for-go/ - blog post about why the package came to be originally
* https://go.dev/doc/go1.18#netip - Go 1.18 release notes

This package requires Go 1.18+ to use and complements the `net/netip`.

## FAQ

**Why's it no longer under `inet.af`?** Since that joke started, that
TLD is now under control of the Taliban. (Yes, we should've known
better.  We'd even previously scolded people for relying on
questionable ccTLDs. Whoops.)

**Will this stuff make it into the standard library?** [Maybe](https://github.com/golang/go/issues/53236).
We'll see.


