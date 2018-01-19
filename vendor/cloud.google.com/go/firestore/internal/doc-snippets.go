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

package internal

import (
	"fmt"

	firestore "cloud.google.com/go/firestore"

	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
)

const ELLIPSIS = 0

//[ structDef
type State struct {
	Capital    string  `firestore:"capital"`
	Population float64 `firestore:"pop"` // in millions
}

//]

func f1() {
	//[ NewClient
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "projectID")
	if err != nil {
		// TODO: Handle error.
	}
	//]
	//[ refs
	states := client.Collection("States")
	ny := states.Doc("NewYork")
	// Or, in a single call:
	ny = client.Doc("States/NewYork")
	//]
	//[ docref.Get
	docsnap, err := ny.Get(ctx)
	if err != nil {
		// TODO: Handle error.
	}
	dataMap := docsnap.Data()
	fmt.Println(dataMap)
	//]
	//[ DataTo
	var nyData State
	if err := docsnap.DataTo(&nyData); err != nil {
		// TODO: Handle error.
	}
	//]
	//[ GetAll
	docsnaps, err := client.GetAll(ctx, []*firestore.DocumentRef{
		states.Doc("Wisconsin"), states.Doc("Ohio"),
	})
	if err != nil {
		// TODO: Handle error.
	}
	for _, ds := range docsnaps {
		_ = ds // TODO: Use ds.
	}
	//[ docref.Create
	wr, err := ny.Create(ctx, State{
		Capital:    "Albany",
		Population: 19.8,
	})
	if err != nil {
		// TODO: Handle error.
	}
	fmt.Println(wr)
	//]
	//[ docref.Set
	ca := states.Doc("California")
	_, err = ca.Set(ctx, State{
		Capital:    "Sacramento",
		Population: 39.14,
	})
	//]

	//[ docref.Update
	_, err = ca.Update(ctx, []firestore.Update{{Path: "capital", Value: "Sacramento"}})
	//]

	//[ docref.Delete
	_, err = ny.Delete(ctx)
	//]

	//[ LUT-precond
	docsnap, err = ca.Get(ctx)
	if err != nil {
		// TODO: Handle error.
	}
	_, err = ca.Update(ctx,
		[]firestore.Update{{Path: "capital", Value: "Sacramento"}},
		firestore.LastUpdateTime(docsnap.UpdateTime))
	//]

	//[ WriteBatch
	writeResults, err := client.Batch().
		Create(ny, State{Capital: "Albany"}).
		Update(ca, []firestore.Update{{Path: "capital", Value: "Sacramento"}}).
		Delete(client.Doc("States/WestDakota")).
		Commit(ctx)
	//]
	_ = writeResults

	//[ Query
	q := states.Where("pop", ">", 10).OrderBy("pop", firestore.Desc)
	//]
	//[ Documents
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
	//]

	//[ CollQuery
	iter = client.Collection("States").Documents(ctx)
	//]
}

func txn() {
	var ctx context.Context
	var client *firestore.Client
	//[ Transaction
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
	//]
}
