// Copyright 2021-2024 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package connect

import (
	"strings"
)

// extractProtoPath returns the trailing portion of the URL's path,
// corresponding to the Protobuf package, service, and method. It always starts
// with a slash. Within connect, we use this as (1) Spec.Procedure and (2) the
// path when mounting handlers on muxes.
func extractProtoPath(path string) string {
	segments := strings.Split(path, "/")
	var pkg, method string
	if len(segments) > 0 {
		pkg = segments[0]
	}
	if len(segments) > 1 {
		pkg = segments[len(segments)-2]
		method = segments[len(segments)-1]
	}
	if pkg == "" {
		return "/"
	}
	if method == "" {
		return "/" + pkg
	}
	return "/" + pkg + "/" + method
}
