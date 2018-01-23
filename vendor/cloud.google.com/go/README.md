# Google Cloud Client Libraries for Go

[![GoDoc](https://godoc.org/cloud.google.com/go?status.svg)](https://godoc.org/cloud.google.com/go)

Go packages for [Google Cloud Platform](https://cloud.google.com) services.

``` go
import "cloud.google.com/go"
```

To install the packages on your system,

```
$ go get -u cloud.google.com/go/...
```

**NOTE:** Some of these packages are under development, and may occasionally
make backwards-incompatible changes.

**NOTE:** Github repo is a mirror of [https://code.googlesource.com/gocloud](https://code.googlesource.com/gocloud).

  * [News](#news)
  * [Supported APIs](#supported-apis)
  * [Go Versions Supported](#go-versions-supported)
  * [Authorization](#authorization)
  * [Cloud Datastore](#cloud-datastore-)
  * [Cloud Storage](#cloud-storage-)
  * [Cloud Pub/Sub](#cloud-pub-sub-)
  * [Cloud BigQuery](#cloud-bigquery-)
  * [Stackdriver Logging](#stackdriver-logging-)
  * [Cloud Spanner](#cloud-spanner-)


## News

_January 18, 2018_

*v0.18.0*

- bigquery:
  - Marked stable.
  - Schema inference of nullable fields supported.
  - Added TimePartitioning to QueryConfig.

- firestore: Data provided to DocumentRef.Set with a Merge option can contain
  Delete sentinels.

- logging: Clients can accept parent resources other than projects.

- pubsub:
  - pubsub/pstest: A lighweight fake for pubsub. Experimental; feedback welcome.
  - Support updating more subscription metadata: AckDeadline,
    RetainAckedMessages and RetentionDuration.

- oslogin/apiv1beta: New client for the Cloud OS Login API.

- rpcreplay: A package for recording and replaying gRPC traffic.

- spanner:
  - Add a ReadWithOptions that supports a row limit, as well as an index.
  - Support query plan and execution statistics.
  - Added [OpenCensus](http://opencensus.io) support.

- storage: Clarify checksum validation for gzipped files (it is not validated
  when the file is served uncompressed).


_December 11, 2017_

*v0.17.0*

- firestore BREAKING CHANGES:
  - Remove UpdateMap and UpdateStruct; rename UpdatePaths to Update.
    Change
        `docref.UpdateMap(ctx, map[string]interface{}{"a.b", 1})`
    to
        `docref.Update(ctx, []firestore.Update{{Path: "a.b", Value: 1}})`

    Change
        `docref.UpdateStruct(ctx, []string{"Field"}, aStruct)`
    to
        `docref.Update(ctx, []firestore.Update{{Path: "Field", Value: aStruct.Field}})`
  - Rename MergePaths to Merge; require args to be FieldPaths
  - A value stored as an integer can be read into a floating-point field, and vice versa.
- bigtable/cmd/cbt:
  - Support deleting a column.
  - Add regex option for row read.
- spanner: Mark stable.
- storage:
  - Add Reader.ContentEncoding method.
  - Fix handling of SignedURL headers.
- bigquery:
  - If Uploader.Put is called with no rows, it returns nil without making a
    call.
  - Schema inference supports the "nullable" option in struct tags for
    non-required fields.
  - TimePartitioning supports "Field".


_October 30, 2017_

*v0.16.0*

- Other bigquery changes:
  - `JobIterator.Next` returns `*Job`; removed `JobInfo` (BREAKING CHANGE).
  - UseStandardSQL is deprecated; set UseLegacySQL to true if you need
    Legacy SQL.
  - Uploader.Put will generate a random insert ID if you do not provide one.
  - Support time partitioning for load jobs.
  - Support dry-run queries.
  - A `Job` remembers its last retrieved status.
  - Support retrieving job configuration.
  - Support labels for jobs and tables.
  - Support dataset access lists.
  - Improve support for external data sources, including data from Bigtable and
    Google Sheets, and tables with external data.
  - Support updating a table's view configuration.
  - Fix uploading civil times with nanoseconds.

- storage:
  - Support PubSub notifications.
  - Support Requester Pays buckets.

- profiler: Support goroutine and mutex profile types.


_October 3, 2017_

*v0.15.0*

- firestore: beta release. See the
  [announcement](https://firebase.googleblog.com/2017/10/introducing-cloud-firestore.html).

- errorreporting: The existing package has been redesigned.

- errors: This package has been removed. Use errorreporting.


[Older news](https://github.com/GoogleCloudPlatform/google-cloud-go/blob/master/old-news.md)

## Supported APIs

Google API                       | Status       | Package
---------------------------------|--------------|-----------------------------------------------------------
[BigQuery][cloud-bigquery]       | stable       | [`cloud.google.com/go/bigquery`][cloud-bigquery-ref]
[Bigtable][cloud-bigtable]       | beta         | [`cloud.google.com/go/bigtable`][cloud-bigtable-ref]
[Container][cloud-container]     | alpha        | [`cloud.google.com/go/container/apiv1`][cloud-container-ref]
[Data Loss Prevention][cloud-dlp]| alpha        | [`cloud.google.com/go/dlp/apiv2beta1`][cloud-dlp-ref]
[Datastore][cloud-datastore]     | stable       | [`cloud.google.com/go/datastore`][cloud-datastore-ref]
[Debugger][cloud-debugger]       | alpha        | [`cloud.google.com/go/debugger/apiv2`][cloud-debugger-ref]
[ErrorReporting][cloud-errors]   | alpha        | [`cloud.google.com/go/errorreporting`][cloud-errors-ref]
[Firestore][cloud-firestore]     | beta         | [`cloud.google.com/go/firestore`][cloud-firestore-ref]
[Language][cloud-language]       | stable       | [`cloud.google.com/go/language/apiv1`][cloud-language-ref]
[Logging][cloud-logging]         | stable       | [`cloud.google.com/go/logging`][cloud-logging-ref]
[Monitoring][cloud-monitoring]   | beta         | [`cloud.google.com/go/monitoring/apiv3`][cloud-monitoring-ref]
[OS Login][cloud-oslogin]              | alpha        | [`cloud.google.com/compute/docs/oslogin/rest`][cloud-oslogin-ref]
[Pub/Sub][cloud-pubsub]          | beta         | [`cloud.google.com/go/pubsub`][cloud-pubsub-ref]
[Spanner][cloud-spanner]         | stable       | [`cloud.google.com/go/spanner`][cloud-spanner-ref]
[Speech][cloud-speech]           | stable       | [`cloud.google.com/go/speech/apiv1`][cloud-speech-ref]
[Storage][cloud-storage]         | stable       | [`cloud.google.com/go/storage`][cloud-storage-ref]
[Translation][cloud-translation] | stable       | [`cloud.google.com/go/translate`][cloud-translation-ref]
[Video Intelligence][cloud-video]| beta         | [`cloud.google.com/go/videointelligence/apiv1beta1`][cloud-video-ref]
[Vision][cloud-vision]           | stable       | [`cloud.google.com/go/vision/apiv1`][cloud-vision-ref]


> **Alpha status**: the API is still being actively developed. As a
> result, it might change in backward-incompatible ways and is not recommended
> for production use.
>
> **Beta status**: the API is largely complete, but still has outstanding
> features and bugs to be addressed. There may be minor backwards-incompatible
> changes where necessary.
>
> **Stable status**: the API is mature and ready for production use. We will
> continue addressing bugs and feature requests.

Documentation and examples are available at
https://godoc.org/cloud.google.com/go

Visit or join the
[google-api-go-announce group](https://groups.google.com/forum/#!forum/google-api-go-announce)
for updates on these packages.

## Go Versions Supported

We support the two most recent major versions of Go. If Google App Engine uses
an older version, we support that as well. You can see which versions are
currently supported by looking at the lines following `go:` in
[`.travis.yml`](.travis.yml).

## Authorization

By default, each API will use [Google Application Default Credentials][default-creds]
for authorization credentials used in calling the API endpoints. This will allow your
application to run in many environments without requiring explicit configuration.

[snip]:# (auth)
```go
client, err := storage.NewClient(ctx)
```

To authorize using a
[JSON key file](https://cloud.google.com/iam/docs/managing-service-account-keys),
pass
[`option.WithServiceAccountFile`](https://godoc.org/google.golang.org/api/option#WithServiceAccountFile)
to the `NewClient` function of the desired package. For example:

[snip]:# (auth-JSON)
```go
client, err := storage.NewClient(ctx, option.WithServiceAccountFile("path/to/keyfile.json"))
```

You can exert more control over authorization by using the
[`golang.org/x/oauth2`](https://godoc.org/golang.org/x/oauth2) package to
create an `oauth2.TokenSource`. Then pass
[`option.WithTokenSource`](https://godoc.org/google.golang.org/api/option#WithTokenSource)
to the `NewClient` function:
[snip]:# (auth-ts)
```go
tokenSource := ...
client, err := storage.NewClient(ctx, option.WithTokenSource(tokenSource))
```

## Cloud Datastore [![GoDoc](https://godoc.org/cloud.google.com/go/datastore?status.svg)](https://godoc.org/cloud.google.com/go/datastore)

- [About Cloud Datastore][cloud-datastore]
- [Activating the API for your project][cloud-datastore-activation]
- [API documentation][cloud-datastore-docs]
- [Go client documentation](https://godoc.org/cloud.google.com/go/datastore)
- [Complete sample program](https://github.com/GoogleCloudPlatform/golang-samples/tree/master/datastore/tasks)

### Example Usage

First create a `datastore.Client` to use throughout your application:

[snip]:# (datastore-1)
```go
client, err := datastore.NewClient(ctx, "my-project-id")
if err != nil {
	log.Fatal(err)
}
```

Then use that client to interact with the API:

[snip]:# (datastore-2)
```go
type Post struct {
	Title       string
	Body        string `datastore:",noindex"`
	PublishedAt time.Time
}
keys := []*datastore.Key{
	datastore.NameKey("Post", "post1", nil),
	datastore.NameKey("Post", "post2", nil),
}
posts := []*Post{
	{Title: "Post 1", Body: "...", PublishedAt: time.Now()},
	{Title: "Post 2", Body: "...", PublishedAt: time.Now()},
}
if _, err := client.PutMulti(ctx, keys, posts); err != nil {
	log.Fatal(err)
}
```

## Cloud Storage [![GoDoc](https://godoc.org/cloud.google.com/go/storage?status.svg)](https://godoc.org/cloud.google.com/go/storage)

- [About Cloud Storage][cloud-storage]
- [API documentation][cloud-storage-docs]
- [Go client documentation](https://godoc.org/cloud.google.com/go/storage)
- [Complete sample programs](https://github.com/GoogleCloudPlatform/golang-samples/tree/master/storage)

### Example Usage

First create a `storage.Client` to use throughout your application:

[snip]:# (storage-1)
```go
client, err := storage.NewClient(ctx)
if err != nil {
	log.Fatal(err)
}
```

[snip]:# (storage-2)
```go
// Read the object1 from bucket.
rc, err := client.Bucket("bucket").Object("object1").NewReader(ctx)
if err != nil {
	log.Fatal(err)
}
defer rc.Close()
body, err := ioutil.ReadAll(rc)
if err != nil {
	log.Fatal(err)
}
```

## Cloud Pub/Sub [![GoDoc](https://godoc.org/cloud.google.com/go/pubsub?status.svg)](https://godoc.org/cloud.google.com/go/pubsub)

- [About Cloud Pubsub][cloud-pubsub]
- [API documentation][cloud-pubsub-docs]
- [Go client documentation](https://godoc.org/cloud.google.com/go/pubsub)
- [Complete sample programs](https://github.com/GoogleCloudPlatform/golang-samples/tree/master/pubsub)

### Example Usage

First create a `pubsub.Client` to use throughout your application:

[snip]:# (pubsub-1)
```go
client, err := pubsub.NewClient(ctx, "project-id")
if err != nil {
	log.Fatal(err)
}
```

Then use the client to publish and subscribe:

[snip]:# (pubsub-2)
```go
// Publish "hello world" on topic1.
topic := client.Topic("topic1")
res := topic.Publish(ctx, &pubsub.Message{
	Data: []byte("hello world"),
})
// The publish happens asynchronously.
// Later, you can get the result from res:
...
msgID, err := res.Get(ctx)
if err != nil {
	log.Fatal(err)
}

// Use a callback to receive messages via subscription1.
sub := client.Subscription("subscription1")
err = sub.Receive(ctx, func(ctx context.Context, m *pubsub.Message) {
	fmt.Println(m.Data)
	m.Ack() // Acknowledge that we've consumed the message.
})
if err != nil {
	log.Println(err)
}
```

## Cloud BigQuery [![GoDoc](https://godoc.org/cloud.google.com/go/bigquery?status.svg)](https://godoc.org/cloud.google.com/go/bigquery)

- [About Cloud BigQuery][cloud-bigquery]
- [API documentation][cloud-bigquery-docs]
- [Go client documentation][cloud-bigquery-ref]
- [Complete sample programs](https://github.com/GoogleCloudPlatform/golang-samples/tree/master/bigquery)

### Example Usage

First create a `bigquery.Client` to use throughout your application:
[snip]:# (bq-1)
```go
c, err := bigquery.NewClient(ctx, "my-project-ID")
if err != nil {
	// TODO: Handle error.
}
```

Then use that client to interact with the API:
[snip]:# (bq-2)
```go
// Construct a query.
q := c.Query(`
    SELECT year, SUM(number)
    FROM [bigquery-public-data:usa_names.usa_1910_2013]
    WHERE name = "William"
    GROUP BY year
    ORDER BY year
`)
// Execute the query.
it, err := q.Read(ctx)
if err != nil {
	// TODO: Handle error.
}
// Iterate through the results.
for {
	var values []bigquery.Value
	err := it.Next(&values)
	if err == iterator.Done {
		break
	}
	if err != nil {
		// TODO: Handle error.
	}
	fmt.Println(values)
}
```


## Stackdriver Logging [![GoDoc](https://godoc.org/cloud.google.com/go/logging?status.svg)](https://godoc.org/cloud.google.com/go/logging)

- [About Stackdriver Logging][cloud-logging]
- [API documentation][cloud-logging-docs]
- [Go client documentation][cloud-logging-ref]
- [Complete sample programs](https://github.com/GoogleCloudPlatform/golang-samples/tree/master/logging)

### Example Usage

First create a `logging.Client` to use throughout your application:
[snip]:# (logging-1)
```go
ctx := context.Background()
client, err := logging.NewClient(ctx, "my-project")
if err != nil {
	// TODO: Handle error.
}
```

Usually, you'll want to add log entries to a buffer to be periodically flushed
(automatically and asynchronously) to the Stackdriver Logging service.
[snip]:# (logging-2)
```go
logger := client.Logger("my-log")
logger.Log(logging.Entry{Payload: "something happened!"})
```

Close your client before your program exits, to flush any buffered log entries.
[snip]:# (logging-3)
```go
err = client.Close()
if err != nil {
	// TODO: Handle error.
}
```

## Cloud Spanner [![GoDoc](https://godoc.org/cloud.google.com/go/spanner?status.svg)](https://godoc.org/cloud.google.com/go/spanner)

- [About Cloud Spanner][cloud-spanner]
- [API documentation][cloud-spanner-docs]
- [Go client documentation](https://godoc.org/cloud.google.com/go/spanner)

### Example Usage

First create a `spanner.Client` to use throughout your application:

[snip]:# (spanner-1)
```go
client, err := spanner.NewClient(ctx, "projects/P/instances/I/databases/D")
if err != nil {
	log.Fatal(err)
}
```

[snip]:# (spanner-2)
```go
// Simple Reads And Writes
_, err = client.Apply(ctx, []*spanner.Mutation{
	spanner.Insert("Users",
		[]string{"name", "email"},
		[]interface{}{"alice", "a@example.com"})})
if err != nil {
	log.Fatal(err)
}
row, err := client.Single().ReadRow(ctx, "Users",
	spanner.Key{"alice"}, []string{"email"})
if err != nil {
	log.Fatal(err)
}
```


## Contributing

Contributions are welcome. Please, see the
[CONTRIBUTING](https://github.com/GoogleCloudPlatform/google-cloud-go/blob/master/CONTRIBUTING.md)
document for details. We're using Gerrit for our code reviews. Please don't open pull
requests against this repo, new pull requests will be automatically closed.

Please note that this project is released with a Contributor Code of Conduct.
By participating in this project you agree to abide by its terms.
See [Contributor Code of Conduct](https://github.com/GoogleCloudPlatform/google-cloud-go/blob/master/CONTRIBUTING.md#contributor-code-of-conduct)
for more information.

[cloud-datastore]: https://cloud.google.com/datastore/
[cloud-datastore-ref]: https://godoc.org/cloud.google.com/go/datastore
[cloud-datastore-docs]: https://cloud.google.com/datastore/docs
[cloud-datastore-activation]: https://cloud.google.com/datastore/docs/activate

[cloud-firestore]: https://cloud.google.com/firestore/
[cloud-firestore-ref]: https://godoc.org/cloud.google.com/go/firestore
[cloud-firestore-docs]: https://cloud.google.com/firestore/docs
[cloud-firestore-activation]: https://cloud.google.com/firestore/docs/activate

[cloud-pubsub]: https://cloud.google.com/pubsub/
[cloud-pubsub-ref]: https://godoc.org/cloud.google.com/go/pubsub
[cloud-pubsub-docs]: https://cloud.google.com/pubsub/docs

[cloud-storage]: https://cloud.google.com/storage/
[cloud-storage-ref]: https://godoc.org/cloud.google.com/go/storage
[cloud-storage-docs]: https://cloud.google.com/storage/docs
[cloud-storage-create-bucket]: https://cloud.google.com/storage/docs/cloud-console#_creatingbuckets

[cloud-bigtable]: https://cloud.google.com/bigtable/
[cloud-bigtable-ref]: https://godoc.org/cloud.google.com/go/bigtable

[cloud-bigquery]: https://cloud.google.com/bigquery/
[cloud-bigquery-docs]: https://cloud.google.com/bigquery/docs
[cloud-bigquery-ref]: https://godoc.org/cloud.google.com/go/bigquery

[cloud-logging]: https://cloud.google.com/logging/
[cloud-logging-docs]: https://cloud.google.com/logging/docs
[cloud-logging-ref]: https://godoc.org/cloud.google.com/go/logging

[cloud-monitoring]: https://cloud.google.com/monitoring/
[cloud-monitoring-ref]: https://godoc.org/cloud.google.com/go/monitoring/apiv3

[cloud-vision]: https://cloud.google.com/vision
[cloud-vision-ref]: https://godoc.org/cloud.google.com/go/vision/apiv1

[cloud-language]: https://cloud.google.com/natural-language
[cloud-language-ref]: https://godoc.org/cloud.google.com/go/language/apiv1

[cloud-oslogin]: https://cloud.google.com/compute/docs/oslogin/rest
[cloud-oslogin-ref]: https://cloud.google.com/compute/docs/oslogin/rest

[cloud-speech]: https://cloud.google.com/speech
[cloud-speech-ref]: https://godoc.org/cloud.google.com/go/speech/apiv1

[cloud-spanner]: https://cloud.google.com/spanner/
[cloud-spanner-ref]: https://godoc.org/cloud.google.com/go/spanner
[cloud-spanner-docs]: https://cloud.google.com/spanner/docs

[cloud-translation]: https://cloud.google.com/translation
[cloud-translation-ref]: https://godoc.org/cloud.google.com/go/translation

[cloud-video]: https://cloud.google.com/video-intelligence/
[cloud-video-ref]: https://godoc.org/cloud.google.com/go/videointelligence/apiv1beta1

[cloud-errors]: https://cloud.google.com/error-reporting/
[cloud-errors-ref]: https://godoc.org/cloud.google.com/go/errorreporting

[cloud-container]: https://cloud.google.com/containers/
[cloud-container-ref]: https://godoc.org/cloud.google.com/go/container/apiv1

[cloud-debugger]: https://cloud.google.com/debugger/
[cloud-debugger-ref]: https://godoc.org/cloud.google.com/go/debugger/apiv2

[cloud-dlp]: https://cloud.google.com/dlp/
[cloud-dlp-ref]: https://godoc.org/cloud.google.com/go/dlp/apiv2beta1

[default-creds]: https://developers.google.com/identity/protocols/application-default-credentials
