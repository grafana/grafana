//  Copyright (c) 2014 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package optional

import (
	"time"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/analysis/datetime/flexible"
	"github.com/blevesearch/bleve/v2/registry"
)

const Name = "dateTimeOptional"

const rfc3339NoTimezone = "2006-01-02T15:04:05"
const rfc3339NoTimezoneNoT = "2006-01-02 15:04:05"
const rfc3339Offset = "2006-01-02 15:04:05 -0700"
const rfc3339NoTime = "2006-01-02"

var layouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
	rfc3339NoTimezone,
	rfc3339NoTimezoneNoT,
	rfc3339Offset,
	rfc3339NoTime,
}

func DateTimeParserConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.DateTimeParser, error) {
	return flexible.New(layouts), nil
}

func init() {
	err := registry.RegisterDateTimeParser(Name, DateTimeParserConstructor)
	if err != nil {
		panic(err)
	}
}
