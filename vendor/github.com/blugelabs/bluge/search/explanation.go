//  Copyright (c) 2020 Couchbase, Inc.
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
)

type Explanation struct {
	Value    float64        `json:"value"`
	Message  string         `json:"message"`
	Children []*Explanation `json:"children,omitempty"`
}

func NewExplanation(value float64, msg string, children ...*Explanation) *Explanation {
	return &Explanation{
		Value:    value,
		Message:  msg,
		Children: children,
	}
}

func (e *Explanation) String() string {
	js, err := json.MarshalIndent(e, "", "  ")
	if err != nil {
		return fmt.Sprintf("error serializing explanation to json: %v", err)
	}
	return string(js)
}

func (e *Explanation) Size() int {
	sizeInBytes := reflectStaticSizeExplanation + sizeOfPtr +
		len(e.Message)

	for _, entry := range e.Children {
		sizeInBytes += entry.Size()
	}

	return sizeInBytes
}
