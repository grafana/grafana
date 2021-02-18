// Copyright 2019 The Prometheus Authors
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

import (
	"testing"

	"github.com/go-kit/kit/log"
)

type logger struct {
	t *testing.T
}

// NewLogger returns a gokit compatible Logger which calls t.Log.
func NewLogger(t *testing.T) log.Logger {
	return logger{t: t}
}

// Log implements log.Logger.
func (t logger) Log(keyvals ...interface{}) error {
	t.t.Log(keyvals...)
	return nil
}
