# Go CORS handler [![godoc](http://img.shields.io/badge/godoc-reference-blue.svg?style=flat)](https://godoc.org/github.com/rs/cors) [![license](http://img.shields.io/badge/license-MIT-red.svg?style=flat)](https://raw.githubusercontent.com/rs/cors/master/LICENSE) [![Go Coverage](https://github.com/rs/cors/wiki/coverage.svg)](https://raw.githack.com/wiki/rs/cors/coverage.html)

CORS is a `net/http` handler implementing [Cross Origin Resource Sharing W3 specification](http://www.w3.org/TR/cors/) in Golang.

## Getting Started

After installing Go and setting up your [GOPATH](http://golang.org/doc/code.html#GOPATH), create your first `.go` file. We'll call it `server.go`.

```go
package main

import (
    "net/http"

    "github.com/rs/cors"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte("{\"hello\": \"world\"}"))
    })

    // cors.Default() setup the middleware with default options being
    // all origins accepted with simple methods (GET, POST). See
    // documentation below for more options.
    handler := cors.Default().Handler(mux)
    http.ListenAndServe(":8080", handler)
}
```

Install `cors`:

    go get github.com/rs/cors

Then run your server:

    go run server.go

The server now runs on `localhost:8080`:

    $ curl -D - -H 'Origin: http://foo.com' http://localhost:8080/
    HTTP/1.1 200 OK
    Access-Control-Allow-Origin: foo.com
    Content-Type: application/json
    Date: Sat, 25 Oct 2014 03:43:57 GMT
    Content-Length: 18

    {"hello": "world"}

### Allow * With Credentials Security Protection

This library has been modified to avoid a well known security issue when configured with `AllowedOrigins` to `*` and `AllowCredentials` to `true`. Such setup used to make the library reflects the request `Origin` header value, working around a security protection embedded into the standard that makes clients to refuse such configuration. This behavior has been removed with [#55](https://github.com/rs/cors/issues/55) and [#57](https://github.com/rs/cors/issues/57).

If you depend on this behavior and understand the implications, you can restore it using the `AllowOriginFunc` with `func(origin string) {return true}`.

Please refer to [#55](https://github.com/rs/cors/issues/55) for more information about the security implications.

### More Examples

* `net/http`: [examples/nethttp/server.go](https://github.com/rs/cors/blob/master/examples/nethttp/server.go)
* [Goji](https://goji.io): [examples/goji/server.go](https://github.com/rs/cors/blob/master/examples/goji/server.go)
* [Martini](http://martini.codegangsta.io): [examples/martini/server.go](https://github.com/rs/cors/blob/master/examples/martini/server.go)
* [Negroni](https://github.com/codegangsta/negroni): [examples/negroni/server.go](https://github.com/rs/cors/blob/master/examples/negroni/server.go)
* [Alice](https://github.com/justinas/alice): [examples/alice/server.go](https://github.com/rs/cors/blob/master/examples/alice/server.go)
* [HttpRouter](https://github.com/julienschmidt/httprouter): [examples/httprouter/server.go](https://github.com/rs/cors/blob/master/examples/httprouter/server.go)
* [Gorilla](http://www.gorillatoolkit.org/pkg/mux): [examples/gorilla/server.go](https://github.com/rs/cors/blob/master/examples/gorilla/server.go)
* [Buffalo](https://gobuffalo.io): [examples/buffalo/server.go](https://github.com/rs/cors/blob/master/examples/buffalo/server.go)
* [Gin](https://gin-gonic.github.io/gin): [examples/gin/server.go](https://github.com/rs/cors/blob/master/examples/gin/server.go)
* [Chi](https://github.com/go-chi/chi): [examples/chi/server.go](https://github.com/rs/cors/blob/master/examples/chi/server.go)

## Parameters

Parameters are passed to the middleware thru the `cors.New` method as follow:

```go
c := cors.New(cors.Options{
    AllowedOrigins: []string{"http://foo.com", "http://foo.com:8080"},
    AllowCredentials: true,
    // Enable Debugging for testing, consider disabling in production
    Debug: true,
})

// Insert the middleware
handler = c.Handler(handler)
```

* **AllowedOrigins** `[]string`: A list of origins a cross-domain request can be executed from. If the special `*` value is present in the list, all origins will be allowed. An origin may contain a wildcard (`*`) to replace 0 or more characters (i.e.: `http://*.domain.com`). Usage of wildcards implies a small performance penality. Only one wildcard can be used per origin. The default value is `*`.
* **AllowOriginFunc** `func (origin string) bool`: A custom function to validate the origin. It takes the origin as an argument and returns true if allowed, or false otherwise. If this option is set, the content of `AllowedOrigins` is ignored.
* **AllowOriginRequestFunc** `func (r *http.Request, origin string) bool`: A custom function to validate the origin. It takes the HTTP Request object and the origin as argument and returns true if allowed or false otherwise. If this option is set, the contents of `AllowedOrigins` and `AllowOriginFunc` are ignored.
Deprecated: use `AllowOriginVaryRequestFunc` instead.
* **AllowOriginVaryRequestFunc** `func(r *http.Request, origin string) (bool, []string)`: A custom function to validate the origin. It takes the HTTP Request object and the origin as argument and returns true if allowed or false otherwise with a list of headers used to take that decision if any so they can be added to the Vary header. If this option is set, the contents of `AllowedOrigins`, `AllowOriginFunc` and `AllowOriginRequestFunc` are ignored.
* **AllowedMethods** `[]string`: A list of methods the client is allowed to use with cross-domain requests. Default value is simple methods (`GET` and `POST`).
* **AllowedHeaders** `[]string`: A list of non simple headers the client is allowed to use with cross-domain requests.
* **ExposedHeaders** `[]string`: Indicates which headers are safe to expose to the API of a CORS API specification.
* **AllowCredentials** `bool`: Indicates whether the request can include user credentials like cookies, HTTP authentication or client side SSL certificates. The default is `false`.
* **AllowPrivateNetwork** `bool`: Indicates whether to accept cross-origin requests over a private network.
* **MaxAge** `int`: Indicates how long (in seconds) the results of a preflight request can be cached. The default is `0` which stands for no max age.
* **OptionsPassthrough** `bool`: Instructs preflight to let other potential next handlers to process the `OPTIONS` method. Turn this on if your application handles `OPTIONS`.
* **OptionsSuccessStatus** `int`: Provides a status code to use for successful OPTIONS requests. Default value is `http.StatusNoContent` (`204`).
* **Debug** `bool`: Debugging flag adds additional output to debug server side CORS issues.

See [API documentation](http://godoc.org/github.com/rs/cors) for more info.

## Benchmarks

```
goos: darwin
goarch: arm64
pkg: github.com/rs/cors
BenchmarkWithout-10            	135325480	         8.124 ns/op	       0 B/op	       0 allocs/op
BenchmarkDefault-10            	24082140	        51.40 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllowedOrigin-10      	16424518	        88.25 ns/op	       0 B/op	       0 allocs/op
BenchmarkPreflight-10          	 8010259	       147.3 ns/op	       0 B/op	       0 allocs/op
BenchmarkPreflightHeader-10    	 6850962	       175.0 ns/op	       0 B/op	       0 allocs/op
BenchmarkWildcard/match-10     	253275342	         4.714 ns/op	       0 B/op	       0 allocs/op
BenchmarkWildcard/too_short-10 	1000000000	         0.6235 ns/op	       0 B/op	       0 allocs/op
PASS
ok  	github.com/rs/cors	99.131s
```

## Licenses

All source code is licensed under the [MIT License](https://raw.github.com/rs/cors/master/LICENSE).
