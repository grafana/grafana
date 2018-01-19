_September 28, 2017_

*v0.14.0*

- bigquery BREAKING CHANGES:
  - Standard SQL is the default for queries and views.
  - `Table.Create` takes `TableMetadata` as a second argument, instead of
    options.
  - `Dataset.Create` takes `DatasetMetadata` as a second argument.
  - `DatasetMetadata` field `ID` renamed to `FullID`
  - `TableMetadata` field `ID` renamed to `FullID`

- Other bigquery changes:
  - The client will append a random suffix to a provided job ID if you set
    `AddJobIDSuffix` to true in a job config.
  - Listing jobs is supported.
  - Better retry logic.

- vision, language, speech: clients are now stable

- monitoring: client is now beta

- profiler:
  - Rename InstanceName to Instance, ZoneName to Zone
  - Auto-detect service name and version on AppEngine.

_September 8, 2017_

*v0.13.0*

- bigquery: UseLegacySQL options for CreateTable and QueryConfig. Use these
  options to continue using Legacy SQL after the client switches its default
  to Standard SQL.

- bigquery: Support for updating dataset labels.

- bigquery: Set DatasetIterator.ProjectID to list datasets in a project other
  than the client's. DatasetsInProject is no longer needed and is deprecated.

- bigtable: Fail ListInstances when any zones fail.

- spanner: support decoding of slices of basic types (e.g. []string, []int64,
  etc.)

- logging/logadmin: UpdateSink no longer creates a sink if it is missing
  (actually a change to the underlying service, not the client)

- profiler: Service and ServiceVersion replace Target in Config.

_August 22, 2017_

*v0.12.0*

- pubsub: Subscription.Receive now uses streaming pull.

- pubsub: add Client.TopicInProject to access topics in a different project
  than the client.

- errors: renamed errorreporting. The errors package will be removed shortly.

- datastore: improved retry behavior.

- bigquery: support updates to dataset metadata, with etags.

- bigquery: add etag support to Table.Update (BREAKING: etag argument added).

- bigquery: generate all job IDs on the client.

- storage: support bucket lifecycle configurations.


_July 31, 2017_

*v0.11.0*

- Clients for spanner, pubsub and video are now in beta.

- New client for DLP.

- spanner: performance and testing improvements.

- storage: requester-pays buckets are supported.

- storage, profiler, bigtable, bigquery: bug fixes and other minor improvements.

- pubsub: bug fixes and other minor improvements

_June 17, 2017_


*v0.10.0*

- pubsub: Subscription.ModifyPushConfig replaced with Subscription.Update.

- pubsub: Subscription.Receive now runs concurrently for higher throughput.

- vision: cloud.google.com/go/vision is deprecated. Use
cloud.google.com/go/vision/apiv1 instead.

- translation: now stable.

- trace: several changes to the surface. See the link below.

[Code changes required from v0.9.0.](https://github.com/GoogleCloudPlatform/google-cloud-go/blob/master/MIGRATION.md)


_March 17, 2017_

Breaking Pubsub changes.
* Publish is now asynchronous
([announcement](https://groups.google.com/d/topic/google-api-go-announce/aaqRDIQ3rvU/discussion)).
* Subscription.Pull replaced by Subscription.Receive, which takes a callback ([announcement](https://groups.google.com/d/topic/google-api-go-announce/8pt6oetAdKc/discussion)).
* Message.Done replaced with Message.Ack and Message.Nack.

_February 14, 2017_

Release of a client library for Spanner. See
the
[blog post](https://cloudplatform.googleblog.com/2017/02/introducing-Cloud-Spanner-a-global-database-service-for-mission-critical-applications.html).

Note that although the Spanner service is beta, the Go client library is alpha.

_December 12, 2016_

Beta release of BigQuery, DataStore, Logging and Storage. See the
[blog post](https://cloudplatform.googleblog.com/2016/12/announcing-new-google-cloud-client.html).

Also, BigQuery now supports structs. Read a row directly into a struct with
`RowIterator.Next`, and upload a row directly from a struct with `Uploader.Put`.
You can also use field tags. See the [package documentation][cloud-bigquery-ref]
for details.

_December 5, 2016_

More changes to BigQuery:

* The `ValueList` type was removed. It is no longer necessary. Instead of
   ```go
   var v ValueList
   ... it.Next(&v) ..
   ```
   use

   ```go
   var v []Value
   ... it.Next(&v) ...
   ```

* Previously, repeatedly calling `RowIterator.Next` on the same `[]Value` or
  `ValueList` would append to the slice. Now each call resets the size to zero first.

* Schema inference will infer the SQL type BYTES for a struct field of
  type []byte. Previously it inferred STRING.

* The types `uint`, `uint64` and `uintptr` are no longer supported in schema
  inference. BigQuery's integer type is INT64, and those types may hold values
  that are not correctly represented in a 64-bit signed integer.

* The SQL types DATE, TIME and DATETIME are now supported. They correspond to
  the `Date`, `Time` and `DateTime` types in the new `cloud.google.com/go/civil`
  package.

_November 17, 2016_

Change to BigQuery: values from INTEGER columns will now be returned as int64,
not int. This will avoid errors arising from large values on 32-bit systems.

_November 8, 2016_

New datastore feature: datastore now encodes your nested Go structs as Entity values,
instead of a flattened list of the embedded struct's fields.
This means that you may now have twice-nested slices, eg.
```go
type State struct {
  Cities  []struct{
    Populations []int
  }
}
```

See [the announcement](https://groups.google.com/forum/#!topic/google-api-go-announce/79jtrdeuJAg) for
more details.

_November 8, 2016_

Breaking changes to datastore: contexts no longer hold namespaces; instead you
must set a key's namespace explicitly. Also, key functions have been changed
and renamed.

* The WithNamespace function has been removed. To specify a namespace in a Query, use the Query.Namespace method:
  ```go
  q := datastore.NewQuery("Kind").Namespace("ns")
  ```

* All the fields of Key are exported. That means you can construct any Key with a struct literal:
  ```go
  k := &Key{Kind: "Kind",  ID: 37, Namespace: "ns"}
  ```

* As a result of the above, the Key methods Kind, ID, d.Name, Parent, SetParent and Namespace have been removed.

* `NewIncompleteKey` has been removed, replaced by `IncompleteKey`. Replace
  ```go
  NewIncompleteKey(ctx, kind, parent)
  ```
  with
  ```go
  IncompleteKey(kind, parent)
  ```
  and if you do use namespaces, make sure you set the namespace on the returned key.

* `NewKey` has been removed, replaced by `NameKey` and `IDKey`. Replace
  ```go
  NewKey(ctx, kind, name, 0, parent)
  NewKey(ctx, kind, "", id, parent)
  ```
  with
  ```go
  NameKey(kind, name, parent)
  IDKey(kind, id, parent)
  ```
  and if you do use namespaces, make sure you set the namespace on the returned key.

* The `Done` variable has been removed. Replace `datastore.Done` with `iterator.Done`, from the package `google.golang.org/api/iterator`.

* The `Client.Close` method will have a return type of error. It will return the result of closing the underlying gRPC connection.

See [the announcement](https://groups.google.com/forum/#!topic/google-api-go-announce/hqXtM_4Ix-0) for
more details.

_October 27, 2016_

Breaking change to bigquery: `NewGCSReference` is now a function,
not a method on `Client`.

New bigquery feature: `Table.LoaderFrom` now accepts a `ReaderSource`, enabling
loading data into a table from a file or any `io.Reader`.

_October 21, 2016_

Breaking change to pubsub: removed `pubsub.Done`.

Use `iterator.Done` instead, where `iterator` is the package
`google.golang.org/api/iterator`.

_October 19, 2016_

Breaking changes to cloud.google.com/go/bigquery:

* Client.Table and Client.OpenTable have been removed.
    Replace
    ```go
    client.OpenTable("project", "dataset", "table")
    ```
    with
    ```go
    client.DatasetInProject("project", "dataset").Table("table")
    ```

* Client.CreateTable has been removed.
    Replace
    ```go
    client.CreateTable(ctx, "project", "dataset", "table")
    ```
    with
    ```go
    client.DatasetInProject("project", "dataset").Table("table").Create(ctx)
    ```

* Dataset.ListTables have been replaced with Dataset.Tables.
    Replace
    ```go
    tables, err := ds.ListTables(ctx)
    ```
    with
    ```go
    it := ds.Tables(ctx)
    for {
        table, err := it.Next()
        if err == iterator.Done {
            break
        }
        if err != nil {
            // TODO: Handle error.
        }
        // TODO: use table.
    }
    ```

* Client.Read has been replaced with Job.Read, Table.Read and Query.Read.
    Replace
    ```go
    it, err := client.Read(ctx, job)
    ```
    with
    ```go
    it, err := job.Read(ctx)
    ```
  and similarly for reading from tables or queries.

* The iterator returned from the Read methods is now named RowIterator. Its
  behavior is closer to the other iterators in these libraries. It no longer
  supports the Schema method; see the next item.
    Replace
    ```go
    for it.Next(ctx) {
        var vals ValueList
        if err := it.Get(&vals); err != nil {
            // TODO: Handle error.
        }
        // TODO: use vals.
    }
    if err := it.Err(); err != nil {
        // TODO: Handle error.
    }
    ```
    with
    ```
    for {
        var vals ValueList
        err := it.Next(&vals)
        if err == iterator.Done {
            break
        }
        if err != nil {
            // TODO: Handle error.
        }
        // TODO: use vals.
    }
    ```
    Instead of the `RecordsPerRequest(n)` option, write
    ```go
    it.PageInfo().MaxSize = n
    ```
    Instead of the `StartIndex(i)` option, write
    ```go
    it.StartIndex = i
    ```

* ValueLoader.Load now takes a Schema in addition to a slice of Values.
    Replace
    ```go
    func (vl *myValueLoader) Load(v []bigquery.Value)
    ```
    with
    ```go
    func (vl *myValueLoader) Load(v []bigquery.Value, s bigquery.Schema)
    ```


* Table.Patch is replace by Table.Update.
    Replace
    ```go
    p := table.Patch()
    p.Description("new description")
    metadata, err := p.Apply(ctx)
    ```
    with
    ```go
    metadata, err := table.Update(ctx, bigquery.TableMetadataToUpdate{
        Description: "new description",
    })
    ```

* Client.Copy is replaced by separate methods for each of its four functions.
  All options have been replaced by struct fields.

  * To load data from Google Cloud Storage into a table, use Table.LoaderFrom.

    Replace
    ```go
    client.Copy(ctx, table, gcsRef)
    ```
    with
    ```go
    table.LoaderFrom(gcsRef).Run(ctx)
    ```
    Instead of passing options to Copy, set fields on the Loader:
    ```go
    loader := table.LoaderFrom(gcsRef)
    loader.WriteDisposition = bigquery.WriteTruncate
    ```

  * To extract data from a table into Google Cloud Storage, use
    Table.ExtractorTo. Set fields on the returned Extractor instead of
    passing options.

    Replace
    ```go
    client.Copy(ctx, gcsRef, table)
    ```
    with
    ```go
    table.ExtractorTo(gcsRef).Run(ctx)
    ```

  * To copy data into a table from one or more other tables, use
    Table.CopierFrom. Set fields on the returned Copier instead of passing options.

    Replace
    ```go
    client.Copy(ctx, dstTable, srcTable)
    ```
    with
    ```go
    dst.Table.CopierFrom(srcTable).Run(ctx)
    ```

  * To start a query job, create a Query and call its Run method. Set fields
  on the query instead of passing options.

    Replace
    ```go
    client.Copy(ctx, table, query)
    ```
    with
    ```go
    query.Run(ctx)
    ```

* Table.NewUploader has been renamed to Table.Uploader. Instead of options,
  configure an Uploader by setting its fields.
    Replace
    ```go
    u := table.NewUploader(bigquery.UploadIgnoreUnknownValues())
    ```
    with
    ```go
    u := table.NewUploader(bigquery.UploadIgnoreUnknownValues())
    u.IgnoreUnknownValues = true
    ```

_October 10, 2016_

Breaking changes to cloud.google.com/go/storage:

* AdminClient replaced by methods on Client.
    Replace
    ```go
    adminClient.CreateBucket(ctx, bucketName, attrs)
    ```
    with
    ```go
    client.Bucket(bucketName).Create(ctx, projectID, attrs)
    ```

* BucketHandle.List replaced by BucketHandle.Objects.
    Replace
    ```go
    for query != nil {
        objs, err := bucket.List(d.ctx, query)
        if err != nil { ... }
        query = objs.Next
        for _, obj := range objs.Results {
            fmt.Println(obj)
        }
    }
    ```
    with
    ```go
    iter := bucket.Objects(d.ctx, query)
    for {
        obj, err := iter.Next()
        if err == iterator.Done {
            break
        }
        if err != nil { ... }
        fmt.Println(obj)
    }
    ```
    (The `iterator` package is at `google.golang.org/api/iterator`.)

    Replace `Query.Cursor` with `ObjectIterator.PageInfo().Token`.
    
    Replace `Query.MaxResults` with `ObjectIterator.PageInfo().MaxSize`.


* ObjectHandle.CopyTo replaced by ObjectHandle.CopierFrom.
    Replace
    ```go
    attrs, err := src.CopyTo(ctx, dst, nil)
    ```
    with
    ```go
    attrs, err := dst.CopierFrom(src).Run(ctx)
    ```

    Replace
    ```go
    attrs, err := src.CopyTo(ctx, dst, &storage.ObjectAttrs{ContextType: "text/html"})
    ```
    with
    ```go
    c := dst.CopierFrom(src)
    c.ContextType = "text/html"
    attrs, err := c.Run(ctx)
    ```

* ObjectHandle.ComposeFrom replaced by ObjectHandle.ComposerFrom.
    Replace
    ```go
    attrs, err := dst.ComposeFrom(ctx, []*storage.ObjectHandle{src1, src2}, nil)
    ```
    with
    ```go
    attrs, err := dst.ComposerFrom(src1, src2).Run(ctx)
    ```

* ObjectHandle.Update's ObjectAttrs argument replaced by ObjectAttrsToUpdate.
    Replace
    ```go
    attrs, err := obj.Update(ctx, &storage.ObjectAttrs{ContextType: "text/html"})
    ```
    with
    ```go
    attrs, err := obj.Update(ctx, storage.ObjectAttrsToUpdate{ContextType: "text/html"})
    ```

* ObjectHandle.WithConditions replaced by ObjectHandle.If.
    Replace
    ```go
    obj.WithConditions(storage.Generation(gen), storage.IfMetaGenerationMatch(mgen))
    ```
    with
    ```go
    obj.Generation(gen).If(storage.Conditions{MetagenerationMatch: mgen})
    ```

    Replace
    ```go
    obj.WithConditions(storage.IfGenerationMatch(0))
    ```
    with
    ```go
    obj.If(storage.Conditions{DoesNotExist: true})
    ```

* `storage.Done` replaced by `iterator.Done` (from package `google.golang.org/api/iterator`).

_October 6, 2016_

Package preview/logging deleted. Use logging instead.

_September 27, 2016_

Logging client replaced with preview version (see below).

_September 8, 2016_

* New clients for some of Google's Machine Learning APIs: Vision, Speech, and
Natural Language.

* Preview version of a new [Stackdriver Logging][cloud-logging] client in
[`cloud.google.com/go/preview/logging`](https://godoc.org/cloud.google.com/go/preview/logging).
This client uses gRPC as its transport layer, and supports log reading, sinks
and metrics. It will replace the current client at `cloud.google.com/go/logging` shortly.

