// Copyright 2019 The mqtt-go authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mqtt

import (
	"errors"
	"strings"
)

// ErrInvalidTopicFilter means that the topic filter string is invalid.
var ErrInvalidTopicFilter = errors.New("invalid topic filter")

type topicFilter []string

func newTopicFilter(filter string) (topicFilter, error) {
	if len(filter) == 0 {
		return nil, wrapError(ErrInvalidTopicFilter, "empty filter")
	}
	tf := strings.Split(filter, "/")

	// Validate according to MQTT 3.1.1 spec. 4.7.1
	for i, f := range tf {
		if strings.Contains(f, "+") {
			if len(f) != 1 {
				return nil, wrapError(ErrInvalidTopicFilter, "invalid + usage")
			}
		}
		if strings.Contains(f, "#") {
			if len(f) != 1 || i != len(tf)-1 {
				return nil, wrapError(ErrInvalidTopicFilter, "invalid # usage")
			}
		}
	}
	return tf, nil
}

func (f topicFilter) Match(topic string) bool {
	ts := strings.Split(topic, "/")

	var i int
	for i = 0; i < len(f); i++ {
		t := f[i]
		if t == "#" {
			return true
		}
		if i >= len(ts) {
			return false
		}
		if t != "+" && t != ts[i] {
			return false
		}
	}
	return i == len(ts)
}
