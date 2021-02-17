# session

[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/go-macaron/session/Go?logo=github&style=for-the-badge)](https://github.com/go-macaron/session/actions?query=workflow%3AGo)
[![codecov](https://img.shields.io/codecov/c/github/go-macaron/session/master?logo=codecov&style=for-the-badge)](https://codecov.io/gh/go-macaron/session)
[![GoDoc](https://img.shields.io/badge/GoDoc-Reference-blue?style=for-the-badge&logo=go)](https://pkg.go.dev/github.com/go-macaron/session?tab=doc)
[![Sourcegraph](https://img.shields.io/badge/view%20on-Sourcegraph-brightgreen.svg?style=for-the-badge&logo=sourcegraph)](https://sourcegraph.com/github.com/go-macaron/session)

Middleware session provides session management for [Macaron](https://github.com/go-macaron/macaron). It can use many session providers, including memory, file, Redis, Memcache, PostgreSQL, MySQL, Couchbase, Ledis and Nodb.

### Installation

The minimum requirement of Go is 1.6 (*1.13 if using Redis, 1.10 if using MySQL*).

	go get github.com/go-macaron/session
	
## Getting Help

- [API Reference](https://gowalker.org/github.com/go-macaron/session)
- [Documentation](https://go-macaron.com/middlewares/session)

## Credits

This package is a modified version of [beego/session](https://github.com/astaxie/beego/tree/master/session).

## License

This project is under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for the full license text.
