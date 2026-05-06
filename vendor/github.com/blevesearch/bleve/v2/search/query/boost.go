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

package query

import "fmt"

type Boost float64

func (b *Boost) Value() float64 {
	if b == nil {
		return 1.0
	}
	return float64(*b)
}

func (b *Boost) GoString() string {
	if b == nil {
		return "boost unspecified"
	}
	return fmt.Sprintf("%f", *b)
}
