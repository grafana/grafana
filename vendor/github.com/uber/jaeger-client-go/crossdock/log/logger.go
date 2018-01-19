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

package log

import (
	real_log "log"
)

// Enabled controls logging from crossdock tests. It is enabled in main.go, but off in unit tests.
var Enabled bool

// Printf delegates to log.Printf if Enabled == true
func Printf(msg string, args ...interface{}) {
	if Enabled {
		real_log.Printf(msg, args)
	}
}
