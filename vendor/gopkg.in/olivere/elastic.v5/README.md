# Elastic

Elastic is an [Elasticsearch](http://www.elasticsearch.org/) client for the
[Go](http://www.golang.org/) programming language.

[![Build Status](https://travis-ci.org/olivere/elastic.svg?branch=release-branch.v5)](https://travis-ci.org/olivere/elastic)
[![Godoc](http://img.shields.io/badge/godoc-reference-blue.svg?style=flat)](http://godoc.org/gopkg.in/olivere/elastic.v5)
[![license](http://img.shields.io/badge/license-MIT-red.svg?style=flat)](https://raw.githubusercontent.com/olivere/elastic/master/LICENSE)

See the [wiki](https://github.com/olivere/elastic/wiki) for additional information about Elastic.


## Releases

**The release branches (e.g. [`release-branch.v5`](https://github.com/olivere/elastic/tree/release-branch.v5))
are actively being worked on and can break at any time.
If you want to use stable versions of Elastic, please use the packages released via [gopkg.in](https://gopkg.in).**

Here's the version matrix:

Elasticsearch version | Elastic version -| Package URL
----------------------|------------------|------------
5.x                   | 5.0              | [`gopkg.in/olivere/elastic.v5`](https://gopkg.in/olivere/elastic.v5) ([source](https://github.com/olivere/elastic/tree/release-branch.v5) [doc](http://godoc.org/gopkg.in/olivere/elastic.v5))
2.x                   | 3.0              | [`gopkg.in/olivere/elastic.v3`](https://gopkg.in/olivere/elastic.v3) ([source](https://github.com/olivere/elastic/tree/release-branch.v3) [doc](http://godoc.org/gopkg.in/olivere/elastic.v3))
1.x                   | 2.0              | [`gopkg.in/olivere/elastic.v2`](https://gopkg.in/olivere/elastic.v2) ([source](https://github.com/olivere/elastic/tree/release-branch.v2) [doc](http://godoc.org/gopkg.in/olivere/elastic.v2))
0.9-1.3               | 1.0              | [`gopkg.in/olivere/elastic.v1`](https://gopkg.in/olivere/elastic.v1) ([source](https://github.com/olivere/elastic/tree/release-branch.v1) [doc](http://godoc.org/gopkg.in/olivere/elastic.v1))

**Example:**

You have installed Elasticsearch 5.0.0 and want to use Elastic.
As listed above, you should use Elastic 5.0.
So you first install the stable release of Elastic 5.0 from gopkg.in.

```sh
$ go get gopkg.in/olivere/elastic.v5
```

You then import it with this import path:

```go
import elastic "gopkg.in/olivere/elastic.v5"
```

### Elastic 5.0

Elastic 5.0 targets Elasticsearch 5.0.0 and later. Elasticsearch 5.0.0 was
[released on 26th October 2016](https://www.elastic.co/blog/elasticsearch-5-0-0-released).

Notice that there are will be a lot of [breaking changes in Elasticsearch 5.0](https://www.elastic.co/guide/en/elasticsearch/reference/5.0/breaking-changes-5.0.html)
and we used this as an opportunity to [clean up and refactor Elastic](https://github.com/olivere/elastic/blob/release-branch.v5/CHANGELOG-5.0.md)
as we did in the transition from Elastic 2.0 (for Elasticsearch 1.x) to Elastic 3.0 (for Elasticsearch 2.x).

Furthermore, the jump in version numbers will give us a chance to be in sync with the Elastic Stack.

### Elastic 3.0

Elastic 3.0 targets Elasticsearch 2.x and is published via [`gopkg.in/olivere/elastic.v3`](https://gopkg.in/olivere/elastic.v3).

Elastic 3.0 will only get critical bug fixes. You should update to a recent version.

### Elastic 2.0

Elastic 2.0 targets Elasticsearch 1.x and is published via [`gopkg.in/olivere/elastic.v2`](https://gopkg.in/olivere/elastic.v2).

Elastic 2.0 will only get critical bug fixes. You should update to a recent version.

### Elastic 1.0

Elastic 1.0 is deprecated. You should really update Elasticsearch and Elastic
to a recent version.

However, if you cannot update for some reason, don't worry. Version 1.0 is
still available. All you need to do is go-get it and change your import path
as described above.


## Status

We use Elastic in production since 2012. Elastic is stable but the API changes
now and then. We strive for API compatibility.
However, Elasticsearch sometimes introduces [breaking changes](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking-changes.html)
and we sometimes have to adapt.

Having said that, there have been no big API changes that required you
to rewrite your application big time. More often than not it's renaming APIs
and adding/removing features so that Elastic is in sync with Elasticsearch.

Elastic has been used in production with the following Elasticsearch versions:
0.90, 1.0-1.7, and 2.0-2.4.1. Furthermore, we use [Travis CI](https://travis-ci.org/)
to test Elastic with the most recent versions of Elasticsearch and Go.
See the [.travis.yml](https://github.com/olivere/elastic/blob/master/.travis.yml)
file for the exact matrix and [Travis](https://travis-ci.org/olivere/elastic)
for the results.

Elasticsearch has quite a few features. Most of them are implemented
by Elastic. I add features and APIs as required. It's straightforward
to implement missing pieces. I'm accepting pull requests :-)

Having said that, I hope you find the project useful.


## Getting Started

The first thing you do is to create a [Client](https://github.com/olivere/elastic/blob/master/client.go).
The client connects to Elasticsearch on `http://127.0.0.1:9200` by default.

You typically create one client for your app. Here's a complete example of
creating a client, creating an index, adding a document, executing a search etc.

```go
// Create a context
ctx := context.Background()

// Create a client
client, err := elastic.NewClient()
if err != nil {
    // Handle error
    panic(err)
}

// Create an index
_, err = client.CreateIndex("twitter").Do(ctx)
if err != nil {
    // Handle error
    panic(err)
}

// Add a document to the index
tweet := Tweet{User: "olivere", Message: "Take Five"}
_, err = client.Index().
    Index("twitter").
    Type("tweet").
    Id("1").
    BodyJson(tweet).
    Refresh("true").
    Do(ctx)
if err != nil {
    // Handle error
    panic(err)
}

// Search with a term query
termQuery := elastic.NewTermQuery("user", "olivere")
searchResult, err := client.Search().
    Index("twitter").   // search in index "twitter"
    Query(termQuery).   // specify the query
    Sort("user", true). // sort by "user" field, ascending
    From(0).Size(10).   // take documents 0-9
    Pretty(true).       // pretty print request and response JSON
    Do(ctx)             // execute
if err != nil {
    // Handle error
    panic(err)
}

// searchResult is of type SearchResult and returns hits, suggestions,
// and all kinds of other information from Elasticsearch.
fmt.Printf("Query took %d milliseconds\n", searchResult.TookInMillis)

// Each is a convenience function that iterates over hits in a search result.
// It makes sure you don't need to check for nil values in the response.
// However, it ignores errors in serialization. If you want full control
// over iterating the hits, see below.
var ttyp Tweet
for _, item := range searchResult.Each(reflect.TypeOf(ttyp)) {
    if t, ok := item.(Tweet); ok {
        fmt.Printf("Tweet by %s: %s\n", t.User, t.Message)
    }
}
// TotalHits is another convenience function that works even when something goes wrong.
fmt.Printf("Found a total of %d tweets\n", searchResult.TotalHits())

// Here's how you iterate through results with full control over each step.
if searchResult.Hits.TotalHits > 0 {
    fmt.Printf("Found a total of %d tweets\n", searchResult.Hits.TotalHits)

    // Iterate through results
    for _, hit := range searchResult.Hits.Hits {
        // hit.Index contains the name of the index

        // Deserialize hit.Source into a Tweet (could also be just a map[string]interface{}).
        var t Tweet
        err := json.Unmarshal(*hit.Source, &t)
        if err != nil {
            // Deserialization failed
        }

        // Work with tweet
        fmt.Printf("Tweet by %s: %s\n", t.User, t.Message)
    }
} else {
    // No hits
    fmt.Print("Found no tweets\n")
}

// Delete the index again
_, err = client.DeleteIndex("twitter").Do(ctx)
if err != nil {
    // Handle error
    panic(err)
}
```

Here's a [link to a complete working example](https://gist.github.com/olivere/114347ff9d9cfdca7bdc0ecea8b82263).

See the [wiki](https://github.com/olivere/elastic/wiki) for more details.


## API Status

### Document APIs

- [x] Index API
- [x] Get API
- [x] Delete API
- [x] Delete By Query API
- [x] Update API
- [x] Update By Query API
- [x] Multi Get API
- [x] Bulk API
- [x] Reindex API
- [x] Term Vectors
- [x] Multi termvectors API

### Search APIs

- [x] Search
- [x] Search Template
- [ ] Multi Search Template
- [ ] Search Shards API
- [x] Suggesters
  - [x] Term Suggester
  - [x] Phrase Suggester
  - [x] Completion Suggester
  - [x] Context Suggester
- [x] Multi Search API
- [x] Count API
- [ ] Search Exists API
- [ ] Validate API
- [x] Explain API
- [x] Profile API
- [x] Field Stats API

### Aggregations

- Metrics Aggregations
  - [x] Avg
  - [x] Cardinality
  - [x] Extended Stats
  - [x] Geo Bounds
  - [ ] Geo Centroid
  - [x] Max
  - [x] Min
  - [x] Percentiles
  - [x] Percentile Ranks
  - [ ] Scripted Metric
  - [x] Stats
  - [x] Sum
  - [x] Top Hits
  - [x] Value Count
- Bucket Aggregations
  - [x] Children
  - [x] Date Histogram
  - [x] Date Range
  - [x] Filter
  - [x] Filters
  - [x] Geo Distance
  - [ ] GeoHash Grid
  - [x] Global
  - [x] Histogram
  - [x] IP Range
  - [x] Missing
  - [x] Nested
  - [x] Range
  - [x] Reverse Nested
  - [x] Sampler
  - [x] Significant Terms
  - [x] Terms
- Pipeline Aggregations
  - [x] Avg Bucket
  - [x] Derivative
  - [x] Max Bucket
  - [x] Min Bucket
  - [x] Sum Bucket
  - [x] Stats Bucket
  - [ ] Extended Stats Bucket
  - [x] Percentiles Bucket
  - [x] Moving Average
  - [x] Cumulative Sum
  - [x] Bucket Script
  - [x] Bucket Selector
  - [x] Serial Differencing
- [x] Matrix Aggregations
  - [x] Matrix Stats
- [x] Aggregation Metadata

### Indices APIs

- [x] Create Index
- [x] Delete Index
- [x] Get Index
- [x] Indices Exists
- [x] Open / Close Index
- [x] Shrink Index
- [x] Rollover Index
- [x] Put Mapping
- [x] Get Mapping
- [x] Get Field Mapping
- [x] Types Exists
- [x] Index Aliases
- [x] Update Indices Settings
- [x] Get Settings
- [x] Analyze
- [x] Index Templates
- [ ] Shadow Replica Indices
- [x] Indices Stats
- [ ] Indices Segments
- [ ] Indices Recovery
- [ ] Indices Shard Stores
- [ ] Clear Cache
- [x] Flush
- [x] Refresh
- [x] Force Merge
- [ ] Upgrade

### cat APIs

The cat APIs are not implemented as of now. We think they are better suited for operating with Elasticsearch on the command line.

- [ ] cat aliases
- [ ] cat allocation
- [ ] cat count
- [ ] cat fielddata
- [ ] cat health
- [ ] cat indices
- [ ] cat master
- [ ] cat nodeattrs
- [ ] cat nodes
- [ ] cat pending tasks
- [ ] cat plugins
- [ ] cat recovery
- [ ] cat repositories
- [ ] cat thread pool
- [ ] cat shards
- [ ] cat segments
- [ ] cat snapshots

### Cluster APIs

- [x] Cluster Health
- [x] Cluster State
- [x] Cluster Stats
- [ ] Pending Cluster Tasks
- [ ] Cluster Reroute
- [ ] Cluster Update Settings
- [x] Nodes Stats
- [x] Nodes Info
- [x] Task Management API
- [ ] Nodes hot_threads
- [ ] Cluster Allocation Explain API

### Query DSL

- [x] Match All Query
- [x] Inner hits
- Full text queries
  - [x] Match Query
  - [x] Match Phrase Query
  - [x] Match Phrase Prefix Query
  - [x] Multi Match Query
  - [x] Common Terms Query
  - [x] Query String Query
  - [x] Simple Query String Query
- Term level queries
  - [x] Term Query
  - [x] Terms Query
  - [x] Range Query
  - [x] Exists Query
  - [x] Prefix Query
  - [x] Wildcard Query
  - [x] Regexp Query
  - [x] Fuzzy Query
  - [x] Type Query
  - [x] Ids Query
- Compound queries
  - [x] Constant Score Query
  - [x] Bool Query
  - [x] Dis Max Query
  - [x] Function Score Query
  - [x] Boosting Query
  - [x] Indices Query
- Joining queries
  - [x] Nested Query
  - [x] Has Child Query
  - [x] Has Parent Query
  - [x] Parent Id Query
- Geo queries
  - [ ] GeoShape Query
  - [x] Geo Bounding Box Query
  - [x] Geo Distance Query
  - [ ] Geo Distance Range Query
  - [x] Geo Polygon Query
  - [ ] Geohash Cell Query
- Specialized queries
  - [x] More Like This Query
  - [x] Template Query
  - [x] Script Query
  - [x] Percolate Query
- Span queries
  - [ ] Span Term Query
  - [ ] Span Multi Term Query
  - [ ] Span First Query
  - [ ] Span Near Query
  - [ ] Span Or Query
  - [ ] Span Not Query
  - [ ] Span Containing Query
  - [ ] Span Within Query
  - [ ] Span Field Masking Query
- [ ] Minimum Should Match
- [ ] Multi Term Query Rewrite

### Modules

- Snapshot and Restore
  - [x] Repositories
  - [ ] Snapshot
  - [ ] Restore
  - [ ] Snapshot status
  - [ ] Monitoring snapshot/restore status
  - [ ] Stopping currently running snapshot and restore

### Sorting

- [x] Sort by score
- [x] Sort by field
- [x] Sort by geo distance
- [x] Sort by script
- [x] Sort by doc

### Scrolling

Scrolling is supported via a  `ScrollService`. It supports an iterator-like interface.
The `ClearScroll` API is implemented as well.

A pattern for [efficiently scrolling in parallel](https://github.com/olivere/elastic/wiki/ScrollParallel)
is described in the [Wiki](https://github.com/olivere/elastic/wiki).

## How to contribute

Read [the contribution guidelines](https://github.com/olivere/elastic/blob/master/CONTRIBUTING.md).

## Credits

Thanks a lot for the great folks working hard on
[Elasticsearch](https://www.elastic.co/products/elasticsearch)
and
[Go](https://golang.org/).

Elastic uses portions of the
[uritemplates](https://github.com/jtacoma/uritemplates) library
by Joshua Tacoma,
[backoff](https://github.com/cenkalti/backoff) by Cenk Altı and
[leaktest](https://github.com/fortytw2/leaktest) by Ian Chiles.

## LICENSE

MIT-LICENSE. See [LICENSE](http://olivere.mit-license.org/)
or the LICENSE file provided in the repository for details.
