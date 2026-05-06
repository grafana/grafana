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

package search

import (
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/blevesearch/bleve/v2/size"
)

var reflectStaticSizeExplanation int

func init() {
	var e Explanation
	reflectStaticSizeExplanation = int(reflect.TypeOf(e).Size())
}

type Explanation struct {
	Value        float64        `json:"value"`
	Message      string         `json:"message"`
	PartialMatch bool           `json:"partial_match,omitempty"`
	Children     []*Explanation `json:"children,omitempty"`
}

func (expl *Explanation) String() string {
	js, err := json.MarshalIndent(expl, "", "  ")
	if err != nil {
		return fmt.Sprintf("error serializing explanation to json: %v", err)
	}
	return string(js)
}

func (expl *Explanation) Size() int {
	sizeInBytes := reflectStaticSizeExplanation + size.SizeOfPtr +
		len(expl.Message)

	for _, entry := range expl.Children {
		sizeInBytes += entry.Size()
	}

	return sizeInBytes
}
