// Copyright 2016 The Prometheus Authors
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

package testutil

import "time"

// A MockContext provides a simple stub implementation of a Context
type MockContext struct {
	Error  error
	DoneCh chan struct{}
}

// Deadline always will return not set
func (c *MockContext) Deadline() (deadline time.Time, ok bool) {
	return time.Time{}, false
}

// Done returns a read channel for listening to the Done event
func (c *MockContext) Done() <-chan struct{} {
	return c.DoneCh
}

// Err returns the error, is nil if not set.
func (c *MockContext) Err() error {
	return c.Error
}

// Value ignores the Value and always returns nil
func (c *MockContext) Value(key interface{}) interface{} {
	return nil
}
