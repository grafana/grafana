// Copyright 2016 Google Inc. All Rights Reserved.
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

package internal

import (
	"fmt"
	"strings"
)

const (
	ProdAddr = "logging.googleapis.com:443"
	Version  = "0.2.0"
)

func LogPath(parent, logID string) string {
	logID = strings.Replace(logID, "/", "%2F", -1)
	return fmt.Sprintf("%s/logs/%s", parent, logID)
}

func LogIDFromPath(parent, path string) string {
	start := len(parent) + len("/logs/")
	if len(path) < start {
		return ""
	}
	logID := path[start:]
	return strings.Replace(logID, "%2F", "/", -1)
}
