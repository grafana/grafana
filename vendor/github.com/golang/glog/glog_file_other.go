// Go support for leveled logs, analogous to https://github.com/google/glog.
//
// Copyright 2023 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !(unix || windows)

package glog

import (
	"fmt"
	"runtime"
)

// abortProcess returns an error on platforms that presumably don't support signals.
func abortProcess() error {
	return fmt.Errorf("not sending SIGABRT (%s/%s does not support signals), falling back", runtime.GOOS, runtime.GOARCH)

}
