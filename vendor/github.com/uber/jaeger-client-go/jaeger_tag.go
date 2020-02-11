// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaeger

import (
	"fmt"

	"github.com/opentracing/opentracing-go/log"

	j "github.com/uber/jaeger-client-go/thrift-gen/jaeger"
)

type tags []*j.Tag

// ConvertLogsToJaegerTags converts log Fields into jaeger tags.
func ConvertLogsToJaegerTags(logFields []log.Field) []*j.Tag {
	fields := tags(make([]*j.Tag, 0, len(logFields)))
	for _, field := range logFields {
		field.Marshal(&fields)
	}
	return fields
}

func (t *tags) EmitString(key, value string) {
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_STRING, VStr: &value})
}

func (t *tags) EmitBool(key string, value bool) {
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_BOOL, VBool: &value})
}

func (t *tags) EmitInt(key string, value int) {
	vLong := int64(value)
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_LONG, VLong: &vLong})
}

func (t *tags) EmitInt32(key string, value int32) {
	vLong := int64(value)
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_LONG, VLong: &vLong})
}

func (t *tags) EmitInt64(key string, value int64) {
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_LONG, VLong: &value})
}

func (t *tags) EmitUint32(key string, value uint32) {
	vLong := int64(value)
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_LONG, VLong: &vLong})
}

func (t *tags) EmitUint64(key string, value uint64) {
	vLong := int64(value)
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_LONG, VLong: &vLong})
}

func (t *tags) EmitFloat32(key string, value float32) {
	vDouble := float64(value)
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_DOUBLE, VDouble: &vDouble})
}

func (t *tags) EmitFloat64(key string, value float64) {
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_DOUBLE, VDouble: &value})
}

func (t *tags) EmitObject(key string, value interface{}) {
	vStr := fmt.Sprintf("%+v", value)
	*t = append(*t, &j.Tag{Key: key, VType: j.TagType_STRING, VStr: &vStr})
}

func (t *tags) EmitLazyLogger(value log.LazyLogger) {
	value(t)
}
