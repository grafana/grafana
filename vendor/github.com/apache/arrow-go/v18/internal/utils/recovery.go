// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import "fmt"

// FormatRecoveredError is used in cases where a panic/recover receives an
// object which is potentially an error that could be wrapped, instead of
// formatted, so that callers can see it.  This may be useful, for example,
// with custom Allocators which panic to signal failure; these panics will be
// recovered as wrapped errors, letting the client distinguish them.
func FormatRecoveredError(msg string, recovered any) error {
	if err, ok := recovered.(error); ok {
		return fmt.Errorf("%s: %w", msg, err)
	}
	return fmt.Errorf("%s: %v", msg, recovered)
}
