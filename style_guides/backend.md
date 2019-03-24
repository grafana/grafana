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
We enforce strict `gofmt` formating and use some linters on our codebase. You can find the current list of linters at https://github.com/grafana/grafana/blob/master/scripts/gometalinter.sh#L23 

We don't enforce `golint` but we encourage it and we will test so the number of linting errors does not increase over time.

## Testing
We use GoConvey for BDD/scenario based testing. Which we think is useful for testing certain chain or interactions. Ex https://github.com/grafana/grafana/blob/master/pkg/services/auth/auth_token_test.go

For smaller tests its preferred to use standard library testing.
