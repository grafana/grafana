# Bleve Index API

[![PkgGoDev](https://pkg.go.dev/badge/github.com/blevesearch/bleve_index_api)](https://pkg.go.dev/github.com/blevesearch/bleve_index_api)
[![Tests](https://github.com/blevesearch/bleve_index_api/workflows/Tests/badge.svg?branch=master&event=push)](https://github.com/blevesearch/bleve_index_api/actions?query=workflow%3ATests+event%3Apush+branch%3Amaster)
[![Lint](https://github.com/blevesearch/bleve_index_api/workflows/Lint/badge.svg?branch=master&event=push)](https://github.com/blevesearch/bleve_index_api/actions?query=workflow%3ALint+event%3Apush+branch%3Amaster)

Bleve supports a pluggable Index interface.

By placing these interfaces in their own, *hopefully* slowly evolving module, it frees up Bleve and the underlying index to each introduce new major versions without interfering with one another.

With that in mind, we anticipate introducing non-breaking changes only to this module, and keeping the major version at 1.x for some time.