# Elastic 3.0

Elasticsearch 2.0 comes with some [breaking changes](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/breaking-changes-2.0.html). You will probably need to upgrade your application and/or rewrite part of it due to those changes.

We use that window of opportunity to also update Elastic (the Go client) from version 2.0 to 3.0. This will introduce both changes due to the Elasticsearch 2.0 update as well as changes that make Elastic cleaner by removing some old cruft.

So, to summarize:

1. Elastic 2.0 is compatible with Elasticsearch 1.7+ and is still actively maintained.
2. Elastic 3.0 is compatible with Elasticsearch 2.0+ and will soon become the new master branch.

The rest of the document is a list of all changes in Elastic 3.0.

## Pointer types

All types have changed to be pointer types, not value types. This not only is cleaner but also simplifies the API as illustrated by the following example:

Example for Elastic 2.0 (old):

```go
q := elastic.NewMatchAllQuery()
res, err := elastic.Search("one").Query(&q).Do()  // notice the & here
```

Example for Elastic 3.0 (new):

```go
q := elastic.NewMatchAllQuery()
res, err := elastic.Search("one").Query(q).Do()   // no more &
// ... which can be simplified as:
res, err := elastic.Search("one").Query(elastic.NewMatchAllQuery()).Do()
```

It also helps to prevent [subtle issues](https://github.com/olivere/elastic/issues/115#issuecomment-130753046).

## Query/filter merge

One of the biggest changes in Elasticsearch 2.0 is the [merge of queries and filters](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_query_dsl_changes.html#_queries_and_filters_merged). In Elasticsearch 1.x, you had a whole range of queries and filters that were basically identical (e.g. `term_query` and `term_filter`).

The practical aspect of the merge is that you can now basically use queries where once you had to use filters instead. For Elastic 3.0 this means: We could remove a whole bunch of files. Yay!

Notice that some methods still come by "filter", e.g. `PostFilter`. However, they accept a `Query` now when they used to accept a `Filter` before.

Example for Elastic 2.0 (old):

```go
q := elastic.NewMatchAllQuery()
f := elastic.NewTermFilter("tag", "important")
res, err := elastic.Search().Index("one").Query(&q).PostFilter(f)
```

Example for Elastic 3.0 (new):

```go
q := elastic.NewMatchAllQuery()
f := elastic.NewTermQuery("tag", "important") // it's a query now!
res, err := elastic.Search().Index("one").Query(q).PostFilter(f)
```

## Facets are removed

[Facets have been removed](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_removed_features.html#_facets_have_been_removed) in Elasticsearch 2.0. You need to use aggregations now.

## Errors

Elasticsearch 2.0 returns more information about an error in the HTTP response body. Elastic 3.0 now reads this information and makes it accessible by the consumer.

Errors and all its details are now returned in [`Error`](https://github.com/olivere/elastic/blob/release-branch.v3/errors.go#L59).

### HTTP Status 404 (Not Found)

When Elasticsearch does not find an entity or an index, it generally returns HTTP status code 404. In Elastic 2.0 this was a valid result and didn't raise an error from the `Do` functions. This has now changed in Elastic 3.0.

Starting with Elastic 3.0, there are only two types of responses considered successful. First, responses with HTTP status codes [200..299]. Second, HEAD requests which return HTTP status 404. The latter is used by Elasticsearch to e.g. check for existence of indices or documents. All other responses will return an error.

To check for HTTP Status 404 (with non-HEAD requests), e.g. when trying to get or delete a missing document, you can use the [`IsNotFound`](https://github.com/olivere/elastic/blob/release-branch.v3/errors.go#L84) helper (see below).

The following example illustrates how to check for a missing document in Elastic 2.0 and what has changed in 3.0.

Example for Elastic 2.0 (old):

```go
res, err = client.Get().Index("one").Type("tweet").Id("no-such-id").Do()
if err != nil {
  // Something else went wrong (but 404 is NOT an error in Elastic 2.0)
}
if !res.Found {
	// Document has not been found
}
```

Example for Elastic 3.0 (new):

```go
res, err = client.Get().Index("one").Type("tweet").Id("no-such-id").Do()
if err != nil {
  if elastic.IsNotFound(err) {
    // Document has not been found
  } else {
    // Something else went wrong
  }
}
```

### HTTP Status 408 (Timeouts)

Elasticsearch now responds with HTTP status code 408 (Timeout) when a request fails due to a timeout. E.g. if you specify a timeout with the Cluster Health API, the HTTP response status will be 408 if the timeout is raised. See [here](https://github.com/elastic/elasticsearch/commit/fe3179d9cccb569784434b2135ca9ae13d5158d3) for the specific commit to the Cluster Health API.

To check for HTTP Status 408, we introduced the [`IsTimeout`](https://github.com/olivere/elastic/blob/release-branch.v3/errors.go#L101) helper.

Example for Elastic 2.0 (old):

```go
health, err := client.ClusterHealth().WaitForStatus("yellow").Timeout("1s").Do()
if err != nil {
  // ...
}
if health.TimedOut {
  // We have a timeout
}
```

Example for Elastic 3.0 (new):

```go
health, err := client.ClusterHealth().WaitForStatus("yellow").Timeout("1s").Do()
if elastic.IsTimeout(err) {
  // We have a timeout
}
```

### Bulk Errors

The error response of a bulk operation used to be a simple string in Elasticsearch 1.x.
In Elasticsearch 2.0, it returns a structured JSON object with a lot more details about the error.
These errors are now captured in an object of type [`ErrorDetails`](https://github.com/olivere/elastic/blob/release-branch.v3/errors.go#L59) which is used in [`BulkResponseItem`](https://github.com/olivere/elastic/blob/release-branch.v3/bulk.go#L206).

### Removed specific Elastic errors

The specific error types `ErrMissingIndex`, `ErrMissingType`, and `ErrMissingId` have been removed. They were only used by `DeleteService` and are replaced by a generic error message.

## Numeric types

Elastic 3.0 has settled to use `float64` everywhere. It used to be a mix of `float32` and `float64` in Elastic 2.0. E.g. all boostable queries in Elastic 3.0 now have a boost type of `float64` where it used to be `float32`.

## Pluralization

Some services accept zero, one or more indices or types to operate on.
E.g. in the `SearchService` accepts a list of zero, one, or more indices to
search and therefor had a func called `Index(index string)` and a func
called `Indices(indices ...string)`.

Elastic 3.0 now only uses the singular form that, when applicable, accepts a
variadic type. E.g. in the case of the `SearchService`, you now only have
one func with the following signature: `Index(indices ...string)`.

Notice this is only limited to `Index(...)` and `Type(...)`. There are other
services with variadic functions. These have not been changed.

## Multiple calls to variadic functions

Some services with variadic functions have cleared the underlying slice when
called while other services just add to the existing slice. This has now been
normalized to always add to the underlying slice.

Example for Elastic 2.0 (old):

```go
// Would only cleared scroll id "two"
// because ScrollId cleared the values when called multiple times
client.ClearScroll().ScrollId("one").ScrollId("two").Do()
```

Example for Elastic 3.0 (new):

```go
// Now (correctly) clears both scroll id "one" and "two"
// because ScrollId no longer clears the values when called multiple times
client.ClearScroll().ScrollId("one").ScrollId("two").Do()
```

## Ping service requires URL

The `Ping` service raised some issues because it is different from all
other services. If not explicitly given a URL, it always pings `127.0.0.1:9200`.

Users expected to ping the cluster, but that is not possible as the cluster
can be a set of many nodes: So which node do we ping then?

To make it more clear, the `Ping` function on the client now requires users
to explicitly set the URL of the node to ping.

## Meta fields

Many of the meta fields e.g. `_parent` or `_routing` are now
[part of the top-level of a document](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_mapping_changes.html#migration-meta-fields)
and are no longer returned as parts of the `fields` object. We had to change
larger parts of e.g. the `Reindexer` to get it to work seamlessly with Elasticsearch 2.0.

Notice that all stored meta-fields are now [returned by default](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_crud_and_routing_changes.html#_all_stored_meta_fields_returned_by_default).

## HasParentQuery / HasChildQuery

`NewHasParentQuery` and `NewHasChildQuery` must now include both parent/child type and query. It is now in line with the Java API.

Example for Elastic 2.0 (old):

```go
allQ := elastic.NewMatchAllQuery()
q := elastic.NewHasChildFilter("tweet").Query(&allQ)
```

Example for Elastic 3.0 (new):

```go
q := elastic.NewHasChildQuery("tweet", elastic.NewMatchAllQuery())
```

## SetBasicAuth client option

You can now tell Elastic to pass HTTP Basic Auth credentials with each request. In previous versions of Elastic you had to set up your own `http.Transport` to do this. This should make it more convenient to use Elastic in combination with [Shield](https://www.elastic.co/products/shield) in its [basic setup](https://www.elastic.co/guide/en/shield/current/enable-basic-auth.html).

Example:

```go
client, err := elastic.NewClient(elastic.SetBasicAuth("user", "secret"))
if err != nil {
  log.Fatal(err)
}
```

## Delete-by-Query API

The Delete-by-Query API is [a plugin now](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_removed_features.html#_delete_by_query_is_now_a_plugin). It is no longer core part of Elasticsearch. You can [install it as a plugin as described here](https://www.elastic.co/guide/en/elasticsearch/plugins/2.0/plugins-delete-by-query.html).

Elastic 3.0 still contains the `DeleteByQueryService`, but you need to install the plugin first. If you don't install it and use `DeleteByQueryService` you will most probably get a 404.

An older version of this document stated the following:

> Elastic 3.0 still contains the `DeleteByQueryService` but it will fail with `ErrPluginNotFound` when the plugin is not installed.
>
> Example for Elastic 3.0 (new):
>
> ```go
> _, err := client.DeleteByQuery().Query(elastic.NewTermQuery("client", "1")).Do()
> if err == elastic.ErrPluginNotFound {
> 	// Delete By Query API is not available
> }
> ```

I have decided that this is not a good way to handle the case of a missing plugin. The main reason is that with this logic, you'd always have to check if the plugin is missing in case of an error. This is not only slow, but it also puts logic into a service where it should really be just opaque and return the response of Elasticsearch.

If you rely on certain plugins to be installed, you should check on startup. That's where the following two helpers come into play.

## HasPlugin and SetRequiredPlugins

Some of the core functionality of Elasticsearch has now been moved into plugins. E.g. the Delete-by-Query API is [a plugin now](https://www.elastic.co/guide/en/elasticsearch/plugins/2.0/plugins-delete-by-query.html).

You need to make sure to add these plugins to your Elasticsearch installation to still be able to use the `DeleteByQueryService`. You can test this now with the `HasPlugin(name string)` helper in the client.

Example for Elastic 3.0 (new):

```go
err, found := client.HasPlugin("delete-by-query")
if err == nil && found {
	// ... Delete By Query API is available
}
```

To simplify this process, there is now a `SetRequiredPlugins` helper that can be passed as an option func when creating a new client. If the plugin is not installed, the client wouldn't be created in the first place.

```go
// Will raise an error if the "delete-by-query" plugin is NOT installed
client, err := elastic.NewClient(elastic.SetRequiredPlugins("delete-by-query"))
if err != nil {
  log.Fatal(err)
}
```

Notice that there also is a way to define [mandatory plugins](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-plugins.html#_mandatory_plugins) in the Elasticsearch configuration file.

## Common Query has been renamed to Common Terms Query

The `CommonQuery` has been renamed to `CommonTermsQuery` to be in line with the [Java API](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_java_api_changes.html#_query_filter_refactoring).

## Remove `MoreLikeThis` and `MoreLikeThisField`

The More Like This API and the More Like This Field query [have been removed](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_query_dsl_changes.html#_more_like_this) and replaced with the `MoreLikeThisQuery`.

## Remove Filtered Query

With the merge of queries and filters, the [filtered query became deprecated](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_query_dsl_changes.html#_literal_filtered_literal_query_and_literal_query_literal_filter_deprecated). While it is only deprecated and therefore still available in Elasticsearch 2.0, we have decided to remove it from Elastic 3.0. Why? Because we think that when you're already forced to rewrite many of your application code, it might be a good chance to get rid of things that are deprecated as well. So you might simply change your filtered query with a boolean query as [described here](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_query_dsl_changes.html#_literal_filtered_literal_query_and_literal_query_literal_filter_deprecated).

## Remove FuzzyLikeThis and FuzzyLikeThisField

Both have been removed from Elasticsearch 2.0 as well.

## Remove LimitFilter

The `limit` filter is [deprecated in Elasticsearch 2.0](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_query_dsl_changes.html#_literal_limit_literal_filter_deprecated) and becomes a no-op. Now is a good chance to remove it from your application as well. Use the `terminate_after` parameter in your search [as described here](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/search-request-body.html) to achieve similar effects.

## Remove `_cache` and `_cache_key` from filters

Both have been [removed from Elasticsearch 2.0 as well](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_query_dsl_changes.html#_filter_auto_caching).

## Partial fields are gone

Partial fields are [removed in Elasticsearch 2.0](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/_search_changes.html#_partial_fields) in favor of [source filtering](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/search-request-source-filtering.html).

## Scripting

A [`Script`](https://github.com/olivere/elastic/blob/release-branch.v3/script.go) type has been added to Elastic 3.0. In Elastic 2.0, there were various places (e.g. aggregations) where you could just add the script as a string, specify the scripting language, add parameters etc. With Elastic 3.0, you should now always use the `Script` type.

Example for Elastic 2.0 (old):

```go
update, err := client.Update().Index("twitter").Type("tweet").Id("1").
	Script("ctx._source.retweets += num").
	ScriptParams(map[string]interface{}{"num": 1}).
	Upsert(map[string]interface{}{"retweets": 0}).
	Do()
```

Example for Elastic 3.0 (new):

```go
update, err := client.Update().Index("twitter").Type("tweet").Id("1").
	Script(elastic.NewScript("ctx._source.retweets += num").Param("num", 1)).
	Upsert(map[string]interface{}{"retweets": 0}).
	Do()
```

## Cluster State

The combination of `Metric(string)` and `Metrics(...string)` has been replaced by a single func with the signature `Metric(...string)`.

## Unexported structs in response

Services generally return a typed response from a `Do` func. Those structs are exported so that they can be passed around in your own application. In Elastic 3.0 however, we changed that (most) sub-structs are now unexported, meaning: You can only pass around the whole response, not sub-structures of it. This makes it easier for restructuring responses according to the Elasticsearch API. See [`ClusterStateResponse`](https://github.com/olivere/elastic/blob/release-branch.v3/cluster_state.go#L182) as an example.

## Add offset to Histogram aggregation

Histogram aggregations now have an [offset](https://github.com/elastic/elasticsearch/pull/9505) option.

## Services

### REST API specification

As you might know, Elasticsearch comes with a REST API specification. The specification describes the endpoints in a JSON structure.

Most services in Elastic predated the REST API specification. We are in the process of bringing all these services in line with the specification. Services can be generated by `go generate` (not 100% automatic though). This is an ongoing process.

This probably doesn't mean a lot to you. However, you can now be more confident that Elastic supports all features that the REST API specification describes.

At the same time, the file names of the services are renamed to match the REST API specification naming.

### REST API Test Suite

The REST API specification of Elasticsearch comes along with a test suite that official clients typically use to test for conformance. Up until now, Elastic didn't run this test suite. However, we are in the process of setting up infrastructure and tests to match this suite as well.

This process in not completed though.


