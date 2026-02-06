// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package api

import (
	"context"
	"github.com/influxdata/influxdb-client-go/v2/domain"
	"time"
)

// DeleteAPI provides methods for deleting time series data from buckets.
// Deleted series are selected by the time range specified by start and stop arguments and optional predicate string which contains condition for selecting data for deletion, such as:
// 		tag1="value1" and (tag2="value2" and tag3!="value3")
// Empty predicate string means all data from the given time range will be deleted. See https://v2.docs.influxdata.com/v2.0/reference/syntax/delete-predicate/
// for more info about predicate syntax.
type DeleteAPI interface {
	// Delete deletes series selected by the time range specified by start and stop arguments and optional predicate string from the bucket bucket belonging to the organization org.
	Delete(ctx context.Context, org *domain.Organization, bucket *domain.Bucket, start, stop time.Time, predicate string) error
	// DeleteWithID deletes series selected by the time range specified by start and stop arguments and optional predicate string from the bucket with ID bucketID belonging to the organization with ID orgID.
	DeleteWithID(ctx context.Context, orgID, bucketID string, start, stop time.Time, predicate string) error
	// DeleteWithName deletes series selected by the time range specified by start and stop arguments and optional predicate string from the bucket with name bucketName belonging to the organization with name orgName.
	DeleteWithName(ctx context.Context, orgName, bucketName string, start, stop time.Time, predicate string) error
}

// deleteAPI implements DeleteAPI
type deleteAPI struct {
	apiClient *domain.Client
}

// NewDeleteAPI creates new instance of DeleteAPI
func NewDeleteAPI(apiClient *domain.Client) DeleteAPI {
	return &deleteAPI{
		apiClient: apiClient,
	}
}

func (d *deleteAPI) delete(ctx context.Context, params *domain.PostDeleteParams, conditions *domain.DeletePredicateRequest) error {
	allParams := &domain.PostDeleteAllParams{
		PostDeleteParams: *params,
		Body:             domain.PostDeleteJSONRequestBody(*conditions),
	}
	return d.apiClient.PostDelete(ctx, allParams)
}

func (d *deleteAPI) Delete(ctx context.Context, org *domain.Organization, bucket *domain.Bucket, start, stop time.Time, predicate string) error {
	params := &domain.PostDeleteParams{
		OrgID:    org.Id,
		BucketID: bucket.Id,
	}
	conditions := &domain.DeletePredicateRequest{
		Predicate: &predicate,
		Start:     start,
		Stop:      stop,
	}
	return d.delete(ctx, params, conditions)
}

func (d *deleteAPI) DeleteWithID(ctx context.Context, orgID, bucketID string, start, stop time.Time, predicate string) error {
	params := &domain.PostDeleteParams{
		OrgID:    &orgID,
		BucketID: &bucketID,
	}
	conditions := &domain.DeletePredicateRequest{
		Predicate: &predicate,
		Start:     start,
		Stop:      stop,
	}
	return d.delete(ctx, params, conditions)
}

func (d *deleteAPI) DeleteWithName(ctx context.Context, orgName, bucketName string, start, stop time.Time, predicate string) error {
	params := &domain.PostDeleteParams{
		Org:    &orgName,
		Bucket: &bucketName,
	}
	conditions := &domain.DeletePredicateRequest{
		Predicate: &predicate,
		Start:     start,
		Stop:      stop,
	}
	return d.delete(ctx, params, conditions)
}
