// Copyright 2015 Google Inc. All Rights Reserved.
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
Package bigquery provides a client for the BigQuery service.

Note: This package is in beta.  Some backwards-incompatible changes may occur.

The following assumes a basic familiarity with BigQuery concepts.
See https://cloud.google.com/bigquery/docs.


Creating a Client

To start working with this package, create a client:

    ctx := context.Background()
    client, err := bigquery.NewClient(ctx, projectID)
    if err != nil {
        // TODO: Handle error.
    }

Querying

To query existing tables, create a Query and call its Read method:

    q := client.Query(`
        SELECT year, SUM(number) as num
        FROM [bigquery-public-data:usa_names.usa_1910_2013]
        WHERE name = "William"
        GROUP BY year
        ORDER BY year
    `)
    it, err := q.Read(ctx)
    if err != nil {
        // TODO: Handle error.
    }

Then iterate through the resulting rows. You can store a row using
anything that implements the ValueLoader interface, or with a slice or map of bigquery.Value.
A slice is simplest:

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

You can also use a struct whose exported fields match the query:

    type Count struct {
        Year int
        Num  int
    }
    for {
        var c Count
        err := it.Next(&c)
        if err == iterator.Done {
            break
        }
        if err != nil {
            // TODO: Handle error.
        }
        fmt.Println(c)
    }

You can also start the query running and get the results later.
Create the query as above, but call Run instead of Read. This returns a Job,
which represents an asychronous operation.

    job, err := q.Run(ctx)
    if err != nil {
        // TODO: Handle error.
    }

Get the job's ID, a printable string. You can save this string to retrieve
the results at a later time, even in another process.

    jobID := job.ID()
    fmt.Printf("The job ID is %s\n", jobID)

To retrieve the job's results from the ID, first look up the Job:

    job, err = client.JobFromID(ctx, jobID)
    if err != nil {
        // TODO: Handle error.
    }

Use the Job.Read method to obtain an iterator, and loop over the rows.
Query.Read is just a convenience method that combines Query.Run and Job.Read.

    it, err = job.Read(ctx)
    if err != nil {
        // TODO: Handle error.
    }
    // Proceed with iteration as above.

Datasets and Tables

You can refer to datasets in the client's project with the Dataset method, and
in other projects with the DatasetInProject method:

    myDataset := client.Dataset("my_dataset")
    yourDataset := client.DatasetInProject("your-project-id", "your_dataset")

These methods create references to datasets, not the datasets themselves. You can have
a dataset reference even if the dataset doesn't exist yet. Use Dataset.Create to
create a dataset from a reference:

    if err := myDataset.Create(ctx, nil); err != nil {
        // TODO: Handle error.
    }

You can refer to tables with Dataset.Table. Like bigquery.Dataset, bigquery.Table is a reference
to an object in BigQuery that may or may not exist.

    table := myDataset.Table("my_table")

You can create, delete and update the metadata of tables with methods on Table.
For instance, you could create a temporary table with:

    err = myDataset.Table("temp").Create(ctx, &bigquery.TableMetadata{
        ExpirationTime: time.Now().Add(1*time.Hour)})
    if err != nil {
        // TODO: Handle error.
    }

We'll see how to create a table with a schema in the next section.

Schemas

There are two ways to construct schemas with this package.
You can build a schema by hand, like so:

    schema1 := bigquery.Schema{
        &bigquery.FieldSchema{Name: "Name", Required: true, Type: bigquery.StringFieldType},
        &bigquery.FieldSchema{Name: "Grades", Repeated: true, Type: bigquery.IntegerFieldType},
    }

Or you can infer the schema from a struct:

    type student struct {
        Name   string
        Grades []int
    }
    schema2, err := bigquery.InferSchema(student{})
    if err != nil {
        // TODO: Handle error.
    }
    // schema1 and schema2 are identical.

Struct inference supports tags like those of the encoding/json package,
so you can change names, ignore fields, or mark a field as nullable (non-required):

    type student2 struct {
        Name     string `bigquery:"full_name"`
        Grades   []int
        Secret   string `bigquery:"-"`
        Optional int    `bigquery:",nullable"
    }
    schema3, err := bigquery.InferSchema(student2{})
    if err != nil {
        // TODO: Handle error.
    }
    // schema3 has required fields "full_name", "Grade" and nullable field "Optional".

Having constructed a schema, you can create a table with it like so:

    if err := table.Create(ctx, &bigquery.TableMetadata{Schema: schema1}); err != nil {
        // TODO: Handle error.
    }

Copying

You can copy one or more tables to another table. Begin by constructing a Copier
describing the copy. Then set any desired copy options, and finally call Run to get a Job:

    copier := myDataset.Table("dest").CopierFrom(myDataset.Table("src"))
    copier.WriteDisposition = bigquery.WriteTruncate
    job, err = copier.Run(ctx)
    if err != nil {
        // TODO: Handle error.
    }

You can chain the call to Run if you don't want to set options:

    job, err = myDataset.Table("dest").CopierFrom(myDataset.Table("src")).Run(ctx)
    if err != nil {
        // TODO: Handle error.
    }

You can wait for your job to complete:

    status, err := job.Wait(ctx)
    if err != nil {
        // TODO: Handle error.
    }

Job.Wait polls with exponential backoff. You can also poll yourself, if you
wish:

    for {
        status, err := job.Status(ctx)
        if err != nil {
            // TODO: Handle error.
        }
        if status.Done() {
            if status.Err() != nil {
                log.Fatalf("Job failed with error %v", status.Err())
            }
            break
        }
        time.Sleep(pollInterval)
    }

Loading and Uploading

There are two ways to populate a table with this package: load the data from a Google Cloud Storage
object, or upload rows directly from your program.

For loading, first create a GCSReference, configuring it if desired. Then make a Loader, optionally configure
it as well, and call its Run method.

    gcsRef := bigquery.NewGCSReference("gs://my-bucket/my-object")
    gcsRef.AllowJaggedRows = true
    loader := myDataset.Table("dest").LoaderFrom(gcsRef)
    loader.CreateDisposition = bigquery.CreateNever
    job, err = loader.Run(ctx)
    // Poll the job for completion if desired, as above.

To upload, first define a type that implements the ValueSaver interface, which has a single method named Save.
Then create an Uploader, and call its Put method with a slice of values.

    u := table.Uploader()
    // Item implements the ValueSaver interface.
    items := []*Item{
        {Name: "n1", Size: 32.6, Count: 7},
        {Name: "n2", Size: 4, Count: 2},
        {Name: "n3", Size: 101.5, Count: 1},
    }
    if err := u.Put(ctx, items); err != nil {
        // TODO: Handle error.
    }

You can also upload a struct that doesn't implement ValueSaver. Use the StructSaver type
to specify the schema and insert ID by hand, or just supply the struct or struct pointer
directly and the schema will be inferred:

    type Item2 struct {
        Name  string
        Size  float64
        Count int
    }
    // Item implements the ValueSaver interface.
    items2 := []*Item2{
        {Name: "n1", Size: 32.6, Count: 7},
        {Name: "n2", Size: 4, Count: 2},
        {Name: "n3", Size: 101.5, Count: 1},
    }
    if err := u.Put(ctx, items2); err != nil {
        // TODO: Handle error.
    }

Extracting

If you've been following so far, extracting data from a BigQuery table
into a Google Cloud Storage object will feel familiar. First create an
Extractor, then optionally configure it, and lastly call its Run method.

    extractor := table.ExtractorTo(gcsRef)
    extractor.DisableHeader = true
    job, err = extractor.Run(ctx)
    // Poll the job for completion if desired, as above.

Authentication

See examples of authorization and authentication at
https://godoc.org/cloud.google.com/go#pkg-examples.
*/
package bigquery // import "cloud.google.com/go/bigquery"
