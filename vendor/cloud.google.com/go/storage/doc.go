// Copyright 2016 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
Package storage provides an easy way to work with Google Cloud Storage.
Google Cloud Storage stores data in named objects, which are grouped into buckets.

More information about Google Cloud Storage is available at
https://cloud.google.com/storage/docs.

See https://pkg.go.dev/cloud.google.com/go for authentication, timeouts,
connection pooling and similar aspects of this package.

# Creating a Client

To start working with this package, create a [Client]:

	ctx := context.Background()
	client, err := storage.NewClient(ctx)
	if err != nil {
	    // TODO: Handle error.
	}

The client will use your default application credentials. Clients should be
reused instead of created as needed. The methods of [Client] are safe for
concurrent use by multiple goroutines.

You may configure the client by passing in options from the [google.golang.org/api/option]
package. You may also use options defined in this package, such as [WithJSONReads].

If you only wish to access public data, you can create
an unauthenticated client with

	client, err := storage.NewClient(ctx, option.WithoutAuthentication())

To use an emulator with this library, you can set the STORAGE_EMULATOR_HOST
environment variable to the address at which your emulator is running. This will
send requests to that address instead of to Cloud Storage. You can then create
and use a client as usual:

	// Set STORAGE_EMULATOR_HOST environment variable.
	err := os.Setenv("STORAGE_EMULATOR_HOST", "localhost:9000")
	if err != nil {
	    // TODO: Handle error.
	}

	// Create client as usual.
	client, err := storage.NewClient(ctx)
	if err != nil {
	    // TODO: Handle error.
	}

	// This request is now directed to http://localhost:9000/storage/v1/b
	// instead of https://storage.googleapis.com/storage/v1/b
	if err := client.Bucket("my-bucket").Create(ctx, projectID, nil); err != nil {
	    // TODO: Handle error.
	}

Please note that there is no official emulator for Cloud Storage.

# Buckets

A Google Cloud Storage bucket is a collection of objects. To work with a
bucket, make a bucket handle:

	bkt := client.Bucket(bucketName)

A handle is a reference to a bucket. You can have a handle even if the
bucket doesn't exist yet. To create a bucket in Google Cloud Storage,
call [BucketHandle.Create]:

	if err := bkt.Create(ctx, projectID, nil); err != nil {
	    // TODO: Handle error.
	}

Note that although buckets are associated with projects, bucket names are
global across all projects.

Each bucket has associated metadata, represented in this package by
[BucketAttrs]. The third argument to [BucketHandle.Create] allows you to set
the initial [BucketAttrs] of a bucket. To retrieve a bucket's attributes, use
[BucketHandle.Attrs]:

	attrs, err := bkt.Attrs(ctx)
	if err != nil {
	    // TODO: Handle error.
	}
	fmt.Printf("bucket %s, created at %s, is located in %s with storage class %s\n",
	    attrs.Name, attrs.Created, attrs.Location, attrs.StorageClass)

# Objects

An object holds arbitrary data as a sequence of bytes, like a file. You
refer to objects using a handle, just as with buckets, but unlike buckets
you don't explicitly create an object. Instead, the first time you write
to an object it will be created. You can use the standard Go [io.Reader]
and [io.Writer] interfaces to read and write object data:

	obj := bkt.Object("data")
	// Write something to obj.
	// w implements io.Writer.
	w := obj.NewWriter(ctx)
	// Write some text to obj. This will either create the object or overwrite whatever is there already.
	if _, err := fmt.Fprintf(w, "This object contains text.\n"); err != nil {
	    // TODO: Handle error.
	}
	// Close, just like writing a file.
	if err := w.Close(); err != nil {
	    // TODO: Handle error.
	}

	// Read it back.
	r, err := obj.NewReader(ctx)
	if err != nil {
	    // TODO: Handle error.
	}
	defer r.Close()
	if _, err := io.Copy(os.Stdout, r); err != nil {
	    // TODO: Handle error.
	}
	// Prints "This object contains text."

Objects also have attributes, which you can fetch with [ObjectHandle.Attrs]:

	objAttrs, err := obj.Attrs(ctx)
	if err != nil {
	    // TODO: Handle error.
	}
	fmt.Printf("object %s has size %d and can be read using %s\n",
	    objAttrs.Name, objAttrs.Size, objAttrs.MediaLink)

# Listing objects

Listing objects in a bucket is done with the [BucketHandle.Objects] method:

	query := &storage.Query{Prefix: ""}

	var names []string
	it := bkt.Objects(ctx, query)
	for {
	    attrs, err := it.Next()
	    if err == iterator.Done {
	        break
	    }
	    if err != nil {
	        log.Fatal(err)
	    }
	    names = append(names, attrs.Name)
	}

Objects are listed lexicographically by name. To filter objects
lexicographically, [Query.StartOffset] and/or [Query.EndOffset] can be used:

	query := &storage.Query{
	    Prefix: "",
	    StartOffset: "bar/",  // Only list objects lexicographically >= "bar/"
	    EndOffset: "foo/",    // Only list objects lexicographically < "foo/"
	}

	// ... as before

If only a subset of object attributes is needed when listing, specifying this
subset using [Query.SetAttrSelection] may speed up the listing process:

	query := &storage.Query{Prefix: ""}
	query.SetAttrSelection([]string{"Name"})

	// ... as before

# ACLs

Both objects and buckets have ACLs (Access Control Lists). An ACL is a list of
ACLRules, each of which specifies the role of a user, group or project. ACLs
are suitable for fine-grained control, but you may prefer using IAM to control
access at the project level (see [Cloud Storage IAM docs].

To list the ACLs of a bucket or object, obtain an [ACLHandle] and call [ACLHandle.List]:

	acls, err := obj.ACL().List(ctx)
	if err != nil {
	    // TODO: Handle error.
	}
	for _, rule := range acls {
	    fmt.Printf("%s has role %s\n", rule.Entity, rule.Role)
	}

You can also set and delete ACLs.

# Conditions

Every object has a generation and a metageneration. The generation changes
whenever the content changes, and the metageneration changes whenever the
metadata changes. [Conditions] let you check these values before an operation;
the operation only executes if the conditions match. You can use conditions to
prevent race conditions in read-modify-write operations.

For example, say you've read an object's metadata into objAttrs. Now
you want to write to that object, but only if its contents haven't changed
since you read it. Here is how to express that:

	w = obj.If(storage.Conditions{GenerationMatch: objAttrs.Generation}).NewWriter(ctx)
	// Proceed with writing as above.

# Signed URLs

You can obtain a URL that lets anyone read or write an object for a limited time.
Signing a URL requires credentials authorized to sign a URL. To use the same
authentication that was used when instantiating the Storage client, use
[BucketHandle.SignedURL].

	url, err := client.Bucket(bucketName).SignedURL(objectName, opts)
	if err != nil {
	    // TODO: Handle error.
	}
	fmt.Println(url)

You can also sign a URL without creating a client. See the documentation of
[SignedURL] for details.

	url, err := storage.SignedURL(bucketName, "shared-object", opts)
	if err != nil {
	    // TODO: Handle error.
	}
	fmt.Println(url)

# Post Policy V4 Signed Request

A type of signed request that allows uploads through HTML forms directly to Cloud Storage with
temporary permission. Conditions can be applied to restrict how the HTML form is used and exercised
by a user.

For more information, please see the [XML POST Object docs] as well
as the documentation of [BucketHandle.GenerateSignedPostPolicyV4].

	pv4, err := client.Bucket(bucketName).GenerateSignedPostPolicyV4(objectName, opts)
	if err != nil {
	    // TODO: Handle error.
	}
	fmt.Printf("URL: %s\nFields; %v\n", pv4.URL, pv4.Fields)

# Credential requirements for signing

If the GoogleAccessID and PrivateKey option fields are not provided, they will
be automatically detected by [BucketHandle.SignedURL] and
[BucketHandle.GenerateSignedPostPolicyV4] if any of the following are true:
  - you are authenticated to the Storage Client with a service account's
    downloaded private key, either directly in code or by setting the
    GOOGLE_APPLICATION_CREDENTIALS environment variable (see [Other Environments]),
  - your application is running on Google Compute Engine (GCE), or
  - you are logged into [gcloud using application default credentials]
    with [impersonation enabled].

Detecting GoogleAccessID may not be possible if you are authenticated using a
token source or using [option.WithHTTPClient]. In this case, you can provide a
service account email for GoogleAccessID and the client will attempt to sign
the URL or Post Policy using that service account.

To generate the signature, you must have:
  - iam.serviceAccounts.signBlob permissions on the GoogleAccessID service
    account, and
  - the [IAM Service Account Credentials API] enabled (unless authenticating
    with a downloaded private key).

# Errors

Errors returned by this client are often of the type [googleapi.Error].
These errors can be introspected for more information by using [errors.As]
with the richer [googleapi.Error] type. For example:

	var e *googleapi.Error
	if ok := errors.As(err, &e); ok {
		  if e.Code == 409 { ... }
	}

# Retrying failed requests

Methods in this package may retry calls that fail with transient errors.
Retrying continues indefinitely unless the controlling context is canceled, the
client is closed, or a non-transient error is received. To stop retries from
continuing, use context timeouts or cancellation.

The retry strategy in this library follows best practices for Cloud Storage. By
default, operations are retried only if they are idempotent, and exponential
backoff with jitter is employed. In addition, errors are only retried if they
are defined as transient by the service. See the [Cloud Storage retry docs]
for more information.

Users can configure non-default retry behavior for a single library call (using
[BucketHandle.Retryer] and [ObjectHandle.Retryer]) or for all calls made by a
client (using [Client.SetRetry]). For example:

	o := client.Bucket(bucket).Object(object).Retryer(
		// Use WithBackoff to change the timing of the exponential backoff.
		storage.WithBackoff(gax.Backoff{
			Initial:    2 * time.Second,
		}),
		// Use WithPolicy to configure the idempotency policy. RetryAlways will
		// retry the operation even if it is non-idempotent.
		storage.WithPolicy(storage.RetryAlways),
	)

	// Use a context timeout to set an overall deadline on the call, including all
	// potential retries.
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Delete an object using the specified strategy and timeout.
	if err := o.Delete(ctx); err != nil {
		// Handle err.
	}

# Sending Custom Headers

You can add custom headers to any API call made by this package by using
[callctx.SetHeaders] on the context which is passed to the method. For example,
to add a [custom audit logging] header:

	ctx := context.Background()
	ctx = callctx.SetHeaders(ctx, "x-goog-custom-audit-<key>", "<value>")
	// Use client as usual with the context and the additional headers will be sent.
	client.Bucket("my-bucket").Attrs(ctx)

# gRPC API

This package includes support for the [Cloud Storage gRPC API]. This
implementation uses gRPC rather than the default JSON & XML APIs
to make requests to Cloud Storage. All methods on the [Client] support
the gRPC API, with the exception of [GetServiceAccount], [Notification],
and [HMACKey] methods.

The Cloud Storage gRPC API is generally available.

To create a client which will use gRPC, use the alternate constructor:

	ctx := context.Background()
	client, err := storage.NewGRPCClient(ctx)
	if err != nil {
		// TODO: Handle error.
	}
	// Use client as usual.

One major advantage of the gRPC API is that it can use [Direct Connectivity],
enabling requests to skip some proxy steps and reducing responce latency.
Requirements to use Direct Connectivity include:

  - Your application must be running inside Google Cloud.
  - Your Cloud Storage [bucket location] must overlap with your VM or compute
    environment zone. For example, if your VM is in us-east1a, your bucket
    must be located in either us-east1 (single region), nam4 (dual region),
    or us (multi-region).
  - Your client must use service account authentication.

Additional requirements for Direct Connectivity are documented in the
[Cloud Storage gRPC docs].

Dependencies for the gRPC API may slightly increase the size of binaries for
applications depending on this package. If you are not using gRPC, you can use
the build tag `disable_grpc_modules` to opt out of these dependencies and
reduce the binary size.

The gRPC client is instrumented with Open Telemetry metrics which export to
Cloud Monitoring by default. More information is available in the
[gRPC client-side metrics] documentation, including information about
roles which must be enabled in order to do the export successfully. To
disable this export, you can use the [WithDisabledClientMetrics] client
option.

# Storage Control API

Certain control plane and long-running operations for Cloud Storage (including Folder
and Managed Folder operations) are supported via the autogenerated Storage Control
client, which is available as a subpackage in this module. See package docs at
[cloud.google.com/go/storage/control/apiv2] or reference the [Storage Control API] docs.

[Cloud Storage IAM docs]: https://cloud.google.com/storage/docs/access-control/iam
[XML POST Object docs]: https://cloud.google.com/storage/docs/xml-api/post-object
[Cloud Storage retry docs]: https://cloud.google.com/storage/docs/retry-strategy
[Other Environments]: https://cloud.google.com/storage/docs/authentication#libauth
[gcloud using application default credentials]: https://cloud.google.com/sdk/gcloud/reference/auth/application-default/login
[impersonation enabled]: https://cloud.google.com/sdk/gcloud/reference#--impersonate-service-account
[IAM Service Account Credentials API]: https://console.developers.google.com/apis/api/iamcredentials.googleapis.com/overview
[custom audit logging]: https://cloud.google.com/storage/docs/audit-logging#add-custom-metadata
[Storage Control API]: https://cloud.google.com/storage/docs/reference/rpc/google.storage.control.v2
[Cloud Storage gRPC API]: https://cloud.google.com/storage/docs/enable-grpc-api
[Direct Connectivity]: https://cloud.google.com/vpc-service-controls/docs/set-up-private-connectivity#direct-connectivity
[bucket location]: https://cloud.google.com/storage/docs/locations
[Cloud Storage gRPC docs]: https://cloud.google.com/storage/docs/enable-grpc-api#limitations
[gRPC client-side metrics]: https://cloud.google.com/storage/docs/client-side-metrics
*/
package storage // import "cloud.google.com/go/storage"
