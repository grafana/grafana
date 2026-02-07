# GoProxy

![Status](https://github.com/elazarl/goproxy/workflows/Go/badge.svg)
[![GoDoc](https://pkg.go.dev/badge/github.com/elazarl/goproxy)](https://pkg.go.dev/github.com/elazarl/goproxy)
[![Go Report](https://goreportcard.com/badge/github.com/elazarl/goproxy)](https://goreportcard.com/report/github.com/elazarl/goproxy)
[![BSD-3 License](https://img.shields.io/badge/License-BSD%203--Clause-orange.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Pull Requests](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://makeapullrequest.com)
[![Awesome Go](https://awesome.re/mentioned-badge.svg)](https://github.com/avelino/awesome-go?tab=readme-ov-file#networking)

GoProxy is a library to create a `customized` HTTP/HTTPS `proxy server` using
Go (aka Golang), with several configurable settings available.
The target of this project is to offer an `optimized` proxy server, usable with
reasonable amount of traffic, yet `customizable` and `programmable`.

The proxy itself is simply a `net/http` handler, so you can add multiple
middlewares (panic recover, logging, compression, etc.) over it. It can be
easily integrated with any other HTTP network library.

In order to use goproxy, one should set their browser (or any other client)
to use goproxy as an HTTP proxy.
Here is how you do that in [Chrome](https://www.wikihow.com/Connect-to-a-Proxy-Server)
and in [Firefox](http://www.wikihow.com/Enter-Proxy-Settings-in-Firefox).
If you decide to start with the `base` example, the URL you should use as
proxy is `localhost:8080`, which is the default one in our example.
You also have to [trust](https://github.com/elazarl/goproxy/blob/master/examples/customca/README.md)
the proxy CA certificate, to avoid any certificate issue in the clients.

> [✈️ Telegram Group](https://telegram.me/goproxygroup)

## Features
- Perform certain actions only on `specific hosts`,  with a single equality comparison or with regex evaluation
- Manipulate `requests` and `responses` before sending them to the browser
- Use a `custom http.Transport` to perform requests to the target server
- You can specify a `MITM certificates cache`, to reuse them later for other requests to the same host, thus saving CPU. Not enabled by default, but you should use it in production!
- Redirect normal HTTP traffic to a `custom handler`, when the target is a `relative path` (e.g. `/ping`)
- You can choose the logger to use, by implementing the `Logger` interface
- You can `disable` the HTTP request headers `canonicalization`, by setting `PreventCanonicalization` to true

## Proxy modes
1. Regular HTTP proxy
2. HTTPS through CONNECT
3. HTTPS MITM ("Man in the Middle") proxy server, in which the server generate TLS certificates to parse request/response data and perform actions on them
4. "Hijacked" proxy connection, where the configured handler can access the raw net.Conn data

## Sponsors
Does your company use GoProxy? Ask your manager or marketing team
if your company would be interested in supporting our project.
Supporting this project will allow the maintainers to dedicate more time
for maintenance and new features for everyone.
This will also benefit you, because maintainers will fix problems that will occur
and keep GoProxy up to date for your projects.
Moreover, your company logo will be shown on GitHub, in this README section.
> [Apply Here](https://opencollective.com/goproxy)

[![GoProxy Sponsor](https://opencollective.com/goproxy/tiers/sponsor/0/avatar)](https://opencollective.com/goproxy/tiers/sponsor/0/website)
[![GoProxy Sponsor](https://opencollective.com/goproxy/tiers/sponsor/1/avatar)](https://opencollective.com/goproxy/tiers/sponsor/1/website)
[![GoProxy Sponsor](https://opencollective.com/goproxy/tiers/sponsor/2/avatar)](https://opencollective.com/goproxy/tiers/sponsor/2/website)
[![GoProxy Sponsor](https://opencollective.com/goproxy/tiers/sponsor/3/avatar)](https://opencollective.com/goproxy/tiers/sponsor/3/website)

## Maintainers
- [Elazar Leibovich](https://github.com/elazarl): Creator of the project, Software Engineer
- [Erik Pellizzon](https://github.com/ErikPelli): Maintainer, Freelancer (open to collaborations!)

If you need to integrate GoProxy into your project, or you need some custom
features to maintain in your fork, you can contact [Erik](mailto:erikpelli@tutamail.com)
(the current maintainer) by email, and you can discuss together how he
can help you as a paid independent consultant.

## Contributions
If you have any trouble, suggestion, or if you find a bug, feel free to reach
out by opening a GitHub `issue`.
This is an `open source` project managed by volunteers, and we're happy
to discuss anything that can improve it.

Make sure to explain everything, including the reason behind the issue
and what you want to change, to make the problem easier to understand.
You can also directly open a `Pull Request`, if it's a small code change, but
you need to explain in the description everything.
If you open a pull request named `refactoring` with `5,000` lines changed,
we won't merge it... `:D`

The code for this project is released under the `BSD 3-Clause` license,
making it useful for `commercial` uses as well.

### Submit your case study
So, you have introduced & integrated GoProxy into one of your personal projects
or a project inside the company you work for.

We're happy to learn about new `creative solutions` made with this library,
so feel free to `contact` the maintainer listed above via e-mail, to explaining
why you found this project useful for your needs.

If you have signed a `Non Disclosure Agreement` with the company, you
can propose them to write a `blog post` on their official website about
this topic, so this information will be public by their choice, and you can
`share the link` of the blog post with us :)

The purpose of case studies is to share with the `community` why all the
`contributors` to this project are `improving` the world with their help and
what people are building using it.

### Linter
The codebase uses an automatic lint check over your Pull Request code.
Before opening it, you should check if your changes respect it, by running
the linter in your local machine, so you won't have any surprise.

To install the linter:
```sh
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

This will create an executable in your `$GOPATH/bin` folder
(`$GOPATH` is an environment variable, usually
its value is equivalent to `~/go`, check its value in your machine if you
aren't sure about it).
Make sure to include the bin folder in the path of your shell, to be able to
directly use the `golangci-lint run` command.

## A taste of GoProxy

To get a taste of `goproxy`, here you are a basic HTTP/HTTPS proxy
that just forward data to the destination:

```go
package main

import (
    "log"
    "net/http"

    "github.com/elazarl/goproxy"
)

func main() {
    proxy := goproxy.NewProxyHttpServer()
    proxy.Verbose = true
    log.Fatal(http.ListenAndServe(":8080", proxy))
}
```

### Request handler
This line will add `X-GoProxy: yxorPoG-X` header to all requests sent through the proxy,
before sending them to the destination:

```go
proxy.OnRequest().DoFunc(
    func(r *http.Request,ctx *goproxy.ProxyCtx)(*http.Request,*http.Response) {
        r.Header.Set("X-GoProxy","yxorPoG-X")
        return r,nil
    })
```

When the `OnRequest()` input is empty, the function specified in `DoFunc`
will process all incoming requests to the proxy. In this case, it will add
a header to the request and return it to the caller.
The proxy will send the modified request to the destination.
You can also use `Do` instead of `DoFunc`, if you implement the specified
interface in your type.

> ⚠️ Note we returned a nil value as the response.
> If the returned response is not nil, goproxy will discard the request
> and send the specified response to the client.

### Conditional Request handler
Refuse connections to www.reddit.com between 8 and 17 in the server
local timezone:

```go
proxy.OnRequest(goproxy.DstHostIs("www.reddit.com")).DoFunc(
    func(req *http.Request,ctx *goproxy.ProxyCtx)(*http.Request,*http.Response) {
        if h,_,_ := time.Now().Clock(); h >= 8 && h <= 17 {
			resp := goproxy.NewResponse(r, goproxy.ContentTypeText, http.StatusForbidden, "Don't waste your time!")
            return req, resp
        }
        return req,nil
})
```

`DstHostIs` returns a `ReqCondition`, which is a function receiving a `*http.Request`
and returning a boolean that checks if the request satisfies the condition (and that will be processed).
`DstHostIs("www.reddit.com")` will return a `ReqCondition` that returns true
when the request is directed to "www.reddit.com".
The host equality check is `case-insensitive`, to reflect the behaviour of DNS
resolvers, so even if the user types "www.rEdDit.com", the comparison will
satisfy the condition.
When the hour is between 8:00am and 5:59pm, we directly return
a response in `DoFunc()`, so the remote destination will not receive the
request and the client will receive the `"Don't waste your time!"` response.

### Let's start
```go
import "github.com/elazarl/goproxy"
```

There are some proxy usage examples in the `examples` folder, which
cover the most common cases. Take a look at them and good luck!

## Request & Response manipulation

There are 3  different types of handlers to manipulate the behavior of the proxy, as follows:

```go
// handler called after receiving HTTP CONNECT from the client, and
// before proxy establishes connection with the destination host
httpsHandlers   []HttpsHandler

// handler called before proxy sends HTTP request to destination host
reqHandlers     []ReqHandler 

// handler called after proxy receives HTTP Response from destination host,
// and before proxy forwards the Response to the client
respHandlers    []RespHandler 
```

Depending on what you want to manipulate, the ways to add handlers to each of the previous lists are:

```go
// Add handlers to httpsHandlers 
proxy.OnRequest(some ReqConditions).HandleConnect(YourHandlerFunc())

// Add handlers to reqHandlers
proxy.OnRequest(some ReqConditions).Do(YourReqHandlerFunc())

// Add handlers to respHandlers
proxy.OnResponse(some RespConditions).Do(YourRespHandlerFunc())
```

Example:

```go
// This rejects the HTTPS request to *.reddit.com during HTTP CONNECT phase.
// Reddit URL check is case-insensitive because of (?i), so the block will work also if the user types something like rEdDit.com.
proxy.OnRequest(goproxy.ReqHostMatches(regexp.MustCompile("(?i)reddit.*:443$"))).HandleConnect(goproxy.AlwaysReject)

// Be careful about this example! It shows you a common error that you
// need to avoid.
// This will NOT reject the HTTPS request with URL ending with .gif because,
// if the scheme is HTTPS, the proxy will receive only URL.Hostname
// and URL.Port during the HTTP CONNECT phase.
proxy.OnRequest(goproxy.UrlMatches(regexp.MustCompile(`.*gif$`))).HandleConnect(goproxy.AlwaysReject)

// To fix the previous example, here there is the correct way to manipulate
// an HTTP request using URL.Path (target path) as a condition.
proxy.OnRequest(goproxy.UrlMatches(regexp.MustCompile(`.*gif$`))).Do(YourReqHandlerFunc())
```

## Error handling
### Generic error
If an error occurs while handling a request through the proxy, by default
the proxy returns HTTP error `500` (Internal Server Error) with the `error
message` as the `body` content.

If you want to override this behaviour, you can define your own
`RespHandler` that changes the error response.
Among the context parameters, `ctx.Error` contains the `error` occurred,
if any, or the `nil` value, if no error happened.

You can handle it as you wish, including returning a custom JSON as the body.
Example of an error handler:
```
proxy.OnResponse().DoFunc(func(resp *http.Response, ctx *goproxy.ProxyCtx) *http.Response {
	var dnsError *net.DNSError
	if errors.As(ctx.Error, &dnsError) {
		// Do not leak our DNS server's address
		dnsError.Server = "<server-redacted>"
		return goproxy.NewResponse(ctx.Req, goproxy.ContentTypeText, http.StatusBadGateway, dnsError.Error())
	}
	return resp
})
```

### Connection error
If an error occurs while sending data to the target remote server (or to
the proxy client), the `proxy.ConnectionErrHandler` is called to handle the
error, if present, else a `default handler` will be used.
The error is passed as `function parameter` and not inside the proxy context,
so you don't have to check the ctx.Error field in this handler.

In this handler you have access to the raw connection with the proxy
client (as an `io.Writer`), so you could send any HTTP data over it,
if needed, containing the error data.
There is no guarantee that the connection hasn't already been closed, so
the `Write()` could return an error.

The `connection` will be `automatically closed` by the proxy library after the
error handler call, so you don't have to worry about it.

## Project Status
This project has been created `10 years` ago, and has reached a stage of
`maturity`. It can be safely used in `production`, and many projects
already do that.

If there will be any `breaking change` in the future, a `new version` of the
Go module will be released (e.g. v2).

## Trusted, as a direct dependency, by:
<p align="left">
<a href="https://github.com/stripe/goproxy" target="_blank" rel="noreferrer"> <img src="https://avatars.githubusercontent.com/u/856813?s=50" alt="Stripe" title="Stripe" /> </a>
<a href="https://github.com/dependabot/goproxy" target="_blank" rel="noreferrer"> <img src="https://avatars.githubusercontent.com/u/27347476?s=50" alt="Dependabot" title="Dependabot" /> </a>
<a href="https://github.com/go-git/go-git" target="_blank" rel="noreferrer"> <img src="https://avatars.githubusercontent.com/u/57653224?s=50" alt="Go Git" title="Go Git" /> </a>
<a href="https://github.com/google/oss-rebuild" target="_blank" rel="noreferrer"> <img src="https://avatars.githubusercontent.com/u/1342004?s=50" alt="Google" title="Google" /> </a>
<a href="https://github.com/grafana/grafana-plugin-sdk-go" target="_blank" rel="noreferrer"> <img src="https://avatars.githubusercontent.com/u/7195757?s=50" alt="Grafana" title="Grafana" /> </a>
<a href="https://github.com/superfly/tokenizer" target="_blank" rel="noreferrer"> <img src="https://avatars.githubusercontent.com/u/22525303?s=50" alt="Fly.io" title="Fly.io" /> </a>
<a href="https://github.com/kubernetes/minikube" target="_blank" rel="noreferrer"> <img src="https://avatars.githubusercontent.com/u/13629408?s=50" alt="Kubernetes / Minikube" title="Kubernetes / Minikube" /> </a>
<a href="https://github.com/newrelic/newrelic-client-go" target="_blank" rel="noreferrer"> <img src="https://avatars.githubusercontent.com/u/31739?s=50" alt="New Relic" title="New Relic" /> </a>
</p>
