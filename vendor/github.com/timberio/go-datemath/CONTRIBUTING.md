# Contributing

Bug fixes and other contributions via pull request greatly welcomed!

This library relies on [goyacc](https://godoc.org/golang.org/x/tools/cmd/goyacc) and
[golex](https://godoc.org/modernc.org/golex) for parsing and evaluating datemath grammar.

To install, run:

* `go get golang.org/x/tools/cmd/goyacc modernc.org/golex`

After modifying either the `datemath.l` or `datemath.y` you can rerun `go generate`.

When in doubt on semantics of the library, [Elasticsearch's
implementation](https://www.elastic.co/guide/en/elasticsearch/reference/7.3/common-options.html#date-math) should be
considered the canonical specification.
