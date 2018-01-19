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

package datastore

import (
	"fmt"

	gax "github.com/googleapis/gax-go"

	"cloud.google.com/go/internal"
	"cloud.google.com/go/internal/version"
	"golang.org/x/net/context"
	pb "google.golang.org/genproto/googleapis/datastore/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// datastoreClient is a wrapper for the pb.DatastoreClient that includes gRPC
// metadata to be sent in each request for server-side traffic management.
type datastoreClient struct {
	// Embed so we still implement the DatastoreClient interface,
	// if the interface adds more methods.
	pb.DatastoreClient

	c  pb.DatastoreClient
	md metadata.MD
}

func newDatastoreClient(conn *grpc.ClientConn, projectID string) pb.DatastoreClient {
	return &datastoreClient{
		c: pb.NewDatastoreClient(conn),
		md: metadata.Pairs(
			resourcePrefixHeader, "projects/"+projectID,
			"x-goog-api-client", fmt.Sprintf("gl-go/%s gccl/%s grpc/", version.Go(), version.Repo)),
	}
}

func (dc *datastoreClient) Lookup(ctx context.Context, in *pb.LookupRequest, opts ...grpc.CallOption) (res *pb.LookupResponse, err error) {
	err = dc.invoke(ctx, func(ctx context.Context) error {
		res, err = dc.c.Lookup(ctx, in, opts...)
		return err
	})
	return res, err
}

func (dc *datastoreClient) RunQuery(ctx context.Context, in *pb.RunQueryRequest, opts ...grpc.CallOption) (res *pb.RunQueryResponse, err error) {
	err = dc.invoke(ctx, func(ctx context.Context) error {
		res, err = dc.c.RunQuery(ctx, in, opts...)
		return err
	})
	return res, err
}

func (dc *datastoreClient) BeginTransaction(ctx context.Context, in *pb.BeginTransactionRequest, opts ...grpc.CallOption) (res *pb.BeginTransactionResponse, err error) {
	err = dc.invoke(ctx, func(ctx context.Context) error {
		res, err = dc.c.BeginTransaction(ctx, in, opts...)
		return err
	})
	return res, err
}

func (dc *datastoreClient) Commit(ctx context.Context, in *pb.CommitRequest, opts ...grpc.CallOption) (res *pb.CommitResponse, err error) {
	err = dc.invoke(ctx, func(ctx context.Context) error {
		res, err = dc.c.Commit(ctx, in, opts...)
		return err
	})
	return res, err
}

func (dc *datastoreClient) Rollback(ctx context.Context, in *pb.RollbackRequest, opts ...grpc.CallOption) (res *pb.RollbackResponse, err error) {
	err = dc.invoke(ctx, func(ctx context.Context) error {
		res, err = dc.c.Rollback(ctx, in, opts...)
		return err
	})
	return res, err
}

func (dc *datastoreClient) AllocateIds(ctx context.Context, in *pb.AllocateIdsRequest, opts ...grpc.CallOption) (res *pb.AllocateIdsResponse, err error) {
	err = dc.invoke(ctx, func(ctx context.Context) error {
		res, err = dc.c.AllocateIds(ctx, in, opts...)
		return err
	})
	return res, err
}

func (dc *datastoreClient) invoke(ctx context.Context, f func(ctx context.Context) error) error {
	ctx = metadata.NewOutgoingContext(ctx, dc.md)
	return internal.Retry(ctx, gax.Backoff{}, func() (stop bool, err error) {
		err = f(ctx)
		return !shouldRetry(err), err
	})
}

func shouldRetry(err error) bool {
	if err == nil {
		return false
	}
	s, ok := status.FromError(err)
	if !ok {
		return false
	}
	// See https://cloud.google.com/datastore/docs/concepts/errors.
	return s.Code() == codes.Unavailable || s.Code() == codes.DeadlineExceeded
}
