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

package spanlog

import (
	"encoding/json"
	"fmt"

	"github.com/opentracing/opentracing-go/log"
)

type fieldsAsMap map[string]string

// MaterializeWithJSON converts log Fields into JSON string
// TODO refactor into pluggable materializer
func MaterializeWithJSON(logFields []log.Field) ([]byte, error) {
	fields := fieldsAsMap(make(map[string]string, len(logFields)))
	for _, field := range logFields {
		field.Marshal(fields)
	}
	if event, ok := fields["event"]; ok && len(fields) == 1 {
		return []byte(event), nil
	}
	return json.Marshal(fields)
}

func (ml fieldsAsMap) EmitString(key, value string) {
	ml[key] = value
}

func (ml fieldsAsMap) EmitBool(key string, value bool) {
	ml[key] = fmt.Sprintf("%t", value)
}

func (ml fieldsAsMap) EmitInt(key string, value int) {
	ml[key] = fmt.Sprintf("%d", value)
}

func (ml fieldsAsMap) EmitInt32(key string, value int32) {
	ml[key] = fmt.Sprintf("%d", value)
}

func (ml fieldsAsMap) EmitInt64(key string, value int64) {
	ml[key] = fmt.Sprintf("%d", value)
}

func (ml fieldsAsMap) EmitUint32(key string, value uint32) {
	ml[key] = fmt.Sprintf("%d", value)
}

func (ml fieldsAsMap) EmitUint64(key string, value uint64) {
	ml[key] = fmt.Sprintf("%d", value)
}

func (ml fieldsAsMap) EmitFloat32(key string, value float32) {
	ml[key] = fmt.Sprintf("%f", value)
}

func (ml fieldsAsMap) EmitFloat64(key string, value float64) {
	ml[key] = fmt.Sprintf("%f", value)
}

func (ml fieldsAsMap) EmitObject(key string, value interface{}) {
	ml[key] = fmt.Sprintf("%+v", value)
}

func (ml fieldsAsMap) EmitLazyLogger(value log.LazyLogger) {
	value(ml)
}
