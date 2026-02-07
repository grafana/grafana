//  Copyright (c) 2023 Couchbase, Inc.
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

package milliseconds

import (
	"math"
	"strconv"
	"time"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"
)

const Name = "unix_milli"

type DateTimeParser struct {
}

var minBound int64 = math.MinInt64 / 1000000
var maxBound int64 = math.MaxInt64 / 1000000

func (p *DateTimeParser) ParseDateTime(input string) (time.Time, string, error) {
	// unix timestamp is milliseconds since UNIX epoch
	timestamp, err := strconv.ParseInt(input, 10, 64)
	if err != nil {
		return time.Time{}, "", analysis.ErrInvalidTimestampString
	}
	if timestamp < minBound || timestamp > maxBound {
		return time.Time{}, "", analysis.ErrInvalidTimestampRange
	}
	return time.UnixMilli(timestamp), Name, nil
}

func DateTimeParserConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.DateTimeParser, error) {
	return &DateTimeParser{}, nil
}

func init() {
	err := registry.RegisterDateTimeParser(Name, DateTimeParserConstructor)
	if err != nil {
		panic(err)
	}
}
