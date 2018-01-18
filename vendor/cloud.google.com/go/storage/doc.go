// Copyright 2016 Google Inc. All Rights Reserved.
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

All of the methods of this package use exponential backoff to retry calls
that fail with certain errors, as described in
https://cloud.google.com/storage/docs/exponential-backoff.

Note: This package is in beta.  Some backwards-incompatible changes may occur.


Creating a Client

To start working with this package, create a client:

    ctx := context.Background()
    client, err := storage.NewClient(ctx)
    if err != nil {
        // TODO: Handle error.
    }

Buckets

A Google Cloud Storage bucket is a collection of objects. To work with a
bucket, make a bucket handle:

    bkt := client.Bucket(bucketName)

A handle is a reference to a bucket. You can have a handle even if the
bucket doesn't exist yet. To create a bucket in Google Cloud Storage,
call Create on the handle:

    if err := bkt.Create(ctx, projectID, nil); err != nil {
        // TODO: Handle error.
    }

Note that although buckets are associated with projects, bucket names are
global across all projects.

Each bucket has associated metadata, represented in this package by
BucketAttrs. The third argument to BucketHandle.Create allows you to set
the intial BucketAttrs of a bucket. To retrieve a bucket's attributes, use
Attrs:

    attrs, err := bkt.Attrs(ctx)
    if err != nil {
        // TODO: Handle error.
    }
    fmt.Printf("bucket %s, created at %s, is located in %s with storage class %s\n",
        attrs.Name, attrs.Created, attrs.Location, attrs.StorageClass)

Objects

An object holds arbitrary data as a sequence of bytes, like a file. You
refer to objects using a handle, just as with buckets. You can use the
standard Go io.Reader and io.Writer interfaces to read and write
object data:

    obj := bkt.Object("data")
    // Write something to obj.
    // w implements io.Writer.
    w := obj.NewWriter(ctx)
    // Write some text to obj. This will overwrite whatever is there.
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

Objects also have attributes, which you can fetch with Attrs:

    objAttrs, err := obj.Attrs(ctx)
    if err != nil {
        // TODO: Handle error.
    }
    fmt.Printf("object %s has size %d and can be read using %s\n",
        objAttrs.Name, objAttrs.Size, objAttrs.MediaLink)

ACLs

Both objects and buckets have ACLs (Access Control Lists). An ACL is a list of
ACLRules, each of which specifies the role of a user, group or project. ACLs
are suitable for fine-grained control, but you may prefer using IAM to control
access at the project level (see
https://cloud.google.com/storage/docs/access-control/iam).

To list the ACLs of a bucket or object, obtain an ACLHandle and call its List method:

    acls, err := obj.ACL().List(ctx)
    if err != nil {
        // TODO: Handle error.
    }
    for _, rule := range acls {
        fmt.Printf("%s has role %s\n", rule.Entity, rule.Role)
    }

You can also set and delete ACLs.

Conditions

Every object has a generation and a metageneration. The generation changes
whenever the content changes, and the metageneration changes whenever the
metadata changes. Conditions let you check these values before an operation;
the operation only executes if the conditions match. You can use conditions to
prevent race conditions in read-modify-write operations.

For example, say you've read an object's metadata into objAttrs. Now
you want to write to that object, but only if its contents haven't changed
since you read it. Here is how to express that:

    w = obj.If(storage.Conditions{GenerationMatch: objAttrs.Generation}).NewWriter(ctx)
    // Proceed with writing as above.

Signed URLs

You can obtain a URL that lets anyone read or write an object for a limited time.
You don't need to create a client to do this. See the documentation of
SignedURL for details.

    url, err := storage.SignedURL(bucketName, "shared-object", opts)
    if err != nil {
        // TODO: Handle error.
    }
    fmt.Println(url)

Authentication

See examples of authorization and authentication at
https://godoc.org/cloud.google.com/go#pkg-examples.
*/
package storage // import "cloud.google.com/go/storage"
