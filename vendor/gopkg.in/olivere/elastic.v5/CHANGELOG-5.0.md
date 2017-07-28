# Changes in Elastic 5.0

## Enforce context.Context in PerformRequest and Do

We enforce the usage of `context.Context` everywhere you execute a request.
You need to change all your `Do()` calls to pass a context: `Do(ctx)`.
This enables automatic request cancelation and many other patterns.

If you don't need this, simply pass `context.TODO()` or `context.Background()`.

## Warmers removed

Warmers are no longer necessary and have been [removed in ES 5.0](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_index_apis.html#_warmers).

## Optimize removed

Optimize was deprecated in ES 2.0 and has been [removed in ES 5.0](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_rest_api_changes.html#_literal__optimize_literal_endpoint_removed).
Use [Force Merge](https://www.elastic.co/guide/en/elasticsearch/reference/master/indices-forcemerge.html) instead.

## Missing Query removed

The `missing` query has been [removed](https://www.elastic.co/guide/en/elasticsearch/reference/master/query-dsl-exists-query.html#_literal_missing_literal_query).
Use `exists` query with `must_not` in `bool` query instead.

## And Query removed

The `and` query has been [removed](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_search_changes.html#_deprecated_queries_removed).
Use `must` clauses in a `bool` query instead.

## Not Query removed

TODO Is it removed?

## Or Query removed

The `or` query has been [removed](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_search_changes.html#_deprecated_queries_removed).
Use `should` clauses in a `bool` query instead.

## Filtered Query removed

The `filtered` query has been [removed](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_search_changes.html#_deprecated_queries_removed).
Use `bool` query instead, which supports `filter` clauses too.

## Limit Query removed

The `limit` query has been [removed](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_search_changes.html#_deprecated_queries_removed).
Use the `terminate_after` parameter instead.

# Template Query removed

The `template` query has been [deprecated](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/query-dsl-template-query.html). You should use
Search Templates instead.

We remove it from Elastic 5.0 as the 5.0 update is already a good opportunity
to get rid of old stuff.

## `_timestamp` and `_ttl` removed

Both of these fields were deprecated and are now [removed](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_mapping_changes.html#_literal__timestamp_literal_and_literal__ttl_literal).

## Search template Put/Delete API returns `acknowledged` only

The response type for Put/Delete search templates has changed.
It only returns a single `acknowledged` flag now.

## Fields has been renamed to Stored Fields

The `fields` parameter has been renamed to `stored_fields`.
See [here](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/breaking_50_search_changes.html#_literal_fields_literal_parameter).

## Fielddatafields has been renamed to Docvaluefields

The `fielddata_fields` parameter [has been renamed](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/breaking_50_search_changes.html#_literal_fielddata_fields_literal_parameter)
to `docvalue_fields`.

## Type exists endpoint changed

The endpoint for checking whether a type exists has been changed from
`HEAD {index}/{type}` to `HEAD {index}/_mapping/{type}`.
See [here](https://www.elastic.co/guide/en/elasticsearch/reference/5.0/breaking_50_rest_api_changes.html#_literal_head_index_type_literal_replaced_with_literal_head_index__mapping_type_literal).

## Refresh parameter changed

The `?refresh` parameter previously could be a boolean value. It indicated
whether changes made by a request (e.g. by the Bulk API) should be immediately
visible in search, or not. Using `refresh=true` had the positive effect of
immediately seeing the changes when searching; the negative effect is that
it is a rather big performance hit.

With 5.0, you now have the choice between these 3 values.

* `"true"` - Refresh immediately
* `"false"` - Do not refresh (the default value)
* `"wait_for"` - Wait until ES made the document visible in search

See [?refresh](https://www.elastic.co/guide/en/elasticsearch/reference/master/docs-refresh.html) in the documentation.

Notice that `true` and `false` (the boolean values) are no longer available
now in Elastic. You must use a string instead, with one of the above values.

## ReindexerService removed

The `ReindexerService` was a custom solution that was started in the ES 1.x era
to automate reindexing data, from one index to another or even between clusters.

ES 2.3 introduced its own [Reindex API](https://www.elastic.co/guide/en/elasticsearch/reference/master/docs-reindex.html)
so we're going to remove our custom solution and ask you to use the native reindexer.

The `ReindexService` is available via `client.Reindex()` (which used to point
to the custom reindexer).

## Delete By Query back in core

The [Delete By Query API](https://www.elastic.co/guide/en/elasticsearch/reference/master/docs-delete-by-query.html)
was moved into a plugin in 2.0. Now its back in core with a complete rewrite based on the Bulk API.

It has it's own endpoint at `/_delete_by_query`.

Delete By Query, Reindex, and Update By Query are very similar under the hood.

## Reindex, Delete By Query, and Update By Query response changed

The response from the above APIs changed a bit. E.g. the `retries` value
used to be an `int64` and returns separate values for `bulk` and `search` now:

```
// Old
{
    ...
    "retries": 123,
    ...
}
```

```
// New
{
    ...
    "retries": {
        "bulk": 123,
        "search": 0
    },
    ...
}
```

## ScanService removed

The `ScanService` is removed. Use the (new) `ScrollService` instead.

## New ScrollService

There was confusion around `ScanService` and `ScrollService` doing basically
the same. One was returning slices and didn't support all query details, the
other returned one document after another and wasn't safe for concurrent use.
So we merged the two and merged it into a new `ScrollService` that
removes all the problems with the older services.

In other words:
If you used `ScanService`, switch to `ScrollService`.
If you used the old `ScrollService`, you might need to fix some things but
overall it should just work.

Changes:
- We replaced `elastic.EOS` with `io.EOF` to indicate the "end of scroll".

TODO Not implemented yet

## Suggesters

They have been [completely rewritten in ES 5.0](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_suggester.html).

Some changes:
- Suggesters no longer have an [output](https://www.elastic.co/guide/en/elasticsearch/reference/master/breaking_50_suggester.html#_simpler_completion_indexing).

TODO Fix all structural changes in suggesters

## Percolator

Percolator has [changed considerably](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/breaking_50_percolator.html).

Elastic 5.0 adds the new
[Percolator Query](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/query-dsl-percolate-query.html)
which can be used in combination with the new
[Percolator type](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/percolator.html).

The Percolate service is removed from Elastic 5.0.

## Remove Consistency, add WaitForActiveShards

The `consistency` parameter has been removed in a lot of places, e.g. the Bulk,
Index, Delete, Delete-by-Query, Reindex, Update, and Update-by-Query API.

It has been replaced by a somewhat similar `wait_for_active_shards` parameter.
See https://github.com/elastic/elasticsearch/pull/19454.
