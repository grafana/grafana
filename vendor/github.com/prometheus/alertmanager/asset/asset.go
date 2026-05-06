// Copyright 2018 The Prometheus Authors
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

//go:build dev
// +build dev

package asset

import (
	"net/http"
	"os"
	"strings"

	"github.com/shurcooL/httpfs/filter"
	"github.com/shurcooL/httpfs/union"
)

var static http.FileSystem = filter.Keep(
	http.Dir("../ui/app"),
	func(path string, fi os.FileInfo) bool {
		return path == "/" ||
			path == "/script.js" ||
			path == "/index.html" ||
			path == "/favicon.ico" ||
			strings.HasPrefix(path, "/lib")
	},
)

var templates http.FileSystem = filter.Keep(
	http.Dir("../template"),
	func(path string, fi os.FileInfo) bool {
		return path == "/" || path == "/default.tmpl" || path == "/email.tmpl"
	},
)

// Assets contains the project's assets.
var Assets http.FileSystem = union.New(map[string]http.FileSystem{
	"/templates": templates,
	"/static":    static,
})
