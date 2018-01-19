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

	"golang.org/x/net/context"

	"cloud.google.com/go/internal/optional"
	bq "google.golang.org/api/bigquery/v2"
)

// A Table is a reference to a BigQuery table.
type Table struct {
	// ProjectID, DatasetID and TableID may be omitted if the Table is the destination for a query.
	// In this case the result will be stored in an ephemeral table.
	ProjectID string
	DatasetID string
	// TableID must contain only letters (a-z, A-Z), numbers (0-9), or underscores (_).
	// The maximum length is 1,024 characters.
	TableID string

	c *Client
}

// TableMetadata contains information about a BigQuery table.
type TableMetadata struct {
	// The following fields can be set when creating a table.

	// The user-friendly name for the table.
	Name string

	// The user-friendly description of the table.
	Description string

	// The table schema. If provided on create, ViewQuery must be empty.
	Schema Schema

	// The query to use for a view. If provided on create, Schema must be nil.
	ViewQuery string

	// Use Legacy SQL for the view query.
	// At most one of UseLegacySQL and UseStandardSQL can be true.
	UseLegacySQL bool

	// Use Legacy SQL for the view query. The default.
	// At most one of UseLegacySQL and UseStandardSQL can be true.
	// Deprecated: use UseLegacySQL.
	UseStandardSQL bool

	// If non-nil, the table is partitioned by time.
	TimePartitioning *TimePartitioning

	// The time when this table expires. If not set, the table will persist
	// indefinitely. Expired tables will be deleted and their storage reclaimed.
	ExpirationTime time.Time

	// User-provided labels.
	Labels map[string]string

	// Information about a table stored outside of BigQuery.
	ExternalDataConfig *ExternalDataConfig

	// All the fields below are read-only.

	FullID           string // An opaque ID uniquely identifying the table.
	Type             TableType
	CreationTime     time.Time
	LastModifiedTime time.Time

	// The size of the table in bytes.
	// This does not include data that is being buffered during a streaming insert.
	NumBytes int64

	// The number of rows of data in this table.
	// This does not include data that is being buffered during a streaming insert.
	NumRows uint64

	// Contains information regarding this table's streaming buffer, if one is
	// present. This field will be nil if the table is not being streamed to or if
	// there is no data in the streaming buffer.
	StreamingBuffer *StreamingBuffer

	// ETag is the ETag obtained when reading metadata. Pass it to Table.Update to
	// ensure that the metadata hasn't changed since it was read.
	ETag string
}

// TableCreateDisposition specifies the circumstances under which destination table will be created.
// Default is CreateIfNeeded.
type TableCreateDisposition string

const (
	// CreateIfNeeded will create the table if it does not already exist.
	// Tables are created atomically on successful completion of a job.
	CreateIfNeeded TableCreateDisposition = "CREATE_IF_NEEDED"

	// CreateNever ensures the table must already exist and will not be
	// automatically created.
	CreateNever TableCreateDisposition = "CREATE_NEVER"
)

// TableWriteDisposition specifies how existing data in a destination table is treated.
// Default is WriteAppend.
type TableWriteDisposition string

const (
	// WriteAppend will append to any existing data in the destination table.
	// Data is appended atomically on successful completion of a job.
	WriteAppend TableWriteDisposition = "WRITE_APPEND"

	// WriteTruncate overrides the existing data in the destination table.
	// Data is overwritten atomically on successful completion of a job.
	WriteTruncate TableWriteDisposition = "WRITE_TRUNCATE"

	// WriteEmpty fails writes if the destination table already contains data.
	WriteEmpty TableWriteDisposition = "WRITE_EMPTY"
)

// TableType is the type of table.
type TableType string

const (
	RegularTable  TableType = "TABLE"
	ViewTable     TableType = "VIEW"
	ExternalTable TableType = "EXTERNAL"
)

// TimePartitioning describes the time-based date partitioning on a table.
// For more information see: https://cloud.google.com/bigquery/docs/creating-partitioned-tables.
type TimePartitioning struct {
	// The amount of time to keep the storage for a partition.
	// If the duration is empty (0), the data in the partitions do not expire.
	Expiration time.Duration

	// If empty, the table is partitioned by pseudo column '_PARTITIONTIME'; if set, the
	// table is partitioned by this field. The field must be a top-level TIMESTAMP or
	// DATE field. Its mode must be NULLABLE or REQUIRED.
	Field string
}

func (p *TimePartitioning) toBQ() *bq.TimePartitioning {
	if p == nil {
		return nil
	}
	return &bq.TimePartitioning{
		Type:         "DAY",
		ExpirationMs: int64(p.Expiration / time.Millisecond),
		Field:        p.Field,
	}
}

func bqToTimePartitioning(q *bq.TimePartitioning) *TimePartitioning {
	if q == nil {
		return nil
	}
	return &TimePartitioning{
		Expiration: time.Duration(q.ExpirationMs) * time.Millisecond,
		Field:      q.Field,
	}
}

// StreamingBuffer holds information about the streaming buffer.
type StreamingBuffer struct {
	// A lower-bound estimate of the number of bytes currently in the streaming
	// buffer.
	EstimatedBytes uint64

	// A lower-bound estimate of the number of rows currently in the streaming
	// buffer.
	EstimatedRows uint64

	// The time of the oldest entry in the streaming buffer.
	OldestEntryTime time.Time
}

func (t *Table) toBQ() *bq.TableReference {
	return &bq.TableReference{
		ProjectId: t.ProjectID,
		DatasetId: t.DatasetID,
		TableId:   t.TableID,
	}
}

// FullyQualifiedName returns the ID of the table in projectID:datasetID.tableID format.
func (t *Table) FullyQualifiedName() string {
	return fmt.Sprintf("%s:%s.%s", t.ProjectID, t.DatasetID, t.TableID)
}

// implicitTable reports whether Table is an empty placeholder, which signifies that a new table should be created with an auto-generated Table ID.
func (t *Table) implicitTable() bool {
	return t.ProjectID == "" && t.DatasetID == "" && t.TableID == ""
}

// Create creates a table in the BigQuery service.
// Pass in a TableMetadata value to configure the table.
// If tm.View.Query is non-empty, the created table will be of type VIEW.
// Expiration can only be set during table creation.
// After table creation, a view can be modified only if its table was initially created
// with a view.
func (t *Table) Create(ctx context.Context, tm *TableMetadata) error {
	table, err := tm.toBQ()
	if err != nil {
		return err
	}
	table.TableReference = &bq.TableReference{
		ProjectId: t.ProjectID,
		DatasetId: t.DatasetID,
		TableId:   t.TableID,
	}
	req := t.c.bqs.Tables.Insert(t.ProjectID, t.DatasetID, table).Context(ctx)
	setClientHeader(req.Header())
	_, err = req.Do()
	return err
}

func (tm *TableMetadata) toBQ() (*bq.Table, error) {
	t := &bq.Table{}
	if tm == nil {
		return t, nil
	}
	if tm.Schema != nil && tm.ViewQuery != "" {
		return nil, errors.New("bigquery: provide Schema or ViewQuery, not both")
	}
	t.FriendlyName = tm.Name
	t.Description = tm.Description
	t.Labels = tm.Labels
	if tm.Schema != nil {
		t.Schema = tm.Schema.toBQ()
	}
	if tm.ViewQuery != "" {
		if tm.UseStandardSQL && tm.UseLegacySQL {
			return nil, errors.New("bigquery: cannot provide both UseStandardSQL and UseLegacySQL")
		}
		t.View = &bq.ViewDefinition{Query: tm.ViewQuery}
		if tm.UseLegacySQL {
			t.View.UseLegacySql = true
		} else {
			t.View.UseLegacySql = false
			t.View.ForceSendFields = append(t.View.ForceSendFields, "UseLegacySql")
		}
	} else if tm.UseLegacySQL || tm.UseStandardSQL {
		return nil, errors.New("bigquery: UseLegacy/StandardSQL requires ViewQuery")
	}
	t.TimePartitioning = tm.TimePartitioning.toBQ()
	if !tm.ExpirationTime.IsZero() {
		t.ExpirationTime = tm.ExpirationTime.UnixNano() / 1e6
	}
	if tm.ExternalDataConfig != nil {
		edc := tm.ExternalDataConfig.toBQ()
		t.ExternalDataConfiguration = &edc
	}
	if tm.FullID != "" {
		return nil, errors.New("cannot set FullID on create")
	}
	if tm.Type != "" {
		return nil, errors.New("cannot set Type on create")
	}
	if !tm.CreationTime.IsZero() {
		return nil, errors.New("cannot set CreationTime on create")
	}
	if !tm.LastModifiedTime.IsZero() {
		return nil, errors.New("cannot set LastModifiedTime on create")
	}
	if tm.NumBytes != 0 {
		return nil, errors.New("cannot set NumBytes on create")
	}
	if tm.NumRows != 0 {
		return nil, errors.New("cannot set NumRows on create")
	}
	if tm.StreamingBuffer != nil {
		return nil, errors.New("cannot set StreamingBuffer on create")
	}
	if tm.ETag != "" {
		return nil, errors.New("cannot set ETag on create")
	}
	return t, nil
}

// Metadata fetches the metadata for the table.
func (t *Table) Metadata(ctx context.Context) (*TableMetadata, error) {
	req := t.c.bqs.Tables.Get(t.ProjectID, t.DatasetID, t.TableID).Context(ctx)
	setClientHeader(req.Header())
	var table *bq.Table
	err := runWithRetry(ctx, func() (err error) {
		table, err = req.Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	return bqToTableMetadata(table)
}

func bqToTableMetadata(t *bq.Table) (*TableMetadata, error) {
	md := &TableMetadata{
		Description:      t.Description,
		Name:             t.FriendlyName,
		Type:             TableType(t.Type),
		FullID:           t.Id,
		Labels:           t.Labels,
		NumBytes:         t.NumBytes,
		NumRows:          t.NumRows,
		ExpirationTime:   unixMillisToTime(t.ExpirationTime),
		CreationTime:     unixMillisToTime(t.CreationTime),
		LastModifiedTime: unixMillisToTime(int64(t.LastModifiedTime)),
		ETag:             t.Etag,
	}
	if t.Schema != nil {
		md.Schema = bqToSchema(t.Schema)
	}
	if t.View != nil {
		md.ViewQuery = t.View.Query
		md.UseLegacySQL = t.View.UseLegacySql
	}
	md.TimePartitioning = bqToTimePartitioning(t.TimePartitioning)
	if t.StreamingBuffer != nil {
		md.StreamingBuffer = &StreamingBuffer{
			EstimatedBytes:  t.StreamingBuffer.EstimatedBytes,
			EstimatedRows:   t.StreamingBuffer.EstimatedRows,
			OldestEntryTime: unixMillisToTime(int64(t.StreamingBuffer.OldestEntryTime)),
		}
	}
	if t.ExternalDataConfiguration != nil {
		edc, err := bqToExternalDataConfig(t.ExternalDataConfiguration)
		if err != nil {
			return nil, err
		}
		md.ExternalDataConfig = edc
	}
	return md, nil
}

// Delete deletes the table.
func (t *Table) Delete(ctx context.Context) error {
	req := t.c.bqs.Tables.Delete(t.ProjectID, t.DatasetID, t.TableID).Context(ctx)
	setClientHeader(req.Header())
	return req.Do()
}

// Read fetches the contents of the table.
func (t *Table) Read(ctx context.Context) *RowIterator {
	return t.read(ctx, fetchPage)
}

func (t *Table) read(ctx context.Context, pf pageFetcher) *RowIterator {
	return newRowIterator(ctx, t, pf)
}

// Update modifies specific Table metadata fields.
func (t *Table) Update(ctx context.Context, tm TableMetadataToUpdate, etag string) (*TableMetadata, error) {
	bqt := tm.toBQ()
	call := t.c.bqs.Tables.Patch(t.ProjectID, t.DatasetID, t.TableID, bqt).Context(ctx)
	setClientHeader(call.Header())
	if etag != "" {
		call.Header().Set("If-Match", etag)
	}
	var res *bq.Table
	if err := runWithRetry(ctx, func() (err error) {
		res, err = call.Do()
		return err
	}); err != nil {
		return nil, err
	}
	return bqToTableMetadata(res)
}

func (tm *TableMetadataToUpdate) toBQ() *bq.Table {
	t := &bq.Table{}
	forceSend := func(field string) {
		t.ForceSendFields = append(t.ForceSendFields, field)
	}

	if tm.Description != nil {
		t.Description = optional.ToString(tm.Description)
		forceSend("Description")
	}
	if tm.Name != nil {
		t.FriendlyName = optional.ToString(tm.Name)
		forceSend("FriendlyName")
	}
	if tm.Schema != nil {
		t.Schema = tm.Schema.toBQ()
		forceSend("Schema")
	}
	if !tm.ExpirationTime.IsZero() {
		t.ExpirationTime = tm.ExpirationTime.UnixNano() / 1e6
		forceSend("ExpirationTime")
	}
	if tm.ViewQuery != nil {
		t.View = &bq.ViewDefinition{
			Query:           optional.ToString(tm.ViewQuery),
			ForceSendFields: []string{"Query"},
		}
	}
	if tm.UseLegacySQL != nil {
		if t.View == nil {
			t.View = &bq.ViewDefinition{}
		}
		t.View.UseLegacySql = optional.ToBool(tm.UseLegacySQL)
		t.View.ForceSendFields = append(t.View.ForceSendFields, "UseLegacySql")
	}
	labels, forces, nulls := tm.update()
	t.Labels = labels
	t.ForceSendFields = append(t.ForceSendFields, forces...)
	t.NullFields = append(t.NullFields, nulls...)
	return t
}

// TableMetadataToUpdate is used when updating a table's metadata.
// Only non-nil fields will be updated.
type TableMetadataToUpdate struct {
	// The user-friendly description of this table.
	Description optional.String

	// The user-friendly name for this table.
	Name optional.String

	// The table's schema.
	// When updating a schema, you can add columns but not remove them.
	Schema Schema

	// The time when this table expires.
	ExpirationTime time.Time

	// The query to use for a view.
	ViewQuery optional.String

	// Use Legacy SQL for the view query.
	UseLegacySQL optional.Bool

	labelUpdater
}

// labelUpdater contains common code for updating labels.
type labelUpdater struct {
	setLabels    map[string]string
	deleteLabels map[string]bool
}

// SetLabel causes a label to be added or modified on a call to Update.
func (u *labelUpdater) SetLabel(name, value string) {
	if u.setLabels == nil {
		u.setLabels = map[string]string{}
	}
	u.setLabels[name] = value
}

// DeleteLabel causes a label to be deleted on a call to Update.
func (u *labelUpdater) DeleteLabel(name string) {
	if u.deleteLabels == nil {
		u.deleteLabels = map[string]bool{}
	}
	u.deleteLabels[name] = true
}

func (u *labelUpdater) update() (labels map[string]string, forces, nulls []string) {
	if u.setLabels == nil && u.deleteLabels == nil {
		return nil, nil, nil
	}
	labels = map[string]string{}
	for k, v := range u.setLabels {
		labels[k] = v
	}
	if len(labels) == 0 && len(u.deleteLabels) > 0 {
		forces = []string{"Labels"}
	}
	for l := range u.deleteLabels {
		nulls = append(nulls, "Labels."+l)
	}
	return labels, forces, nulls
}
