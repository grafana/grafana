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
	"io"

	bq "google.golang.org/api/bigquery/v2"
)

// GCSReference is a reference to one or more Google Cloud Storage objects, which together constitute
// an input or output to a BigQuery operation.
type GCSReference struct {
	// URIs refer to Google Cloud Storage objects.
	URIs []string

	FileConfig

	// DestinationFormat is the format to use when writing exported files.
	// Allowed values are: CSV, Avro, JSON.  The default is CSV.
	// CSV is not supported for tables with nested or repeated fields.
	DestinationFormat DataFormat

	// Compression specifies the type of compression to apply when writing data
	// to Google Cloud Storage, or using this GCSReference as an ExternalData
	// source with CSV or JSON SourceFormat. Default is None.
	Compression Compression
}

// NewGCSReference constructs a reference to one or more Google Cloud Storage objects, which together constitute a data source or destination.
// In the simple case, a single URI in the form gs://bucket/object may refer to a single GCS object.
// Data may also be split into mutiple files, if multiple URIs or URIs containing wildcards are provided.
// Each URI may contain one '*' wildcard character, which (if present) must come after the bucket name.
// For more information about the treatment of wildcards and multiple URIs,
// see https://cloud.google.com/bigquery/exporting-data-from-bigquery#exportingmultiple
func NewGCSReference(uri ...string) *GCSReference {
	return &GCSReference{URIs: uri}
}

// Compression is the type of compression to apply when writing data to Google Cloud Storage.
type Compression string

const (
	None Compression = "NONE"
	Gzip Compression = "GZIP"
)

func (gcs *GCSReference) populateLoadConfig(lc *bq.JobConfigurationLoad) io.Reader {
	lc.SourceUris = gcs.URIs
	gcs.FileConfig.populateLoadConfig(lc)
	return nil
}

func (gcs *GCSReference) toBQ() bq.ExternalDataConfiguration {
	conf := bq.ExternalDataConfiguration{
		Compression: string(gcs.Compression),
		SourceUris:  append([]string{}, gcs.URIs...),
	}
	gcs.FileConfig.populateExternalDataConfig(&conf)
	return conf
}
