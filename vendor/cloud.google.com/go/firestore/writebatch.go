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

package firestore

import (
	"errors"

	pb "google.golang.org/genproto/googleapis/firestore/v1beta1"

	"golang.org/x/net/context"
)

// A WriteBatch holds multiple database updates. Build a batch with the Create, Set,
// Update and Delete methods, then run it with the Commit method. Errors in Create,
// Set, Update or Delete are recorded instead of being returned immediately. The
// first such error is returned by Commit.
type WriteBatch struct {
	c      *Client
	err    error
	writes []*pb.Write
}

func (b *WriteBatch) add(ws []*pb.Write, err error) *WriteBatch {
	if b.err != nil {
		return b
	}
	if err != nil {
		b.err = err
		return b
	}
	b.writes = append(b.writes, ws...)
	return b
}

// Create adds a Create operation to the batch.
// See DocumentRef.Create for details.
func (b *WriteBatch) Create(dr *DocumentRef, data interface{}) *WriteBatch {
	return b.add(dr.newCreateWrites(data))
}

// Set adds a Set operation to the batch.
// See DocumentRef.Set for details.
func (b *WriteBatch) Set(dr *DocumentRef, data interface{}, opts ...SetOption) *WriteBatch {
	return b.add(dr.newSetWrites(data, opts))
}

// Delete adds a Delete operation to the batch.
// See DocumentRef.Delete for details.
func (b *WriteBatch) Delete(dr *DocumentRef, opts ...Precondition) *WriteBatch {
	return b.add(dr.newDeleteWrites(opts))
}

// Update adds an Update operation to the batch.
// See DocumentRef.Update for details.
func (b *WriteBatch) Update(dr *DocumentRef, data []Update, opts ...Precondition) *WriteBatch {
	return b.add(dr.newUpdatePathWrites(data, opts))
}

// Commit applies all the writes in the batch to the database atomically. Commit
// returns an error if there are no writes in the batch, if any errors occurred in
// constructing the writes, or if the Commmit operation fails.
func (b *WriteBatch) Commit(ctx context.Context) ([]*WriteResult, error) {
	if b.err != nil {
		return nil, b.err
	}
	if len(b.writes) == 0 {
		return nil, errors.New("firestore: cannot commit empty WriteBatch")
	}
	return b.c.commit(ctx, b.writes)
}
