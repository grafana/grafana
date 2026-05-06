// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package debug

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
)

var (
	output = os.Stdout
)

// GetLogger provides a prefix debug logger
func GetLogger(prefix string, debug bool) func(string, ...interface{}) {
	if debug {
		logger := log.New(output, prefix+":", log.LstdFlags)

		return func(msg string, args ...interface{}) {
			_, file1, pos1, _ := runtime.Caller(1)
			logger.Printf("%s:%d: %s", filepath.Base(file1), pos1, fmt.Sprintf(msg, args...))
		}
	}

	return func(_ string, _ ...interface{}) {}
}
