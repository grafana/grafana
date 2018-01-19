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

package bigquery

import (
	"encoding/base64"
	"unicode/utf8"

	bq "google.golang.org/api/bigquery/v2"
)

// DataFormat describes the format of BigQuery table data.
type DataFormat string

// Constants describing the format of BigQuery table data.
const (
	CSV             DataFormat = "CSV"
	Avro            DataFormat = "AVRO"
	JSON            DataFormat = "NEWLINE_DELIMITED_JSON"
	DatastoreBackup DataFormat = "DATASTORE_BACKUP"
	GoogleSheets    DataFormat = "GOOGLE_SHEETS"
	Bigtable        DataFormat = "BIGTABLE"
)

// ExternalData is a table which is stored outside of BigQuery. It is implemented by
// *ExternalDataConfig.
// GCSReference also implements it, for backwards compatibility.
type ExternalData interface {
	toBQ() bq.ExternalDataConfiguration
}

// ExternalDataConfig describes data external to BigQuery that can be used
// in queries and to create external tables.
type ExternalDataConfig struct {
	// The format of the data. Required.
	SourceFormat DataFormat

	// The fully-qualified URIs that point to your
	// data in Google Cloud. Required.
	//
	// For Google Cloud Storage URIs, each URI can contain one '*' wildcard character
	// and it must come after the 'bucket' name. Size limits related to load jobs
	// apply to external data sources.
	//
	// For Google Cloud Bigtable URIs, exactly one URI can be specified and it has be
	// a fully specified and valid HTTPS URL for a Google Cloud Bigtable table.
	//
	// For Google Cloud Datastore backups, exactly one URI can be specified. Also,
	// the '*' wildcard character is not allowed.
	SourceURIs []string

	// The schema of the data. Required for CSV and JSON; disallowed for the
	// other formats.
	Schema Schema

	// Try to detect schema and format options automatically.
	// Any option specified explicitly will be honored.
	AutoDetect bool

	// The compression type of the data.
	Compression Compression

	// IgnoreUnknownValues causes values not matching the schema to be
	// tolerated. Unknown values are ignored. For CSV this ignores extra values
	// at the end of a line. For JSON this ignores named values that do not
	// match any column name. If this field is not set, records containing
	// unknown values are treated as bad records. The MaxBadRecords field can
	// be used to customize how bad records are handled.
	IgnoreUnknownValues bool

	// MaxBadRecords is the maximum number of bad records that will be ignored
	// when reading data.
	MaxBadRecords int64

	// Additional options for CSV, GoogleSheets and Bigtable formats.
	Options ExternalDataConfigOptions
}

func (e *ExternalDataConfig) toBQ() bq.ExternalDataConfiguration {
	q := bq.ExternalDataConfiguration{
		SourceFormat:        string(e.SourceFormat),
		SourceUris:          e.SourceURIs,
		Autodetect:          e.AutoDetect,
		Compression:         string(e.Compression),
		IgnoreUnknownValues: e.IgnoreUnknownValues,
		MaxBadRecords:       e.MaxBadRecords,
	}
	if e.Schema != nil {
		q.Schema = e.Schema.toBQ()
	}
	if e.Options != nil {
		e.Options.populateExternalDataConfig(&q)
	}
	return q
}

func bqToExternalDataConfig(q *bq.ExternalDataConfiguration) (*ExternalDataConfig, error) {
	e := &ExternalDataConfig{
		SourceFormat:        DataFormat(q.SourceFormat),
		SourceURIs:          q.SourceUris,
		AutoDetect:          q.Autodetect,
		Compression:         Compression(q.Compression),
		IgnoreUnknownValues: q.IgnoreUnknownValues,
		MaxBadRecords:       q.MaxBadRecords,
		Schema:              bqToSchema(q.Schema),
	}
	switch {
	case q.CsvOptions != nil:
		e.Options = bqToCSVOptions(q.CsvOptions)
	case q.GoogleSheetsOptions != nil:
		e.Options = bqToGoogleSheetsOptions(q.GoogleSheetsOptions)
	case q.BigtableOptions != nil:
		var err error
		e.Options, err = bqToBigtableOptions(q.BigtableOptions)
		if err != nil {
			return nil, err
		}
	}
	return e, nil
}

// ExternalDataConfigOptions are additional options for external data configurations.
// This interface is implemented by CSVOptions, GoogleSheetsOptions and BigtableOptions.
type ExternalDataConfigOptions interface {
	populateExternalDataConfig(*bq.ExternalDataConfiguration)
}

// CSVOptions are additional options for CSV external data sources.
type CSVOptions struct {
	// AllowJaggedRows causes missing trailing optional columns to be tolerated
	// when reading CSV data. Missing values are treated as nulls.
	AllowJaggedRows bool

	// AllowQuotedNewlines sets whether quoted data sections containing
	// newlines are allowed when reading CSV data.
	AllowQuotedNewlines bool

	// Encoding is the character encoding of data to be read.
	Encoding Encoding

	// FieldDelimiter is the separator for fields in a CSV file, used when
	// reading or exporting data. The default is ",".
	FieldDelimiter string

	// Quote is the value used to quote data sections in a CSV file. The
	// default quotation character is the double quote ("), which is used if
	// both Quote and ForceZeroQuote are unset.
	// To specify that no character should be interpreted as a quotation
	// character, set ForceZeroQuote to true.
	// Only used when reading data.
	Quote          string
	ForceZeroQuote bool

	// The number of rows at the top of a CSV file that BigQuery will skip when
	// reading data.
	SkipLeadingRows int64
}

func (o *CSVOptions) populateExternalDataConfig(c *bq.ExternalDataConfiguration) {
	c.CsvOptions = &bq.CsvOptions{
		AllowJaggedRows:     o.AllowJaggedRows,
		AllowQuotedNewlines: o.AllowQuotedNewlines,
		Encoding:            string(o.Encoding),
		FieldDelimiter:      o.FieldDelimiter,
		Quote:               o.quote(),
		SkipLeadingRows:     o.SkipLeadingRows,
	}
}

// quote returns the CSV quote character, or nil if unset.
func (o *CSVOptions) quote() *string {
	if o.ForceZeroQuote {
		quote := ""
		return &quote
	}
	if o.Quote == "" {
		return nil
	}
	return &o.Quote
}

func (o *CSVOptions) setQuote(ps *string) {
	if ps != nil {
		o.Quote = *ps
		if o.Quote == "" {
			o.ForceZeroQuote = true
		}
	}
}

func bqToCSVOptions(q *bq.CsvOptions) *CSVOptions {
	o := &CSVOptions{
		AllowJaggedRows:     q.AllowJaggedRows,
		AllowQuotedNewlines: q.AllowQuotedNewlines,
		Encoding:            Encoding(q.Encoding),
		FieldDelimiter:      q.FieldDelimiter,
		SkipLeadingRows:     q.SkipLeadingRows,
	}
	o.setQuote(q.Quote)
	return o
}

// GoogleSheetsOptions are additional options for GoogleSheets external data sources.
type GoogleSheetsOptions struct {
	// The number of rows at the top of a sheet that BigQuery will skip when
	// reading data.
	SkipLeadingRows int64
}

func (o *GoogleSheetsOptions) populateExternalDataConfig(c *bq.ExternalDataConfiguration) {
	c.GoogleSheetsOptions = &bq.GoogleSheetsOptions{
		SkipLeadingRows: o.SkipLeadingRows,
	}
}

func bqToGoogleSheetsOptions(q *bq.GoogleSheetsOptions) *GoogleSheetsOptions {
	return &GoogleSheetsOptions{
		SkipLeadingRows: q.SkipLeadingRows,
	}
}

// BigtableOptions are additional options for Bigtable external data sources.
type BigtableOptions struct {
	// A list of column families to expose in the table schema along with their
	// types. If omitted, all column families are present in the table schema and
	// their values are read as BYTES.
	ColumnFamilies []*BigtableColumnFamily

	// If true, then the column families that are not specified in columnFamilies
	// list are not exposed in the table schema. Otherwise, they are read with BYTES
	// type values. The default is false.
	IgnoreUnspecifiedColumnFamilies bool

	// If true, then the rowkey column families will be read and converted to string.
	// Otherwise they are read with BYTES type values and users need to manually cast
	// them with CAST if necessary. The default is false.
	ReadRowkeyAsString bool
}

func (o *BigtableOptions) populateExternalDataConfig(c *bq.ExternalDataConfiguration) {
	q := &bq.BigtableOptions{
		IgnoreUnspecifiedColumnFamilies: o.IgnoreUnspecifiedColumnFamilies,
		ReadRowkeyAsString:              o.ReadRowkeyAsString,
	}
	for _, f := range o.ColumnFamilies {
		q.ColumnFamilies = append(q.ColumnFamilies, f.toBQ())
	}
	c.BigtableOptions = q
}

func bqToBigtableOptions(q *bq.BigtableOptions) (*BigtableOptions, error) {
	b := &BigtableOptions{
		IgnoreUnspecifiedColumnFamilies: q.IgnoreUnspecifiedColumnFamilies,
		ReadRowkeyAsString:              q.ReadRowkeyAsString,
	}
	for _, f := range q.ColumnFamilies {
		f2, err := bqToBigtableColumnFamily(f)
		if err != nil {
			return nil, err
		}
		b.ColumnFamilies = append(b.ColumnFamilies, f2)
	}
	return b, nil
}

// BigtableColumnFamily describes how BigQuery should access a Bigtable column family.
type BigtableColumnFamily struct {
	// Identifier of the column family.
	FamilyID string

	// Lists of columns that should be exposed as individual fields as opposed to a
	// list of (column name, value) pairs. All columns whose qualifier matches a
	// qualifier in this list can be accessed as .. Other columns can be accessed as
	// a list through .Column field.
	Columns []*BigtableColumn

	// The encoding of the values when the type is not STRING. Acceptable encoding values are:
	// - TEXT - indicates values are alphanumeric text strings.
	// - BINARY - indicates values are encoded using HBase Bytes.toBytes family of functions.
	// This can be overridden for a specific column by listing that column in 'columns' and
	// specifying an encoding for it.
	Encoding string

	// If true, only the latest version of values are exposed for all columns in this
	// column family. This can be overridden for a specific column by listing that
	// column in 'columns' and specifying a different setting for that column.
	OnlyReadLatest bool

	// The type to convert the value in cells of this
	// column family. The values are expected to be encoded using HBase
	// Bytes.toBytes function when using the BINARY encoding value.
	// Following BigQuery types are allowed (case-sensitive):
	// BYTES STRING INTEGER FLOAT BOOLEAN.
	// The default type is BYTES. This can be overridden for a specific column by
	// listing that column in 'columns' and specifying a type for it.
	Type string
}

func (b *BigtableColumnFamily) toBQ() *bq.BigtableColumnFamily {
	q := &bq.BigtableColumnFamily{
		FamilyId:       b.FamilyID,
		Encoding:       b.Encoding,
		OnlyReadLatest: b.OnlyReadLatest,
		Type:           b.Type,
	}
	for _, col := range b.Columns {
		q.Columns = append(q.Columns, col.toBQ())
	}
	return q
}

func bqToBigtableColumnFamily(q *bq.BigtableColumnFamily) (*BigtableColumnFamily, error) {
	b := &BigtableColumnFamily{
		FamilyID:       q.FamilyId,
		Encoding:       q.Encoding,
		OnlyReadLatest: q.OnlyReadLatest,
		Type:           q.Type,
	}
	for _, col := range q.Columns {
		c, err := bqToBigtableColumn(col)
		if err != nil {
			return nil, err
		}
		b.Columns = append(b.Columns, c)
	}
	return b, nil
}

// BigtableColumn describes how BigQuery should access a Bigtable column.
type BigtableColumn struct {
	// Qualifier of the column. Columns in the parent column family that have this
	// exact qualifier are exposed as . field. The column field name is the
	// same as the column qualifier.
	Qualifier string

	// If the qualifier is not a valid BigQuery field identifier i.e. does not match
	// [a-zA-Z][a-zA-Z0-9_]*, a valid identifier must be provided as the column field
	// name and is used as field name in queries.
	FieldName string

	// If true, only the latest version of values are exposed for this column.
	// See BigtableColumnFamily.OnlyReadLatest.
	OnlyReadLatest bool

	// The encoding of the values when the type is not STRING.
	// See BigtableColumnFamily.Encoding
	Encoding string

	// The type to convert the value in cells of this column.
	// See BigtableColumnFamily.Type
	Type string
}

func (b *BigtableColumn) toBQ() *bq.BigtableColumn {
	q := &bq.BigtableColumn{
		FieldName:      b.FieldName,
		OnlyReadLatest: b.OnlyReadLatest,
		Encoding:       b.Encoding,
		Type:           b.Type,
	}
	if utf8.ValidString(b.Qualifier) {
		q.QualifierString = b.Qualifier
	} else {
		q.QualifierEncoded = base64.RawStdEncoding.EncodeToString([]byte(b.Qualifier))
	}
	return q
}

func bqToBigtableColumn(q *bq.BigtableColumn) (*BigtableColumn, error) {
	b := &BigtableColumn{
		FieldName:      q.FieldName,
		OnlyReadLatest: q.OnlyReadLatest,
		Encoding:       q.Encoding,
		Type:           q.Type,
	}
	if q.QualifierString != "" {
		b.Qualifier = q.QualifierString
	} else {
		bytes, err := base64.RawStdEncoding.DecodeString(q.QualifierEncoded)
		if err != nil {
			return nil, err
		}
		b.Qualifier = string(bytes)
	}
	return b, nil
}
