# InfluxDB Client Go

[![CircleCI](https://circleci.com/gh/influxdata/influxdb-client-go.svg?style=svg)](https://circleci.com/gh/influxdata/influxdb-client-go)
[![codecov](https://codecov.io/gh/influxdata/influxdb-client-go/branch/master/graph/badge.svg)](https://codecov.io/gh/influxdata/influxdb-client-go)
[![License](https://img.shields.io/github/license/influxdata/influxdb-client-go.svg)](https://github.com/influxdata/influxdb-client-go/blob/master/LICENSE)
[![Slack Status](https://img.shields.io/badge/slack-join_chat-white.svg?logo=slack&style=social)](https://www.influxdata.com/slack)

This repository contains the Go client library for use with InfluxDB 2.x and Flux. InfluxDB 3.x users should instead use the lightweight [v3 client library](https://github.com/InfluxCommunity/influxdb3-go). InfluxDB 1.x users should use the [v1 client library](https://github.com/influxdata/influxdb/tree/1.8/client).

For ease of migration and a consistent query and write experience, v2 users should consider using InfluxQL and the [v1 client library](https://github.com/influxdata/influxdb/tree/1.8/client).

- [Features](#features)
- [Documentation](#documentation)
    - [Examples](#examples)
- [How To Use](#how-to-use)
    - [Installation](#installation)
    - [Basic Example](#basic-example)
    - [Writes in Detail](#writes)
    - [Queries in Detail](#queries)
    - [Parametrized Queries](#parametrized-queries)
    - [Concurrency](#concurrency)
    - [Proxy and redirects](#proxy-and-redirects)
    - [Checking Server State](#checking-server-state)
- [InfluxDB 1.8 API compatibility](#influxdb-18-api-compatibility)
- [Contributing](#contributing)
- [License](#license)

## Features

- InfluxDB 2 client
    - Querying data
        - using the Flux language
        - into raw data, flux table representation
        - [How to queries](#queries)
    - Writing data using
        - [Line Protocol](https://docs.influxdata.com/influxdb/v2.0/reference/syntax/line-protocol/)
        - [Data Point](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api/write#Point)
        - Both [asynchronous](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteAPI) or [synchronous](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteAPIBlocking) ways
        - [How to writes](#writes)
    - InfluxDB 2 API
        - setup, ready, health
        - authotizations, users, organizations
        - buckets, delete
        - ...

## Documentation

This section contains links to the client library documentation.

- [Product documentation](https://docs.influxdata.com/influxdb/v2.0/tools/client-libraries/), [Getting Started](#how-to-use)
- [Examples](#examples)
- [API Reference](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2)
- [Changelog](CHANGELOG.md)

### Examples

Examples for basic writing and querying data are shown below in this document

There are also other examples in the API docs:
 - [Client usage](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2?tab=doc#pkg-examples)
 - [Management APIs](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api?tab=doc#pkg-examples)

## How To Use

### Installation
**Go 1.17** or later is required.

#### Go mod project
1.  Add the latest version of the client package to your project dependencies (go.mod).
    ```sh
    go get github.com/influxdata/influxdb-client-go/v2
    ```
1. Add import `github.com/influxdata/influxdb-client-go/v2` to your source code.
#### GOPATH project
    ```sh
    go get github.com/influxdata/influxdb-client-go
    ```
Note: To have _go get_ in the GOPATH mode, the environment variable `GO111MODULE` must have the `off` value.

### Basic Example
The following example demonstrates how to write data to InfluxDB 2 and read them back using the Flux language:
```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
    // Create a new client using an InfluxDB server base URL and an authentication token
    client := influxdb2.NewClient("http://localhost:8086", "my-token")
    // Use blocking write client for writes to desired bucket
    writeAPI := client.WriteAPIBlocking("my-org", "my-bucket")
    // Create point using full params constructor
    p := influxdb2.NewPoint("stat",
        map[string]string{"unit": "temperature"},
        map[string]interface{}{"avg": 24.5, "max": 45.0},
        time.Now())
    // write point immediately
    writeAPI.WritePoint(context.Background(), p)
    // Create point using fluent style
    p = influxdb2.NewPointWithMeasurement("stat").
        AddTag("unit", "temperature").
        AddField("avg", 23.2).
        AddField("max", 45.0).
        SetTime(time.Now())
    err := writeAPI.WritePoint(context.Background(), p)
	if err != nil {
		panic(err)
	}
    // Or write directly line protocol
    line := fmt.Sprintf("stat,unit=temperature avg=%f,max=%f", 23.5, 45.0)
    err = writeAPI.WriteRecord(context.Background(), line)
	if err != nil {
		panic(err)
	}

    // Get query client
    queryAPI := client.QueryAPI("my-org")
    // Get parser flux query result
    result, err := queryAPI.Query(context.Background(), `from(bucket:"my-bucket")|> range(start: -1h) |> filter(fn: (r) => r._measurement == "stat")`)
    if err == nil {
        // Use Next() to iterate over query result lines
        for result.Next() {
            // Observe when there is new grouping key producing new table
            if result.TableChanged() {
                fmt.Printf("table: %s\n", result.TableMetadata().String())
            }
            // read result
            fmt.Printf("row: %s\n", result.Record().String())
        }
        if result.Err() != nil {
            fmt.Printf("Query error: %s\n", result.Err().Error())
        }
    } else {
		panic(err)
    }
    // Ensures background processes finishes
    client.Close()
}
```
### Options
The InfluxDBClient uses set of options to configure behavior. These are available in the [Options](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2#Options) object
Creating a client instance using
```go
client := influxdb2.NewClient("http://localhost:8086", "my-token")
```
will use the default options.

To set different configuration values, e.g. to set gzip compression and trust all server certificates, get default options
and change what is needed:
```go
client := influxdb2.NewClientWithOptions("http://localhost:8086", "my-token",
    influxdb2.DefaultOptions().
        SetUseGZip(true).
        SetTLSConfig(&tls.Config{
            InsecureSkipVerify: true,
        }))
```
### Writes

Client offers two ways of writing, non-blocking and blocking.

### Non-blocking write client
Non-blocking write client uses implicit batching. Data are asynchronously
written to the underlying buffer and they are automatically sent to a server when the size of the write buffer reaches the batch size, default 5000, or the flush interval, default 1s, times out.
Writes are automatically retried on server back pressure.

This write client also offers synchronous blocking method to ensure that write buffer is flushed and all pending writes are finished,
see [Flush()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteAPI.Flush) method.
Always use [Close()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2#Client.Close) method of the client to stop all background processes.

Asynchronous write client is recommended for frequent periodic writes.

```go
package main

import (
    "fmt"
    "math/rand"
    "time"

    "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
    // Create a new client using an InfluxDB server base URL and an authentication token
    // and set batch size to 20
    client := influxdb2.NewClientWithOptions("http://localhost:8086", "my-token",
        influxdb2.DefaultOptions().SetBatchSize(20))
    // Get non-blocking write client
    writeAPI := client.WriteAPI("my-org","my-bucket")
    // write some points
    for i := 0; i <100; i++ {
        // create point
        p := influxdb2.NewPoint(
            "system",
            map[string]string{
                "id":       fmt.Sprintf("rack_%v", i%10),
                "vendor":   "AWS",
                "hostname": fmt.Sprintf("host_%v", i%100),
            },
            map[string]interface{}{
                "temperature": rand.Float64() * 80.0,
                "disk_free":   rand.Float64() * 1000.0,
                "disk_total":  (i/10 + 1) * 1000000,
                "mem_total":   (i/100 + 1) * 10000000,
                "mem_free":    rand.Uint64(),
            },
            time.Now())
        // write asynchronously
        writeAPI.WritePoint(p)
    }
    // Force all unwritten data to be sent
    writeAPI.Flush()
    // Ensures background processes finishes
    client.Close()
}
```
### Handling of failed async writes
WriteAPI by default continues with retrying of failed writes.
Retried are automatically writes that fail on a connection failure or when server returns response HTTP status code >= 429.

Retrying algorithm uses random exponential strategy to set retry time.
The delay for the next retry attempt is a random value in the interval _retryInterval * exponentialBase^(attempts)_ and _retryInterval * exponentialBase^(attempts+1)_.
If writes of batch repeatedly fails, WriteAPI continues with retrying until _maxRetries_ is reached or the overall retry time of batch exceeds _maxRetryTime_.

The defaults parameters (part of the WriteOptions) are:
 - _retryInterval_=5,000ms
 - _exponentialBase_=2
 - _maxRetryDelay_=125,000ms
 - _maxRetries_=5
 - _maxRetryTime_=180,000ms

Retry delays are by default randomly distributed within the ranges:
 1. 5,000-10,000
 1. 10,000-20,000
 1. 20,000-40,000
 1. 40,000-80,000
 1. 80,000-125,000

Setting _retryInterval_ to 0 disables retry strategy and any failed write will discard the batch.

[WriteFailedCallback](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteFailedCallback) allows advanced controlling of retrying.
It is synchronously notified in case async write fails.
It controls further batch handling by its return value. If it returns `true`, WriteAPI continues with retrying of writes of this batch. Returned `false` means the batch should be discarded.

### Reading async errors
WriteAPI automatically logs write errors. Use [Errors()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteAPI.Errors) method, which returns the channel for reading errors occuring during async writes, for writing write error to a custom target:

```go
package main

import (
    "fmt"
    "math/rand"
    "time"

    "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
    // Create a new client using an InfluxDB server base URL and an authentication token
    client := influxdb2.NewClient("http://localhost:8086", "my-token")
    // Get non-blocking write client
    writeAPI := client.WriteAPI("my-org", "my-bucket")
    // Get errors channel
    errorsCh := writeAPI.Errors()
    // Create go proc for reading and logging errors
    go func() {
        for err := range errorsCh {
            fmt.Printf("write error: %s\n", err.Error())
        }
    }()
    // write some points
    for i := 0; i < 100; i++ {
        // create point
        p := influxdb2.NewPointWithMeasurement("stat").
            AddTag("id", fmt.Sprintf("rack_%v", i%10)).
            AddTag("vendor", "AWS").
            AddTag("hostname", fmt.Sprintf("host_%v", i%100)).
            AddField("temperature", rand.Float64()*80.0).
            AddField("disk_free", rand.Float64()*1000.0).
            AddField("disk_total", (i/10+1)*1000000).
            AddField("mem_total", (i/100+1)*10000000).
            AddField("mem_free", rand.Uint64()).
            SetTime(time.Now())
        // write asynchronously
        writeAPI.WritePoint(p)
    }
    // Force all unwritten data to be sent
    writeAPI.Flush()
    // Ensures background processes finishes
    client.Close()
}
```

### Blocking write client
Blocking write client writes given point(s) synchronously. It doesn't do implicit batching. Batch is created from given set of points.
Implicit batching can be enabled with `WriteAPIBlocking.EnableBatching()`.

```go
package main

import (
    "context"
    "fmt"
    "math/rand"
    "time"

    "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
    // Create a new client using an InfluxDB server base URL and an authentication token
    client := influxdb2.NewClient("http://localhost:8086", "my-token")
    // Get blocking write client
    writeAPI := client.WriteAPIBlocking("my-org","my-bucket")
    // write some points
    for i := 0; i <100; i++ {
        // create data point
        p := influxdb2.NewPoint(
            "system",
            map[string]string{
                "id":       fmt.Sprintf("rack_%v", i%10),
                "vendor":   "AWS",
                "hostname": fmt.Sprintf("host_%v", i%100),
            },
            map[string]interface{}{
                "temperature": rand.Float64() * 80.0,
                "disk_free":   rand.Float64() * 1000.0,
                "disk_total":  (i/10 + 1) * 1000000,
                "mem_total":   (i/100 + 1) * 10000000,
                "mem_free":    rand.Uint64(),
            },
            time.Now())
        // write synchronously
        err := writeAPI.WritePoint(context.Background(), p)
        if err != nil {
            panic(err)
        }
    }
    // Ensures background processes finishes
    client.Close()
}
```

### Queries
Query client offers retrieving of query results to a parsed representation in a [QueryTableResult](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#QueryTableResult) or to a raw string.

### QueryTableResult
QueryTableResult offers comfortable way how to deal with flux query CSV response. It parses CSV stream into FluxTableMetaData, FluxColumn and FluxRecord objects
for easy reading the result.

```go
package main

import (
    "context"
    "fmt"

    "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
    // Create a new client using an InfluxDB server base URL and an authentication token
    client := influxdb2.NewClient("http://localhost:8086", "my-token")
    // Get query client
    queryAPI := client.QueryAPI("my-org")
    // get QueryTableResult
    result, err := queryAPI.Query(context.Background(), `from(bucket:"my-bucket")|> range(start: -1h) |> filter(fn: (r) => r._measurement == "stat")`)
    if err == nil {
        // Iterate over query response
        for result.Next() {
            // Notice when group key has changed
            if result.TableChanged() {
                fmt.Printf("table: %s\n", result.TableMetadata().String())
            }
            // Access data
            fmt.Printf("value: %v\n", result.Record().Value())
        }
        // check for an error
        if result.Err() != nil {
            fmt.Printf("query parsing error: %s\n", result.Err().Error())
        }
    } else {
        panic(err)
    }
    // Ensures background processes finishes
    client.Close()
}
```

### Raw
[QueryRaw()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#QueryAPI.QueryRaw) returns raw, unparsed, query result string and process it on your own. Returned csv format
can be controlled by the third parameter, query dialect.

```go
package main

import (
    "context"
    "fmt"

    "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
    // Create a new client using an InfluxDB server base URL and an authentication token
    client := influxdb2.NewClient("http://localhost:8086", "my-token")
    // Get query client
    queryAPI := client.QueryAPI("my-org")
    // Query and get complete result as a string
    // Use default dialect
    result, err := queryAPI.QueryRaw(context.Background(), `from(bucket:"my-bucket")|> range(start: -1h) |> filter(fn: (r) => r._measurement == "stat")`, influxdb2.DefaultDialect())
    if err == nil {
        fmt.Println("QueryResult:")
        fmt.Println(result)
    } else {
        panic(err)
    }
    // Ensures background processes finishes
    client.Close()
}
```
### Parametrized Queries
InfluxDB Cloud supports [Parameterized Queries](https://docs.influxdata.com/influxdb/cloud/query-data/parameterized-queries/)
that let you dynamically change values in a query using the InfluxDB API. Parameterized queries make Flux queries more
reusable and can also be used to help prevent injection attacks.

InfluxDB Cloud inserts the params object into the Flux query as a Flux record named `params`. Use dot or bracket
notation to access parameters in the `params` record in your Flux query. Parameterized Flux queries support only `int`
, `float`, and `string` data types. To convert the supported data types into
other [Flux basic data types, use Flux type conversion functions](https://docs.influxdata.com/influxdb/cloud/query-data/parameterized-queries/#supported-parameter-data-types).

Query parameters can be passed as a struct or map. Param values can be only simple types or `time.Time`.
The name of the parameter represented by a struct field can be specified by JSON annotation.

Parameterized query example:
> :warning: Parameterized Queries are supported only in InfluxDB Cloud. There is no support in InfluxDB OSS currently.
```go
package main

import (
	"context"
	"fmt"

	"github.com/influxdata/influxdb-client-go/v2"
)

func main() {
	// Create a new client using an InfluxDB server base URL and an authentication token
	client := influxdb2.NewClient("http://localhost:8086", "my-token")
	// Get query client
	queryAPI := client.QueryAPI("my-org")
	// Define parameters
	parameters := struct {
		Start string  `json:"start"`
		Field string  `json:"field"`
		Value float64 `json:"value"`
	}{
		"-1h",
		"temperature",
		25,
	}
	// Query with parameters
	query := `from(bucket:"my-bucket")
				|> range(start: duration(params.start))
				|> filter(fn: (r) => r._measurement == "stat")
				|> filter(fn: (r) => r._field == params.field)
				|> filter(fn: (r) => r._value > params.value)`

	// Get result
	result, err := queryAPI.QueryWithParams(context.Background(), query, parameters)
	if err == nil {
		// Iterate over query response
		for result.Next() {
			// Notice when group key has changed
			if result.TableChanged() {
				fmt.Printf("table: %s\n", result.TableMetadata().String())
			}
			// Access data
			fmt.Printf("value: %v\n", result.Record().Value())
		}
		// check for an error
		if result.Err() != nil {
			fmt.Printf("query parsing error: %s\n", result.Err().Error())
		}
	} else {
		panic(err)
	}
	// Ensures background processes finishes
	client.Close()
}
```

### Concurrency
InfluxDB Go Client can be used in a concurrent environment. All its functions are thread-safe.

The best practise is to use a single `Client` instance per server URL. This ensures optimized resources usage,
most importantly reusing HTTP connections.

For efficient reuse of HTTP resources among multiple clients, create an HTTP client and use `Options.SetHTTPClient()` for setting it to all clients:
```go
    // Create HTTP client
    httpClient := &http.Client{
        Timeout: time.Second * time.Duration(60),
        Transport: &http.Transport{
            DialContext: (&net.Dialer{
                Timeout: 5 * time.Second,
            }).DialContext,
            TLSHandshakeTimeout: 5 * time.Second,
            TLSClientConfig: &tls.Config{
                InsecureSkipVerify: true,
            },
            MaxIdleConns:        100,
            MaxIdleConnsPerHost: 100,
            IdleConnTimeout:     90 * time.Second,
        },
    }
    // Client for server 1
    client1 := influxdb2.NewClientWithOptions("https://server:8086", "my-token", influxdb2.DefaultOptions().SetHTTPClient(httpClient))
    // Client for server 2
    client2 := influxdb2.NewClientWithOptions("https://server:9999", "my-token2", influxdb2.DefaultOptions().SetHTTPClient(httpClient))
```

Client ensures that there is a single instance of each server API sub-client for the specific area. E.g. a single `WriteAPI` instance for each org/bucket pair,
a single `QueryAPI` for each org.

Such a single API sub-client instance can be used concurrently:
```go
package main

import (
	"math/rand"
	"sync"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
)

func main() {
    // Create client
    client := influxdb2.NewClient("http://localhost:8086", "my-token")
    // Ensure closing the client
    defer client.Close()

    // Get write client
    writeApi := client.WriteAPI("my-org", "my-bucket")

    // Create channel for points feeding
    pointsCh := make(chan *write.Point, 200)

    threads := 5

    var wg sync.WaitGroup
    go func(points int) {
        for i := 0; i < points; i++ {
            p := influxdb2.NewPoint("meas",
                map[string]string{"tag": "tagvalue"},
                map[string]interface{}{"val1": rand.Int63n(1000), "val2": rand.Float64()*100.0 - 50.0},
                time.Now())
            pointsCh <- p
        }
        close(pointsCh)
    }(1000000)

    // Launch write routines
    for t := 0; t < threads; t++ {
        wg.Add(1)
        go func() {
            for p := range pointsCh {
                writeApi.WritePoint(p)
            }
            wg.Done()
        }()
    }
    // Wait for writes complete
    wg.Wait()
}
```

### Proxy and redirects
You can configure InfluxDB Go client behind a proxy in two ways:
 1. Using environment variable
     Set environment variable `HTTP_PROXY` (or `HTTPS_PROXY` based on the scheme of your server url).
     e.g. (linux) `export HTTP_PROXY=http://my-proxy:8080` or in Go code `os.Setenv("HTTP_PROXY","http://my-proxy:8080")`

 1. Configure `http.Client` to use proxy<br>
     Create a custom `http.Client` with a proxy configuration:
    ```go
    proxyUrl, err := url.Parse("http://my-proxy:8080")
    httpClient := &http.Client{
        Transport: &http.Transport{
            Proxy: http.ProxyURL(proxyUrl)
        }
    }
    client := influxdb2.NewClientWithOptions("http://localhost:8086", token, influxdb2.DefaultOptions().SetHTTPClient(httpClient))
    ```

 Client automatically follows HTTP redirects. The default redirect policy is to follow up to 10 consecutive requests.
 Due to a security reason _Authorization_ header is not forwarded when redirect leads to a different domain.
 To overcome this limitation you have to set a custom redirect handler:
```go
token := "my-token"

httpClient := &http.Client{
    CheckRedirect: func(req *http.Request, via []*http.Request) error {
        req.Header.Add("Authorization","Token " + token)
        return nil
    },
}
client := influxdb2.NewClientWithOptions("http://localhost:8086", token, influxdb2.DefaultOptions().SetHTTPClient(httpClient))
```

### Checking Server State
There are three functions for checking whether a server is up and ready for communication:

| Function| Description | Availability |
|:----------|:----------|:----------|
| [Health()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2#Client.Health) | Detailed info about the server status, along with version string | OSS |
| [Ready()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2#Client.Ready) | Server uptime info | OSS |
| [Ping()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2#Client.Ping) | Whether a server is up | OSS, Cloud |

Only the [Ping()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2#Client.Ping) function works in InfluxDB Cloud server.

## InfluxDB 1.8 API compatibility

  [InfluxDB 1.8.0 introduced forward compatibility APIs](https://docs.influxdata.com/influxdb/latest/tools/api/#influxdb-2-0-api-compatibility-endpoints) for InfluxDB 2.0. This allow you to easily move from InfluxDB 1.x to InfluxDB 2.0 Cloud or open source.

  Client API usage differences summary:
 1. Use the form `username:password` for an **authentication token**. Example: `my-user:my-password`. Use an empty string (`""`) if the server doesn't require authentication.
 1. The organization parameter is not used. Use an empty string (`""`) where necessary.
 1. Use the form `database/retention-policy` where a **bucket** is required. Skip retention policy if the default retention policy should be used. Examples: `telegraf/autogen`, `telegraf`.  

  The following forward compatible APIs are available:

  | API | Endpoint | Description |
  |:----------|:----------|:----------|
  | [WriteAPI](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteAPI) (also [WriteAPIBlocking](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#WriteAPIBlocking))| [/api/v2/write](https://docs.influxdata.com/influxdb/v2.0/write-data/developer-tools/api/) | Write data to InfluxDB 1.8.0+ using the InfluxDB 2.0 API |
  | [QueryAPI](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2/api#QueryAPI) | [/api/v2/query](https://docs.influxdata.com/influxdb/v2.0/query-data/execute-queries/influx-api/) | Query data in InfluxDB 1.8.0+ using the InfluxDB 2.0 API and [Flux](https://docs.influxdata.com/flux/latest/) endpoint should be enabled by the [`flux-enabled` option](https://docs.influxdata.com/influxdb/v1.8/administration/config/#flux-enabled-false)
  | [Health()](https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2#Client.Health) | [/health](https://docs.influxdata.com/influxdb/v2.0/api/#tag/Health) | Check the health of your InfluxDB instance |


### Example
```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/influxdata/influxdb-client-go/v2"
)

func main() {
    userName := "my-user"
    password := "my-password"
     // Create a new client using an InfluxDB server base URL and an authentication token
    // For authentication token supply a string in the form: "username:password" as a token. Set empty value for an unauthenticated server
    client := influxdb2.NewClient("http://localhost:8086", fmt.Sprintf("%s:%s",userName, password))
    // Get the blocking write client
    // Supply a string in the form database/retention-policy as a bucket. Skip retention policy for the default one, use just a database name (without the slash character)
    // Org name is not used
    writeAPI := client.WriteAPIBlocking("", "test/autogen")
    // create point using full params constructor
    p := influxdb2.NewPoint("stat",
        map[string]string{"unit": "temperature"},
        map[string]interface{}{"avg": 24.5, "max": 45},
        time.Now())
    // Write data
    err := writeAPI.WritePoint(context.Background(), p)
    if err != nil {
        fmt.Printf("Write error: %s\n", err.Error())
    }

    // Get query client. Org name is not used
    queryAPI := client.QueryAPI("")
    // Supply string in a form database/retention-policy as a bucket. Skip retention policy for the default one, use just a database name (without the slash character)
    result, err := queryAPI.Query(context.Background(), `from(bucket:"test")|> range(start: -1h) |> filter(fn: (r) => r._measurement == "stat")`)
    if err == nil {
        for result.Next() {
            if result.TableChanged() {
                fmt.Printf("table: %s\n", result.TableMetadata().String())
            }
            fmt.Printf("row: %s\n", result.Record().String())
        }
        if result.Err() != nil {
            fmt.Printf("Query error: %s\n", result.Err().Error())
        }
    } else {
        fmt.Printf("Query error: %s\n", err.Error())
    }
    // Close client
    client.Close()
}
```

## Contributing

If you would like to contribute code you can do through GitHub by forking the repository and sending a pull request into the `master` branch.

## License

The InfluxDB 2 Go Client is released under the [MIT License](https://opensource.org/licenses/MIT).
