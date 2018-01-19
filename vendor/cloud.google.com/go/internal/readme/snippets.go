// Copyright 2017 Google Inc. All Rights Reserved.
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

// This file holds samples that are embedded into README.md.

// This file has to compile, but need not execute.
// If it fails to compile, fix it, then run `make` to regenerate README.md.

package readme

import (
	"fmt"
	"io/ioutil"
	"log"
	"time"

	"cloud.google.com/go/bigquery"
	"cloud.google.com/go/datastore"
	"cloud.google.com/go/logging"
	"cloud.google.com/go/pubsub"
	"cloud.google.com/go/spanner"
	"cloud.google.com/go/storage"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

var ctx context.Context

const END = 0

func auth() {
	//[ auth
	client, err := storage.NewClient(ctx)
	//]
	_ = client
	_ = err
}

func auth2() {
	//[ auth-JSON
	client, err := storage.NewClient(ctx, option.WithServiceAccountFile("path/to/keyfile.json"))
	//]
	_ = client
	_ = err
}

func auth3() {
	var ELLIPSIS oauth2.TokenSource
	//[ auth-ts
	tokenSource := ELLIPSIS
	client, err := storage.NewClient(ctx, option.WithTokenSource(tokenSource))
	//]
	_ = client
	_ = err
}

func datastoreSnippets() {
	//[ datastore-1
	client, err := datastore.NewClient(ctx, "my-project-id")
	if err != nil {
		log.Fatal(err)
	}
	//]

	//[ datastore-2
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
	//]
}

func storageSnippets() {
	//[ storage-1
	client, err := storage.NewClient(ctx)
	if err != nil {
		log.Fatal(err)
	}
	//]

	//[ storage-2
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
	//]
	_ = body
}

func pubsubSnippets() {
	//[ pubsub-1
	client, err := pubsub.NewClient(ctx, "project-id")
	if err != nil {
		log.Fatal(err)
	}
	//]

	const ELLIPSIS = 0

	//[ pubsub-2
	// Publish "hello world" on topic1.
	topic := client.Topic("topic1")
	res := topic.Publish(ctx, &pubsub.Message{
		Data: []byte("hello world"),
	})
	// The publish happens asynchronously.
	// Later, you can get the result from res:
	_ = ELLIPSIS
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
	//]
	_ = msgID
}

func bqSnippets() {
	//[ bq-1
	c, err := bigquery.NewClient(ctx, "my-project-ID")
	if err != nil {
		// TODO: Handle error.
	}
	//]

	//[ bq-2
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
	//]
}

func loggingSnippets() {
	//[ logging-1
	ctx := context.Background()
	client, err := logging.NewClient(ctx, "my-project")
	if err != nil {
		// TODO: Handle error.
	}
	//]
	//[ logging-2
	logger := client.Logger("my-log")
	logger.Log(logging.Entry{Payload: "something happened!"})
	//]

	//[ logging-3
	err = client.Close()
	if err != nil {
		// TODO: Handle error.
	}
	//]
}

func spannerSnippets() {
	//[ spanner-1
	client, err := spanner.NewClient(ctx, "projects/P/instances/I/databases/D")
	if err != nil {
		log.Fatal(err)
	}
	//]

	//[ spanner-2
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
	//]
	_ = row
}
