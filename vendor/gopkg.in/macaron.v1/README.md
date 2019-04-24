Macaron [![Build Status](https://travis-ci.org/go-macaron/macaron.svg?branch=v1)](https://travis-ci.org/go-macaron/macaron)
=======================

![Macaron Logo](https://raw.githubusercontent.com/go-macaron/macaron/v1/macaronlogo.png)

Package macaron is a high productive and modular web framework in Go.

## Getting Started

The minimum requirement of Go is **1.6**.

To install Macaron:

	go get gopkg.in/macaron.v1

The very basic usage of Macaron:

```go
package main

import "gopkg.in/macaron.v1"

func main() {
	m := macaron.Classic()
	m.Get("/", func() string {
		return "Hello world!"
	})
	m.Run()
}
```

## Features

- Powerful routing with suburl.
- Flexible routes combinations.
- Unlimited nested group routers.
- Directly integrate with existing services.
- Dynamically change template files at runtime.
- Allow to use in-memory template and static files.
- Easy to plugin/unplugin features with modular design.
- Handy dependency injection powered by [inject](https://github.com/codegangsta/inject).
- Better router layer and less reflection make faster speed.

## Middlewares

Middlewares allow you easily plugin/unplugin features for your Macaron applications.

There are already many [middlewares](https://github.com/go-macaron) to simplify your work:

- render - Go template engine
- static - Serves static files
- [gzip](https://github.com/go-macaron/gzip) - Gzip compression to all responses
- [binding](https://github.com/go-macaron/binding) - Request data binding and validation
- [i18n](https://github.com/go-macaron/i18n) - Internationalization and Localization
- [cache](https://github.com/go-macaron/cache) - Cache manager
- [session](https://github.com/go-macaron/session) - Session manager
- [csrf](https://github.com/go-macaron/csrf) - Generates and validates csrf tokens
- [captcha](https://github.com/go-macaron/captcha) - Captcha service
- [pongo2](https://github.com/go-macaron/pongo2) - Pongo2 template engine support
- [sockets](https://github.com/go-macaron/sockets) - WebSockets channels binding
- [bindata](https://github.com/go-macaron/bindata) - Embed binary data as static and template files
- [toolbox](https://github.com/go-macaron/toolbox) - Health check, pprof, profile and statistic services
- [oauth2](https://github.com/go-macaron/oauth2) - OAuth 2.0 backend
- [authz](https://github.com/go-macaron/authz) - ACL/RBAC/ABAC authorization based on Casbin
- [switcher](https://github.com/go-macaron/switcher) - Multiple-site support
- [method](https://github.com/go-macaron/method) - HTTP method override
- [permissions2](https://github.com/xyproto/permissions2) - Cookies, users and permissions
- [renders](https://github.com/go-macaron/renders) - Beego-like render engine(Macaron has built-in template engine, this is another option)
- [piwik](https://github.com/veecue/piwik-middleware) - Server-side piwik analytics

## Use Cases

- [Gogs](https://gogs.io): A painless self-hosted Git Service
- [Grafana](http://grafana.org/): The open platform for beautiful analytics and monitoring
- [Peach](https://peachdocs.org): A modern web documentation server
- [Go Walker](https://gowalker.org): Go online API documentation
- [Switch](https://gopm.io): Gopm registry
- [Critical Stack Intel](https://intel.criticalstack.com/): A 100% free intel marketplace from Critical Stack, Inc.

## Getting Help

- [API Reference](https://gowalker.org/gopkg.in/macaron.v1)
- [Documentation](https://go-macaron.com)
- [FAQs](https://go-macaron.com/docs/faqs)

## Credits

- Basic design of [Martini](https://github.com/go-martini/martini).
- Logo is modified by [@insionng](https://github.com/insionng) based on [Tribal Dragon](http://xtremeyamazaki.deviantart.com/art/Tribal-Dragon-27005087).

## License

This project is under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for the full license text.
