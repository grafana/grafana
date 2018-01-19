// Copyright 2016 Google Inc. All Rights Reserved.
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
	"io"

	bq "google.golang.org/api/bigquery/v2"
)

// A ReaderSource is a source for a load operation that gets
// data from an io.Reader.
//
// When a ReaderSource is part of a LoadConfig obtained via Job.Config,
// its internal io.Reader will be nil, so it cannot be used for a
// subsequent load operation.
type ReaderSource struct {
	r io.Reader
	FileConfig
}

// NewReaderSource creates a ReaderSource from an io.Reader. You may
// optionally configure properties on the ReaderSource that describe the
// data being read, before passing it to Table.LoaderFrom.
func NewReaderSource(r io.Reader) *ReaderSource {
	return &ReaderSource{r: r}
}

func (r *ReaderSource) populateLoadConfig(lc *bq.JobConfigurationLoad) io.Reader {
	r.FileConfig.populateLoadConfig(lc)
	return r.r
}

// FileConfig contains configuration options that pertain to files, typically
// text files that require interpretation to be used as a BigQuery table. A
// file may live in Google Cloud Storage (see GCSReference), or it may be
// loaded into a table via the Table.LoaderFromReader.
type FileConfig struct {
	// SourceFormat is the format of the GCS data to be read.
	// Allowed values are: CSV, Avro, JSON, DatastoreBackup.  The default is CSV.
	SourceFormat DataFormat

	// Indicates if we should automatically infer the options and
	// schema for CSV and JSON sources.
	AutoDetect bool

	// MaxBadRecords is the maximum number of bad records that will be ignored
	// when reading data.
	MaxBadRecords int64

	// IgnoreUnknownValues causes values not matching the schema to be
	// tolerated. Unknown values are ignored. For CSV this ignores extra values
	// at the end of a line. For JSON this ignores named values that do not
	// match any column name. If this field is not set, records containing
	// unknown values are treated as bad records. The MaxBadRecords field can
	// be used to customize how bad records are handled.
	IgnoreUnknownValues bool

	// Schema describes the data. It is required when reading CSV or JSON data,
	// unless the data is being loaded into a table that already exists.
	Schema Schema

	// Additional options for CSV files.
	CSVOptions
}

func (fc *FileConfig) populateLoadConfig(conf *bq.JobConfigurationLoad) {
	conf.SkipLeadingRows = fc.SkipLeadingRows
	conf.SourceFormat = string(fc.SourceFormat)
	conf.Autodetect = fc.AutoDetect
	conf.AllowJaggedRows = fc.AllowJaggedRows
	conf.AllowQuotedNewlines = fc.AllowQuotedNewlines
	conf.Encoding = string(fc.Encoding)
	conf.FieldDelimiter = fc.FieldDelimiter
	conf.IgnoreUnknownValues = fc.IgnoreUnknownValues
	conf.MaxBadRecords = fc.MaxBadRecords
	if fc.Schema != nil {
		conf.Schema = fc.Schema.toBQ()
	}
	conf.Quote = fc.quote()
}

func bqPopulateFileConfig(conf *bq.JobConfigurationLoad, fc *FileConfig) {
	fc.SourceFormat = DataFormat(conf.SourceFormat)
	fc.AutoDetect = conf.Autodetect
	fc.MaxBadRecords = conf.MaxBadRecords
	fc.IgnoreUnknownValues = conf.IgnoreUnknownValues
	fc.Schema = bqToSchema(conf.Schema)
	fc.SkipLeadingRows = conf.SkipLeadingRows
	fc.AllowJaggedRows = conf.AllowJaggedRows
	fc.AllowQuotedNewlines = conf.AllowQuotedNewlines
	fc.Encoding = Encoding(conf.Encoding)
	fc.FieldDelimiter = conf.FieldDelimiter
	fc.CSVOptions.setQuote(conf.Quote)
}

func (fc *FileConfig) populateExternalDataConfig(conf *bq.ExternalDataConfiguration) {
	format := fc.SourceFormat
	if format == "" {
		// Format must be explicitly set for external data sources.
		format = CSV
	}
	conf.Autodetect = fc.AutoDetect
	conf.IgnoreUnknownValues = fc.IgnoreUnknownValues
	conf.MaxBadRecords = fc.MaxBadRecords
	conf.SourceFormat = string(format)
	if fc.Schema != nil {
		conf.Schema = fc.Schema.toBQ()
	}
	if format == CSV {
		fc.CSVOptions.populateExternalDataConfig(conf)
	}
}

// Encoding specifies the character encoding of data to be loaded into BigQuery.
// See https://cloud.google.com/bigquery/docs/reference/v2/jobs#configuration.load.encoding
// for more details about how this is used.
type Encoding string

const (
	UTF_8      Encoding = "UTF-8"
	ISO_8859_1 Encoding = "ISO-8859-1"
)
