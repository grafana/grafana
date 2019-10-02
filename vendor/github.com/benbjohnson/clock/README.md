clock [![Build Status](https://drone.io/github.com/benbjohnson/clock/status.png)](https://drone.io/github.com/benbjohnson/clock/latest) [![Coverage Status](https://coveralls.io/repos/benbjohnson/clock/badge.png?branch=master)](https://coveralls.io/r/benbjohnson/clock?branch=master) [![GoDoc](https://godoc.org/github.com/benbjohnson/clock?status.png)](https://godoc.org/github.com/benbjohnson/clock) ![Project status](http://img.shields.io/status/experimental.png?color=red)
=====

Clock is a small library for mocking time in Go. It provides an interface
around the standard library's [`time`][time] package so that the application
can use the realtime clock while tests can use the mock clock.

[time]: http://golang.org/pkg/time/


## Usage

### Realtime Clock

Your application can maintain a `Clock` variable that will allow realtime and
mock clocks to be interchangable. For example, if you had an `Application` type:

```go
import "github.com/benbjohnson/clock"

type Application struct {
	Clock clock.Clock
}
```

You could initialize it to use the realtime clock like this:

```go
var app Application
app.Clock = clock.New()
...
```

Then all timers and time-related functionality should be performed from the
`Clock` variable.


### Mocking time

In your tests, you will want to use a `Mock` clock:

```go
import (
	"testing"

	"github.com/benbjohnson/clock"
)

func TestApplication_DoSomething(t *testing.T) {
	mock := clock.NewMock()
	app := Application{Clock: mock}
	...
}
```

Now that you've initialized your application to use the mock clock, you can
adjust the time programmatically. The mock clock always starts from the Unix
epoch (midnight, Jan 1, 1970 UTC).


### Controlling time

The mock clock provides the same functions that the standard library's `time`
package provides. For example, to find the current time, you use the `Now()`
function:

```go
mock := clock.NewMock()

// Find the current time.
mock.Now().UTC() // 1970-01-01 00:00:00 +0000 UTC

// Move the clock forward.
mock.Add(2 * time.Hour)

// Check the time again. It's 2 hours later!
mock.Now().UTC() // 1970-01-01 02:00:00 +0000 UTC
```

Timers and Tickers are also controlled by this same mock clock. They will only
execute when the clock is moved forward:

```
mock := clock.NewMock()
count := 0

// Kick off a timer to increment every 1 mock second.
go func() {
    ticker := clock.Ticker(1 * time.Second)
    for {
        <-ticker.C
        count++
    }
}()
runtime.Gosched()

// Move the clock forward 10 second.
mock.Add(10 * time.Second)

// This prints 10.
fmt.Println(count)
```


