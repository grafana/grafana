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
	"fmt"
	"io"
	"strings"
	"time"

	"google.golang.org/api/iterator"

	vkit "cloud.google.com/go/firestore/apiv1beta1"

	"cloud.google.com/go/internal/version"
	pb "google.golang.org/genproto/googleapis/firestore/v1beta1"

	"github.com/golang/protobuf/ptypes"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	"google.golang.org/grpc/metadata"
)

// resourcePrefixHeader is the name of the metadata header used to indicate
// the resource being operated on.
const resourcePrefixHeader = "google-cloud-resource-prefix"

// A Client provides access to the Firestore service.
type Client struct {
	c          *vkit.Client
	projectID  string
	databaseID string // A client is tied to a single database.
}

// NewClient creates a new Firestore client that uses the given project.
func NewClient(ctx context.Context, projectID string, opts ...option.ClientOption) (*Client, error) {
	vc, err := vkit.NewClient(ctx, opts...)
	if err != nil {
		return nil, err
	}
	vc.SetGoogleClientInfo("gccl", version.Repo)
	c := &Client{
		c:          vc,
		projectID:  projectID,
		databaseID: "(default)", // always "(default)", for now
	}
	return c, nil

}

// Close closes any resources held by the client.
//
// Close need not be called at program exit.
func (c *Client) Close() error {
	return c.c.Close()
}

func (c *Client) path() string {
	return fmt.Sprintf("projects/%s/databases/%s", c.projectID, c.databaseID)
}

func withResourceHeader(ctx context.Context, resource string) context.Context {
	md, _ := metadata.FromOutgoingContext(ctx)
	md = md.Copy()
	md[resourcePrefixHeader] = []string{resource}
	return metadata.NewOutgoingContext(ctx, md)
}

// Collection creates a reference to a collection with the given path.
// A path is a sequence of IDs separated by slashes.
//
// Collection returns nil if path contains an even number of IDs or any ID is empty.
func (c *Client) Collection(path string) *CollectionRef {
	coll, _ := c.idsToRef(strings.Split(path, "/"), c.path())
	return coll
}

// Doc creates a reference to a document with the given path.
// A path is a sequence of IDs separated by slashes.
//
// Doc returns nil if path contains an odd number of IDs or any ID is empty.
func (c *Client) Doc(path string) *DocumentRef {
	_, doc := c.idsToRef(strings.Split(path, "/"), c.path())
	return doc
}

func (c *Client) idsToRef(IDs []string, dbPath string) (*CollectionRef, *DocumentRef) {
	if len(IDs) == 0 {
		return nil, nil
	}
	for _, id := range IDs {
		if id == "" {
			return nil, nil
		}
	}
	coll := newTopLevelCollRef(c, dbPath, IDs[0])
	i := 1
	for i < len(IDs) {
		doc := newDocRef(coll, IDs[i])
		i++
		if i == len(IDs) {
			return nil, doc
		}
		coll = newCollRefWithParent(c, doc, IDs[i])
		i++
	}
	return coll, nil
}

// GetAll retrieves multiple documents with a single call. The DocumentSnapshots are
// returned in the order of the given DocumentRefs.
//
// If a document is not present, the corresponding DocumentSnapshot will be nil.
func (c *Client) GetAll(ctx context.Context, docRefs []*DocumentRef) ([]*DocumentSnapshot, error) {
	if err := checkTransaction(ctx); err != nil {
		return nil, err
	}
	var docNames []string
	for _, dr := range docRefs {
		if dr == nil {
			return nil, errNilDocRef
		}
		docNames = append(docNames, dr.Path)
	}
	req := &pb.BatchGetDocumentsRequest{
		Database:  c.path(),
		Documents: docNames,
	}
	streamClient, err := c.c.BatchGetDocuments(withResourceHeader(ctx, req.Database), req)
	if err != nil {
		return nil, err
	}

	// Read results from the stream and add them to a map.
	docMap := map[string]*pb.Document{}
	for {
		res, err := streamClient.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch x := res.Result.(type) {
		case *pb.BatchGetDocumentsResponse_Found:
			docMap[x.Found.Name] = x.Found

		case *pb.BatchGetDocumentsResponse_Missing:
			if docMap[x.Missing] != nil {
				return nil, fmt.Errorf("firestore: %q both missing and present", x.Missing)
			}
			docMap[x.Missing] = nil
		default:
			return nil, errors.New("firestore: unknown BatchGetDocumentsResponse result type")
		}
	}

	// Put the documents we've gathered in the same order as the requesting slice of
	// DocumentRefs.
	docs := make([]*DocumentSnapshot, len(docNames))
	for i, name := range docNames {
		pbDoc, ok := docMap[name]
		if !ok {
			return nil, fmt.Errorf("firestore: passed %q to BatchGetDocuments but never saw response", name)
		}
		if pbDoc != nil {
			doc, err := newDocumentSnapshot(docRefs[i], pbDoc, c)
			if err != nil {
				return nil, err
			}
			docs[i] = doc
		}
	}
	return docs, nil
}

// Collections returns an interator over the top-level collections.
func (c *Client) Collections(ctx context.Context) *CollectionIterator {
	it := &CollectionIterator{
		err:    checkTransaction(ctx),
		client: c,
		it: c.c.ListCollectionIds(
			withResourceHeader(ctx, c.path()),
			&pb.ListCollectionIdsRequest{Parent: c.path()}),
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.items) },
		func() interface{} { b := it.items; it.items = nil; return b })
	return it
}

// Batch returns a WriteBatch.
func (c *Client) Batch() *WriteBatch {
	return &WriteBatch{c: c}
}

// commit calls the Commit RPC outside of a transaction.
func (c *Client) commit(ctx context.Context, ws []*pb.Write) ([]*WriteResult, error) {
	if err := checkTransaction(ctx); err != nil {
		return nil, err
	}
	req := &pb.CommitRequest{
		Database: c.path(),
		Writes:   ws,
	}
	res, err := c.c.Commit(withResourceHeader(ctx, req.Database), req)
	if err != nil {
		return nil, err
	}
	if len(res.WriteResults) == 0 {
		return nil, errors.New("firestore: missing WriteResult")
	}
	var wrs []*WriteResult
	for _, pwr := range res.WriteResults {
		wr, err := writeResultFromProto(pwr)
		if err != nil {
			return nil, err
		}
		wrs = append(wrs, wr)
	}
	return wrs, nil
}

func (c *Client) commit1(ctx context.Context, ws []*pb.Write) (*WriteResult, error) {
	wrs, err := c.commit(ctx, ws)
	if err != nil {
		return nil, err
	}
	return wrs[0], nil
}

// A WriteResult is returned by methods that write documents.
type WriteResult struct {
	// The time at which the document was updated, or created if it did not
	// previously exist. Writes that do not actually change the document do
	// not change the update time.
	UpdateTime time.Time
}

func writeResultFromProto(wr *pb.WriteResult) (*WriteResult, error) {
	t, err := ptypes.Timestamp(wr.UpdateTime)
	if err != nil {
		t = time.Time{}
		// TODO(jba): Follow up if Delete is supposed to return a nil timestamp.
	}
	return &WriteResult{UpdateTime: t}, nil
}
