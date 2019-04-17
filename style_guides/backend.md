# Backend style guide

Grafanas backend has been developed for a long time with a mix of code styles.

This style guide is a guide for how we want to write Go code in the future. Generally, we want to follow the style guides used in Go [Code Review Comments](https://code.google.com/p/go-wiki/wiki/CodeReviewComments) and Peter Bourgon's [Go: Best Practices for Production Environments](http://peter.bourgon.org/go-in-production/#formatting-and-style)


## Global state
Global state makes testing and debugging software harder and its something we want to avoid when possible.
Unfortunately, there is quite a lot of global state in Grafana. The way we want to migrate away from this
is to use the `inject` package to wire up all dependencies either in `pkg/cmd/grafana-server/main.go` or
self registering using `registry.RegisterService` ex https://github.com/grafana/grafana/blob/master/pkg/services/cleanup/cleanup.go#L25

### the `bus`
`bus.Dispatch` is used in many places and something we want to avoid in the future since it refers to a global instance.
The preferred solution, in this case, is to inject the `bus` into services or take the bus instance as a parameter into functions.

### settings package
In the `setting` packages there are many global variables which Grafana sets at startup. This is also something we want to move
away from and move as much configuration as possible to the `setting.Cfg` struct and pass it around, just like the bus.

## Linting and formatting
We enforce strict `gofmt` formating and use some linters on our codebase. You can find the current list of linters at https://github.com/grafana/grafana/blob/master/scripts/backend-lint.sh

We use [revive](https://github.com/mgechev/revive) as a go linter, and do enforce our [custom config](https://github.com/grafana/grafana/blob/master/conf/revive.toml) for it.

## Testing
We use GoConvey for BDD/scenario based testing. Which we think is useful for testing certain chain or interactions. Ex https://github.com/grafana/grafana/blob/master/pkg/services/auth/auth_token_test.go

For smaller tests its preferred to use standard library testing.

### Mocks/Stubs
As a general rule of thumb we try to override/replace functions/methods when mocks/stubs are needed. One common task is the need of overriding time (`time.Now()`). See usage of `getTime` variable in [code](https://github.com/grafana/grafana/blob/52c39904120fb0b98494b961be67bb47574245b1/pkg/services/auth/auth_token.go#L22) and in [test](https://github.com/grafana/grafana/blob/52c39904120fb0b98494b961be67bb47574245b1/pkg/services/auth/auth_token_test.go#L23-L26) as an example.

When you need to stub/mock an interface you can implement a struct that allows you to override methods on a test-by-test basis. See [stub](https://github.com/grafana/grafana/blob/52c39904120fb0b98494b961be67bb47574245b1/pkg/services/auth/testing.go) and [example usage](https://github.com/grafana/grafana/blob/52c39904120fb0b98494b961be67bb47574245b1/pkg/middleware/middleware_test.go#L153-L180).
