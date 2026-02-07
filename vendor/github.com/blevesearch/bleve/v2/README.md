# ![bleve](docs/bleve.png) bleve

[![Tests](https://github.com/blevesearch/bleve/actions/workflows/tests.yml/badge.svg?branch=master&event=push)](https://github.com/blevesearch/bleve/actions/workflows/tests.yml?query=event%3Apush+branch%3Amaster)
[![Coverage Status](https://coveralls.io/repos/github/blevesearch/bleve/badge.svg)](https://coveralls.io/github/blevesearch/bleve)
[![Go Reference](https://pkg.go.dev/badge/github.com/blevesearch/bleve/v2.svg)](https://pkg.go.dev/github.com/blevesearch/bleve/v2)
[![Join the chat](https://badges.gitter.im/join_chat.svg)](https://app.gitter.im/#/room/#blevesearch_bleve:gitter.im)
[![Go Report Card](https://goreportcard.com/badge/github.com/blevesearch/bleve/v2)](https://goreportcard.com/report/github.com/blevesearch/bleve/v2)
[![Sourcegraph](https://sourcegraph.com/github.com/blevesearch/bleve/-/badge.svg)](https://sourcegraph.com/github.com/blevesearch/bleve?badge)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A modern indexing + search library in GO

## Features

* Index any GO data structure or JSON
* Intelligent defaults backed up by powerful configuration ([scorch](https://github.com/blevesearch/bleve/blob/master/index/scorch/README.md))
* Supported field types:
  * `text`, `number`, `datetime`, `boolean`, `geopoint`, `geoshape`, `IP`, `vector`
* Supported query types:
  * `term`, `phrase`, `match`, `match_phrase`, `prefix`, `regexp`, `wildcard`, `fuzzy`
  * term range, numeric range, date range, boolean field
  * compound queries: `conjuncts`, `disjuncts`, boolean (`must`/`should`/`must_not`)
  * [query string syntax](http://www.blevesearch.com/docs/Query-String-Query/)
  * [geo spatial search](https://github.com/blevesearch/bleve/blob/master/geo/README.md)
  * approximate k-nearest neighbors via [vector search](https://github.com/blevesearch/bleve/blob/master/docs/vectors.md)
  * [synonym search](https://github.com/blevesearch/bleve/blob/master/docs/synonyms.md)
* [tf-idf](https://github.com/blevesearch/bleve/blob/master/docs/scoring.md#tf-idf) / [bm25](https://github.com/blevesearch/bleve/blob/master/docs/scoring.md#bm25) scoring models
* Hybrid search: exact + semantic
  * Supports [RRF (Reciprocal Rank Fusion) and RSF (Relative Score Fusion)](docs/score_fusion.md)
* [Result pagination](https://github.com/blevesearch/bleve/blob/master/docs/pagination.md)
* Query time boosting
* Search result match highlighting with document fragments
* Aggregations/faceting support:
  * terms facet
  * numeric range facet
  * date range facet

## Indexing

```go
message := struct {
    Id   string
    From string
    Body string
}{
    Id:   "example",
    From: "xyz@couchbase.com",
    Body: "bleve indexing is easy",
}

mapping := bleve.NewIndexMapping()
index, err := bleve.New("example.bleve", mapping)
if err != nil {
    panic(err)
}
index.Index(message.Id, message)
```

## Querying

```go
index, _ := bleve.Open("example.bleve")
query := bleve.NewQueryStringQuery("bleve")
searchRequest := bleve.NewSearchRequest(query)
searchResult, _ := index.Search(searchRequest)
```

## Command Line Interface

To install the CLI for the latest release of bleve, run:

```bash
go install github.com/blevesearch/bleve/v2/cmd/bleve@latest
```

```text
$ bleve --help
Bleve is a command-line tool to interact with a bleve index.

Usage:
  bleve [command]

Available Commands:
  bulk        bulk loads from newline delimited JSON files
  check       checks the contents of the index
  count       counts the number documents in the index
  create      creates a new index
  dictionary  prints the term dictionary for the specified field in the index
  dump        dumps the contents of the index
  fields      lists the fields in this index
  help        Help about any command
  index       adds the files to the index
  mapping     prints the mapping used for this index
  query       queries the index
  registry    registry lists the bleve components compiled into this executable
  scorch      command-line tool to interact with a scorch index

Flags:
  -h, --help   help for bleve

Use "bleve [command] --help" for more information about a command.
```

## Text Analysis

Bleve includes general-purpose analyzers (customizable) as well as pre-built text analyzers for the following languages:

Arabic (ar), Bulgarian (bg), Catalan (ca), Chinese-Japanese-Korean (cjk), Kurdish (ckb), Danish (da), German (de), Greek (el), English (en), Spanish - Castilian (es), Basque (eu), Persian (fa), Finnish (fi), French (fr), Gaelic (ga), Spanish - Galician (gl), Hindi (hi), Croatian (hr), Hungarian (hu), Armenian (hy), Indonesian (id, in), Italian (it), Dutch (nl), Norwegian (no), Polish (pl), Portuguese (pt), Romanian (ro), Russian (ru), Swedish (sv), Turkish (tr)

## Text Analysis Wizard

[bleveanalysis.couchbase.com](https://bleveanalysis.couchbase.com)

## Discussion/Issues

Discuss usage/development of bleve and/or report issues here:

* [Github issues](https://github.com/blevesearch/bleve/issues)
* [Google group](https://groups.google.com/forum/#!forum/bleve)

## License

Apache License Version 2.0
