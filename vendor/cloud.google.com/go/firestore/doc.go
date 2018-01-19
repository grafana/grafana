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

// DO NOT EDIT doc.go. Modify internal/doc.template, then run make -C internal.

/*
Package firestore provides a client for reading and writing to a Cloud Firestore
database.

See https://cloud.google.com/firestore/docs for an introduction
to Cloud Firestore and additional help on using the Firestore API.

Creating a Client

To start working with this package, create a client with a project ID:

	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "projectID")
	if err != nil {
		// TODO: Handle error.
	}

CollectionRefs and DocumentRefs

In Firestore, documents are sets of key-value pairs, and collections are groups of
documents. A Firestore database consists of a hierarchy of alternating collections
and documents, referred to by slash-separated paths like
"States/California/Cities/SanFrancisco".

This client is built around references to collections and documents. CollectionRefs
and DocumentRefs are lightweight values that refer to the corresponding database
entities. Creating a ref does not involve any network traffic.

	states := client.Collection("States")
	ny := states.Doc("NewYork")
	// Or, in a single call:
	ny = client.Doc("States/NewYork")

Reading

Use DocumentRef.Get to read a document. The result is a DocumentSnapshot.
Call its Data method to obtain the entire document contents as a map.

	docsnap, err := ny.Get(ctx)
	if err != nil {
		// TODO: Handle error.
	}
	dataMap := docsnap.Data()
	fmt.Println(dataMap)

You can also obtain a single field with DataAt, or extract the data into a struct
with DataTo. With the type definition

	type State struct {
		Capital    string  `firestore:"capital"`
		Population float64 `firestore:"pop"` // in millions
	}

we can extract the document's data into a value of type State:

	var nyData State
	if err := docsnap.DataTo(&nyData); err != nil {
		// TODO: Handle error.
	}

Note that this client supports struct tags beginning with "firestore:" that work like
the tags of the encoding/json package, letting you rename fields, ignore them, or
omit their values when empty.

To retrieve multiple documents from their references in a single call, use
Client.GetAll.

	docsnaps, err := client.GetAll(ctx, []*firestore.DocumentRef{
		states.Doc("Wisconsin"), states.Doc("Ohio"),
	})
	if err != nil {
		// TODO: Handle error.
	}
	for _, ds := range docsnaps {
		_ = ds // TODO: Use ds.
	}


Writing

For writing individual documents, use the methods on DocumentReference.
Create creates a new document.

	wr, err := ny.Create(ctx, State{
		Capital:    "Albany",
		Population: 19.8,
	})
	if err != nil {
		// TODO: Handle error.
	}
	fmt.Println(wr)

The first return value is a WriteResult, which contains the time
at which the document was updated.

Create fails if the document exists. Another method, Set, either replaces an existing
document or creates a new one.

	ca := states.Doc("California")
	_, err = ca.Set(ctx, State{
		Capital:    "Sacramento",
		Population: 39.14,
	})

To update some fields of an existing document, use Update. It takes a list of
paths to update and their corresponding values.

	_, err = ca.Update(ctx, []firestore.Update{{Path: "capital", Value: "Sacramento"}})

Use DocumentRef.Delete to delete a document.

	_, err = ny.Delete(ctx)

Preconditions

You can condition Deletes or Updates on when a document was last changed. Specify
these preconditions as an option to a Delete or Update method. The check and the
write happen atomically with a single RPC.

	docsnap, err = ca.Get(ctx)
	if err != nil {
		// TODO: Handle error.
	}
	_, err = ca.Update(ctx,
		[]firestore.Update{{Path: "capital", Value: "Sacramento"}},
		firestore.LastUpdateTime(docsnap.UpdateTime))

Here we update a doc only if it hasn't changed since we read it.
You could also do this with a transaction.

To perform multiple writes at once, use a WriteBatch. Its methods chain
for convenience.

WriteBatch.Commit sends the collected writes to the server, where they happen
atomically.

	writeResults, err := client.Batch().
		Create(ny, State{Capital: "Albany"}).
		Update(ca, []firestore.Update{{Path: "capital", Value: "Sacramento"}}).
		Delete(client.Doc("States/WestDakota")).
		Commit(ctx)

Queries

You can use SQL to select documents from a collection. Begin with the collection, and
build up a query using Select, Where and other methods of Query.

	q := states.Where("pop", ">", 10).OrderBy("pop", firestore.Desc)

Call the Query's Documents method to get an iterator, and use it like
the other Google Cloud Client iterators.

	iter := q.Documents(ctx)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			// TODO: Handle error.
		}
		fmt.Println(doc.Data())
	}

To get all the documents in a collection, you can use the collection itself
as a query.

	iter = client.Collection("States").Documents(ctx)

Transactions

Use a transaction to execute reads and writes atomically. All reads must happen
before any writes. Transaction creation, commit, rollback and retry are handled for
you by the Client.RunTransaction method; just provide a function and use the
read and write methods of the Transaction passed to it.

	ny := client.Doc("States/NewYork")
	err := client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		doc, err := tx.Get(ny) // tx.Get, NOT ny.Get!
		if err != nil {
			return err
		}
		pop, err := doc.DataAt("pop")
		if err != nil {
			return err
		}
		return tx.Update(ny, []firestore.Update{{Path: "pop", Value: pop.(float64) + 0.2}})
	})
	if err != nil {
		// TODO: Handle error.
	}

Authentication

See examples of authorization and authentication at
https://godoc.org/cloud.google.com/go#pkg-examples.
*/
package firestore
