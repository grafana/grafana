// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

// Package write provides the Point struct
package write

import (
	"fmt"
	"sort"
	"time"

	lp "github.com/influxdata/line-protocol"
)

// Point is represents InfluxDB time series point, holding tags and fields
type Point struct {
	measurement string
	tags        []*lp.Tag
	fields      []*lp.Field
	timestamp   time.Time
}

// TagList returns a slice containing tags of a Point.
func (m *Point) TagList() []*lp.Tag {
	return m.tags
}

// FieldList returns a slice containing the fields of a Point.
func (m *Point) FieldList() []*lp.Field {
	return m.fields
}

// SetTime set timestamp for a Point.
func (m *Point) SetTime(timestamp time.Time) *Point {
	m.timestamp = timestamp
	return m
}

// Time is the timestamp of a Point.
func (m *Point) Time() time.Time {
	return m.timestamp
}

// SortTags orders the tags of a point alphanumerically by key.
// This is just here as a helper, to make it easy to keep tags sorted if you are creating a Point manually.
func (m *Point) SortTags() *Point {
	sort.Slice(m.tags, func(i, j int) bool { return m.tags[i].Key < m.tags[j].Key })
	return m
}

// SortFields orders the fields of a point alphanumerically by key.
func (m *Point) SortFields() *Point {
	sort.Slice(m.fields, func(i, j int) bool { return m.fields[i].Key < m.fields[j].Key })
	return m
}

// AddTag adds a tag to a point.
func (m *Point) AddTag(k, v string) *Point {
	for i, tag := range m.tags {
		if k == tag.Key {
			m.tags[i].Value = v
			return m
		}
	}
	m.tags = append(m.tags, &lp.Tag{Key: k, Value: v})
	return m
}

// AddField adds a field to a point.
func (m *Point) AddField(k string, v interface{}) *Point {
	for i, field := range m.fields {
		if k == field.Key {
			m.fields[i].Value = v
			return m
		}
	}
	m.fields = append(m.fields, &lp.Field{Key: k, Value: convertField(v)})
	return m
}

// Name returns the name of measurement of a point.
func (m *Point) Name() string {
	return m.measurement
}

// NewPointWithMeasurement creates a empty Point
// Use AddTag and AddField to fill point with data
func NewPointWithMeasurement(measurement string) *Point {
	return &Point{measurement: measurement}
}

// NewPoint creates a Point from measurement name, tags, fields and a timestamp.
func NewPoint(
	measurement string,
	tags map[string]string,
	fields map[string]interface{},
	ts time.Time,
) *Point {
	m := &Point{
		measurement: measurement,
		tags:        nil,
		fields:      nil,
		timestamp:   ts,
	}

	if len(tags) > 0 {
		m.tags = make([]*lp.Tag, 0, len(tags))
		for k, v := range tags {
			m.tags = append(m.tags,
				&lp.Tag{Key: k, Value: v})
		}
	}

	m.fields = make([]*lp.Field, 0, len(fields))
	for k, v := range fields {
		v := convertField(v)
		if v == nil {
			continue
		}
		m.fields = append(m.fields, &lp.Field{Key: k, Value: v})
	}
	m.SortFields()
	m.SortTags()
	return m
}

// convertField converts any primitive type to types supported by line protocol
func convertField(v interface{}) interface{} {
	switch v := v.(type) {
	case bool, int64, string, float64:
		return v
	case int:
		return int64(v)
	case uint:
		return uint64(v)
	case uint64:
		return v
	case []byte:
		return string(v)
	case int32:
		return int64(v)
	case int16:
		return int64(v)
	case int8:
		return int64(v)
	case uint32:
		return uint64(v)
	case uint16:
		return uint64(v)
	case uint8:
		return uint64(v)
	case float32:
		return float64(v)
	case time.Time:
		return v.Format(time.RFC3339Nano)
	case time.Duration:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}
