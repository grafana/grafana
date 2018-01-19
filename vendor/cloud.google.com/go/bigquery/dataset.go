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

package bigquery

import (
	"errors"
	"fmt"
	"time"

	"cloud.google.com/go/internal/optional"

	"golang.org/x/net/context"
	bq "google.golang.org/api/bigquery/v2"
	"google.golang.org/api/iterator"
)

// Dataset is a reference to a BigQuery dataset.
type Dataset struct {
	ProjectID string
	DatasetID string
	c         *Client
}

// DatasetMetadata contains information about a BigQuery dataset.
type DatasetMetadata struct {
	// These fields can be set when creating a dataset.
	Name                   string            // The user-friendly name for this dataset.
	Description            string            // The user-friendly description of this dataset.
	Location               string            // The geo location of the dataset.
	DefaultTableExpiration time.Duration     // The default expiration time for new tables.
	Labels                 map[string]string // User-provided labels.
	Access                 []*AccessEntry    // Access permissions.

	// These fields are read-only.
	CreationTime     time.Time
	LastModifiedTime time.Time // When the dataset or any of its tables were modified.
	FullID           string    // The full dataset ID in the form projectID:datasetID.

	// ETag is the ETag obtained when reading metadata. Pass it to Dataset.Update to
	// ensure that the metadata hasn't changed since it was read.
	ETag string
}

// DatasetMetadataToUpdate is used when updating a dataset's metadata.
// Only non-nil fields will be updated.
type DatasetMetadataToUpdate struct {
	Description optional.String // The user-friendly description of this table.
	Name        optional.String // The user-friendly name for this dataset.

	// DefaultTableExpiration is the the default expiration time for new tables.
	// If set to time.Duration(0), new tables never expire.
	DefaultTableExpiration optional.Duration

	// The entire access list. It is not possible to replace individual entries.
	Access []*AccessEntry

	labelUpdater
}

// Dataset creates a handle to a BigQuery dataset in the client's project.
func (c *Client) Dataset(id string) *Dataset {
	return c.DatasetInProject(c.projectID, id)
}

// DatasetInProject creates a handle to a BigQuery dataset in the specified project.
func (c *Client) DatasetInProject(projectID, datasetID string) *Dataset {
	return &Dataset{
		ProjectID: projectID,
		DatasetID: datasetID,
		c:         c,
	}
}

// Create creates a dataset in the BigQuery service. An error will be returned if the
// dataset already exists. Pass in a DatasetMetadata value to configure the dataset.
func (d *Dataset) Create(ctx context.Context, md *DatasetMetadata) error {
	ds, err := md.toBQ()
	if err != nil {
		return err
	}
	ds.DatasetReference = &bq.DatasetReference{DatasetId: d.DatasetID}
	call := d.c.bqs.Datasets.Insert(d.ProjectID, ds).Context(ctx)
	setClientHeader(call.Header())
	_, err = call.Do()
	return err
}

func (dm *DatasetMetadata) toBQ() (*bq.Dataset, error) {
	ds := &bq.Dataset{}
	if dm == nil {
		return ds, nil
	}
	ds.FriendlyName = dm.Name
	ds.Description = dm.Description
	ds.Location = dm.Location
	ds.DefaultTableExpirationMs = int64(dm.DefaultTableExpiration / time.Millisecond)
	ds.Labels = dm.Labels
	var err error
	ds.Access, err = accessListToBQ(dm.Access)
	if err != nil {
		return nil, err
	}
	if !dm.CreationTime.IsZero() {
		return nil, errors.New("bigquery: Dataset.CreationTime is not writable")
	}
	if !dm.LastModifiedTime.IsZero() {
		return nil, errors.New("bigquery: Dataset.LastModifiedTime is not writable")
	}
	if dm.FullID != "" {
		return nil, errors.New("bigquery: Dataset.FullID is not writable")
	}
	if dm.ETag != "" {
		return nil, errors.New("bigquery: Dataset.ETag is not writable")
	}
	return ds, nil
}

func accessListToBQ(a []*AccessEntry) ([]*bq.DatasetAccess, error) {
	var q []*bq.DatasetAccess
	for _, e := range a {
		a, err := e.toBQ()
		if err != nil {
			return nil, err
		}
		q = append(q, a)
	}
	return q, nil
}

// Delete deletes the dataset.
func (d *Dataset) Delete(ctx context.Context) error {
	call := d.c.bqs.Datasets.Delete(d.ProjectID, d.DatasetID).Context(ctx)
	setClientHeader(call.Header())
	return call.Do()
}

// Metadata fetches the metadata for the dataset.
func (d *Dataset) Metadata(ctx context.Context) (*DatasetMetadata, error) {
	call := d.c.bqs.Datasets.Get(d.ProjectID, d.DatasetID).Context(ctx)
	setClientHeader(call.Header())
	var ds *bq.Dataset
	if err := runWithRetry(ctx, func() (err error) {
		ds, err = call.Do()
		return err
	}); err != nil {
		return nil, err
	}
	return bqToDatasetMetadata(ds)
}

func bqToDatasetMetadata(d *bq.Dataset) (*DatasetMetadata, error) {
	dm := &DatasetMetadata{
		CreationTime:           unixMillisToTime(d.CreationTime),
		LastModifiedTime:       unixMillisToTime(d.LastModifiedTime),
		DefaultTableExpiration: time.Duration(d.DefaultTableExpirationMs) * time.Millisecond,
		Description:            d.Description,
		Name:                   d.FriendlyName,
		FullID:                 d.Id,
		Location:               d.Location,
		Labels:                 d.Labels,
		ETag:                   d.Etag,
	}
	for _, a := range d.Access {
		e, err := bqToAccessEntry(a, nil)
		if err != nil {
			return nil, err
		}
		dm.Access = append(dm.Access, e)
	}
	return dm, nil
}

// Update modifies specific Dataset metadata fields.
// To perform a read-modify-write that protects against intervening reads,
// set the etag argument to the DatasetMetadata.ETag field from the read.
// Pass the empty string for etag for a "blind write" that will always succeed.
func (d *Dataset) Update(ctx context.Context, dm DatasetMetadataToUpdate, etag string) (*DatasetMetadata, error) {
	ds, err := dm.toBQ()
	if err != nil {
		return nil, err
	}
	call := d.c.bqs.Datasets.Patch(d.ProjectID, d.DatasetID, ds).Context(ctx)
	setClientHeader(call.Header())
	if etag != "" {
		call.Header().Set("If-Match", etag)
	}
	var ds2 *bq.Dataset
	if err := runWithRetry(ctx, func() (err error) {
		ds2, err = call.Do()
		return err
	}); err != nil {
		return nil, err
	}
	return bqToDatasetMetadata(ds2)
}

func (dm *DatasetMetadataToUpdate) toBQ() (*bq.Dataset, error) {
	ds := &bq.Dataset{}
	forceSend := func(field string) {
		ds.ForceSendFields = append(ds.ForceSendFields, field)
	}

	if dm.Description != nil {
		ds.Description = optional.ToString(dm.Description)
		forceSend("Description")
	}
	if dm.Name != nil {
		ds.FriendlyName = optional.ToString(dm.Name)
		forceSend("FriendlyName")
	}
	if dm.DefaultTableExpiration != nil {
		dur := optional.ToDuration(dm.DefaultTableExpiration)
		if dur == 0 {
			// Send a null to delete the field.
			ds.NullFields = append(ds.NullFields, "DefaultTableExpirationMs")
		} else {
			ds.DefaultTableExpirationMs = int64(dur / time.Millisecond)
		}
	}
	if dm.Access != nil {
		var err error
		ds.Access, err = accessListToBQ(dm.Access)
		if err != nil {
			return nil, err
		}
		if len(ds.Access) == 0 {
			ds.NullFields = append(ds.NullFields, "Access")
		}
	}
	labels, forces, nulls := dm.update()
	ds.Labels = labels
	ds.ForceSendFields = append(ds.ForceSendFields, forces...)
	ds.NullFields = append(ds.NullFields, nulls...)
	return ds, nil
}

// Table creates a handle to a BigQuery table in the dataset.
// To determine if a table exists, call Table.Metadata.
// If the table does not already exist, use Table.Create to create it.
func (d *Dataset) Table(tableID string) *Table {
	return &Table{ProjectID: d.ProjectID, DatasetID: d.DatasetID, TableID: tableID, c: d.c}
}

// Tables returns an iterator over the tables in the Dataset.
func (d *Dataset) Tables(ctx context.Context) *TableIterator {
	it := &TableIterator{
		ctx:     ctx,
		dataset: d,
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.tables) },
		func() interface{} { b := it.tables; it.tables = nil; return b })
	return it
}

// A TableIterator is an iterator over Tables.
type TableIterator struct {
	ctx      context.Context
	dataset  *Dataset
	tables   []*Table
	pageInfo *iterator.PageInfo
	nextFunc func() error
}

// Next returns the next result. Its second return value is Done if there are
// no more results. Once Next returns Done, all subsequent calls will return
// Done.
func (it *TableIterator) Next() (*Table, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	t := it.tables[0]
	it.tables = it.tables[1:]
	return t, nil
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *TableIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

// for testing
var listTables = func(it *TableIterator, pageSize int, pageToken string) (*bq.TableList, error) {
	call := it.dataset.c.bqs.Tables.List(it.dataset.ProjectID, it.dataset.DatasetID).
		PageToken(pageToken).
		Context(it.ctx)
	setClientHeader(call.Header())
	if pageSize > 0 {
		call.MaxResults(int64(pageSize))
	}
	var res *bq.TableList
	err := runWithRetry(it.ctx, func() (err error) {
		res, err = call.Do()
		return err
	})
	return res, err
}

func (it *TableIterator) fetch(pageSize int, pageToken string) (string, error) {
	res, err := listTables(it, pageSize, pageToken)
	if err != nil {
		return "", err
	}
	for _, t := range res.Tables {
		it.tables = append(it.tables, bqToTable(t.TableReference, it.dataset.c))
	}
	return res.NextPageToken, nil
}

func bqToTable(tr *bq.TableReference, c *Client) *Table {
	return &Table{
		ProjectID: tr.ProjectId,
		DatasetID: tr.DatasetId,
		TableID:   tr.TableId,
		c:         c,
	}
}

// Datasets returns an iterator over the datasets in a project.
// The Client's project is used by default, but that can be
// changed by setting ProjectID on the returned iterator before calling Next.
func (c *Client) Datasets(ctx context.Context) *DatasetIterator {
	return c.DatasetsInProject(ctx, c.projectID)
}

// DatasetsInProject returns an iterator over the datasets in the provided project.
//
// Deprecated: call Client.Datasets, then set ProjectID on the returned iterator.
func (c *Client) DatasetsInProject(ctx context.Context, projectID string) *DatasetIterator {
	it := &DatasetIterator{
		ctx:       ctx,
		c:         c,
		ProjectID: projectID,
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.items) },
		func() interface{} { b := it.items; it.items = nil; return b })
	return it
}

// DatasetIterator iterates over the datasets in a project.
type DatasetIterator struct {
	// ListHidden causes hidden datasets to be listed when set to true.
	// Set before the first call to Next.
	ListHidden bool

	// Filter restricts the datasets returned by label. The filter syntax is described in
	// https://cloud.google.com/bigquery/docs/labeling-datasets#filtering_datasets_using_labels
	// Set before the first call to Next.
	Filter string

	// The project ID of the listed datasets.
	// Set before the first call to Next.
	ProjectID string

	ctx      context.Context
	c        *Client
	pageInfo *iterator.PageInfo
	nextFunc func() error
	items    []*Dataset
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *DatasetIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

func (it *DatasetIterator) Next() (*Dataset, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	item := it.items[0]
	it.items = it.items[1:]
	return item, nil
}

// for testing
var listDatasets = func(it *DatasetIterator, pageSize int, pageToken string) (*bq.DatasetList, error) {
	call := it.c.bqs.Datasets.List(it.ProjectID).
		Context(it.ctx).
		PageToken(pageToken).
		All(it.ListHidden)
	setClientHeader(call.Header())
	if pageSize > 0 {
		call.MaxResults(int64(pageSize))
	}
	if it.Filter != "" {
		call.Filter(it.Filter)
	}
	var res *bq.DatasetList
	err := runWithRetry(it.ctx, func() (err error) {
		res, err = call.Do()
		return err
	})
	return res, err
}

func (it *DatasetIterator) fetch(pageSize int, pageToken string) (string, error) {
	res, err := listDatasets(it, pageSize, pageToken)
	if err != nil {
		return "", err
	}
	for _, d := range res.Datasets {
		it.items = append(it.items, &Dataset{
			ProjectID: d.DatasetReference.ProjectId,
			DatasetID: d.DatasetReference.DatasetId,
			c:         it.c,
		})
	}
	return res.NextPageToken, nil
}

// An AccessEntry describes the permissions that an entity has on a dataset.
type AccessEntry struct {
	Role       AccessRole // The role of the entity
	EntityType EntityType // The type of entity
	Entity     string     // The entity (individual or group) granted access
	View       *Table     // The view granted access (EntityType must be ViewEntity)
}

// AccessRole is the level of access to grant to a dataset.
type AccessRole string

const (
	OwnerRole  AccessRole = "OWNER"
	ReaderRole AccessRole = "READER"
	WriterRole AccessRole = "WRITER"
)

// EntityType is the type of entity in an AccessEntry.
type EntityType int

const (
	// A domain (e.g. "example.com")
	DomainEntity EntityType = iota + 1

	// Email address of a Google Group
	GroupEmailEntity

	// Email address of an individual user.
	UserEmailEntity

	// A special group: one of projectOwners, projectReaders, projectWriters or allAuthenticatedUsers.
	SpecialGroupEntity

	// A BigQuery view.
	ViewEntity
)

func (e *AccessEntry) toBQ() (*bq.DatasetAccess, error) {
	q := &bq.DatasetAccess{Role: string(e.Role)}
	switch e.EntityType {
	case DomainEntity:
		q.Domain = e.Entity
	case GroupEmailEntity:
		q.GroupByEmail = e.Entity
	case UserEmailEntity:
		q.UserByEmail = e.Entity
	case SpecialGroupEntity:
		q.SpecialGroup = e.Entity
	case ViewEntity:
		q.View = e.View.toBQ()
	default:
		return nil, fmt.Errorf("bigquery: unknown entity type %d", e.EntityType)
	}
	return q, nil
}

func bqToAccessEntry(q *bq.DatasetAccess, c *Client) (*AccessEntry, error) {
	e := &AccessEntry{Role: AccessRole(q.Role)}
	switch {
	case q.Domain != "":
		e.Entity = q.Domain
		e.EntityType = DomainEntity
	case q.GroupByEmail != "":
		e.Entity = q.GroupByEmail
		e.EntityType = GroupEmailEntity
	case q.UserByEmail != "":
		e.Entity = q.UserByEmail
		e.EntityType = UserEmailEntity
	case q.SpecialGroup != "":
		e.Entity = q.SpecialGroup
		e.EntityType = SpecialGroupEntity
	case q.View != nil:
		e.View = c.DatasetInProject(q.View.ProjectId, q.View.DatasetId).Table(q.View.TableId)
		e.EntityType = ViewEntity
	default:
		return nil, errors.New("bigquery: invalid access value")
	}
	return e, nil
}
