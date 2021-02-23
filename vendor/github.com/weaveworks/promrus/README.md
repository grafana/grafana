<p align="center">
	<a href="https://github.com/weaveworks/promrus/releases/latest">
		<img src="https://img.shields.io/github/release/weaveworks/promrus.svg"/>
	</a>
	<a href="https://travis-ci.org/weaveworks/promrus">
		<img src="https://img.shields.io/travis/weaveworks/promrus.svg"/>
	</a>
	<a href="https://coveralls.io/github/weaveworks/promrus?branch=master">
		<img src="https://img.shields.io/coveralls/weaveworks/promrus.svg"/>
	</a>
	<a href="https://goreportcard.com/report/github.com/weaveworks/promrus">
		<img src="https://goreportcard.com/badge/github.com/weaveworks/promrus"/>
	</a>
	<a href="LICENSE">
		<img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg"/>
	</a>
</p>

# promrus
Logrus hook to expose the number of log messages as Prometheus metrics:
```
log_messages{level="debug"}
log_messages{level="info"}
log_messages{level="warning"}
log_messages{level="error"}
```

## Usage

Sample code:
```
package main

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	log "github.com/sirupsen/logrus"
	"github.com/weaveworks/promrus"
)

func main() {
	// Create the Prometheus hook:
	hook := promrus.MustNewPrometheusHook()

	// Configure logrus to use the Prometheus hook:
	log.AddHook(hook)

	// Expose Prometheus metrics via HTTP, as you usually would:
	go http.ListenAndServe(":8080", promhttp.Handler())

	// Log with logrus, as you usually would.
	// Every time the program generates a log message, a Prometheus counter is incremented for the corresponding level.
	for {
		log.Infof("foo")
		time.Sleep(1 * time.Second)
	}
}
```

Run the above program:
```
$ go get -u github.com/golang/dep/cmd/dep
$ dep ensure
$ go run main.go
INFO[0000] foo
INFO[0001] foo
INFO[0002] foo
[...]
INFO[0042] foo
```

Scrape the Prometheus metrics exposed by the hook:
```
$ curl -fsS localhost:8080 | grep log_messages
# HELP log_messages Total number of log messages.
# TYPE log_messages counter
log_messages{level="debug"} 0
log_messages{level="error"} 0
log_messages{level="info"} 42
log_messages{level="warning"} 0
```

## Setup development environment
```
$ go get github.com/golang/dep/cmd/dep
$ dep ensure
```

## Compile
```
$ go build
```

## Test
```
$ go test
DEBU[0000] this is at debug level!
INFO[0000] this is at info level!
WARN[0000] this is at warning level!
ERRO[0000] this is at error level!
PASS
ok  	github.com/weaveworks/promrus	0.011s
```
