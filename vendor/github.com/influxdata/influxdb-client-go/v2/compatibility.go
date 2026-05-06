// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package influxdb2

import (
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
	"github.com/influxdata/influxdb-client-go/v2/domain"
	"time"
)

// Proxy methods for backward compatibility

// NewPointWithMeasurement creates a empty Point
// Use AddTag and AddField to fill point with data
func NewPointWithMeasurement(measurement string) *write.Point {
	return write.NewPointWithMeasurement(measurement)
}

// NewPoint creates a Point from measurement name, tags, fields and a timestamp.
func NewPoint(
	measurement string,
	tags map[string]string,
	fields map[string]interface{},
	ts time.Time,
) *write.Point {
	return write.NewPoint(measurement, tags, fields, ts)
}

// DefaultDialect return flux query Dialect with full annotations (datatype, group, default), header and comma char as a delimiter
func DefaultDialect() *domain.Dialect {
	return api.DefaultDialect()
}
