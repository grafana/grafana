# Backoff

A simple exponential backoff counter in Go (Golang)

[![GoDoc](https://godoc.org/github.com/jpillora/backoff?status.svg)](https://godoc.org/github.com/jpillora/backoff) [![Circle CI](https://circleci.com/gh/jpillora/backoff.svg?style=shield)](https://circleci.com/gh/jpillora/backoff)

### Install

```
$ go get -v github.com/jpillora/backoff
```

### Usage

Backoff is a `time.Duration` counter. It starts at `Min`. After every call to `Duration()` it is  multiplied by `Factor`. It is capped at `Max`. It returns to `Min` on every call to `Reset()`. `Jitter` adds randomness ([see below](#example-using-jitter)). Used in conjunction with the `time` package.

---

#### Simple example

``` go

b := &backoff.Backoff{
	//These are the defaults
	Min:    100 * time.Millisecond,
	Max:    10 * time.Second,
	Factor: 2,
	Jitter: false,
}

fmt.Printf("%s\n", b.Duration())
fmt.Printf("%s\n", b.Duration())
fmt.Printf("%s\n", b.Duration())

fmt.Printf("Reset!\n")
b.Reset()

fmt.Printf("%s\n", b.Duration())
```

```
100ms
200ms
400ms
Reset!
100ms
```

---

#### Example using `net` package

``` go
b := &backoff.Backoff{
    Max:    5 * time.Minute,
}

for {
	conn, err := net.Dial("tcp", "example.com:5309")
	if err != nil {
		d := b.Duration()
		fmt.Printf("%s, reconnecting in %s", err, d)
		time.Sleep(d)
		continue
	}
	//connected
	b.Reset()
	conn.Write([]byte("hello world!"))
	// ... Read ... Write ... etc
	conn.Close()
	//disconnected
}

```

---

#### Example using `Jitter`

Enabling `Jitter` adds some randomization to the backoff durations. [See Amazon's writeup of performance gains using jitter](http://www.awsarchitectureblog.com/2015/03/backoff.html). Seeding is not necessary but doing so gives repeatable results.

```go
import "math/rand"

b := &backoff.Backoff{
	Jitter: true,
}

rand.Seed(42)

fmt.Printf("%s\n", b.Duration())
fmt.Printf("%s\n", b.Duration())
fmt.Printf("%s\n", b.Duration())

fmt.Printf("Reset!\n")
b.Reset()

fmt.Printf("%s\n", b.Duration())
fmt.Printf("%s\n", b.Duration())
fmt.Printf("%s\n", b.Duration())
```

```
100ms
106.600049ms
281.228155ms
Reset!
100ms
104.381845ms
214.957989ms
```

#### Documentation

https://godoc.org/github.com/jpillora/backoff

#### Credits

Forked from [some JavaScript](https://github.com/segmentio/backo) written by [@tj](https://github.com/tj)
