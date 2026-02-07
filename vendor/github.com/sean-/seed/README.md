# `seed` - Quickly Seed Go's Random Number Generator

Boiler-plate to securely [seed](https://en.wikipedia.org/wiki/Random_seed) Go's
random number generator (if possible).  This library isn't anything fancy, it's
just a canonical way of seeding Go's random number generator. Cribbed from
[`Nomad`](https://github.com/hashicorp/nomad/commit/f89a993ec6b91636a3384dd568898245fbc273a1)
before it was moved into
[`Consul`](https://github.com/hashicorp/consul/commit/d695bcaae6e31ee307c11fdf55bb0bf46ea9fcf4)
and made into a helper function, and now further modularized to be a super
lightweight and reusable library.

Time is better than
[Go's default seed of `1`](https://golang.org/pkg/math/rand/#Seed), but friends
don't let friends use time as a seed to a random number generator.  Use
`seed.MustInit()` instead.

`seed.Init()` is an idempotent and reentrant call that will return an error if
it can't seed the value the first time it is called.  `Init()` is reentrant.

`seed.MustInit()` is idempotent and reentrant call that will `panic()` if it
can't seed the value the first time it is called.  `MustInit()` is reentrant.

## Usage

```
package mypackage

import (
  "github.com/sean-/seed"
)

// MustInit will panic() if it is unable to set a high-entropy random seed:
func init() {
  seed.MustInit()
}

// Or if you want to not panic() and can actually handle this error:
func init() {
  if secure, err := !seed.Init(); !secure {
    // Handle the error
    //panic(fmt.Sprintf("Unable to securely seed Go's RNG: %v", err))
  }
}
```
