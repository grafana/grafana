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

package metrics

// Gauge returns instantaneous measurements of something as an int64 value
type Gauge interface {
	// Update the gauge to the value passed in.
	Update(int64)
}

// NullGauge gauge that does nothing
var NullGauge Gauge = nullGauge{}

type nullGauge struct{}

func (nullGauge) Update(int64) {}
