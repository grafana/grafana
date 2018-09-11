// Copyright (c) 2018 The Jaeger Authors.
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

package jaeger

// Process holds process specific metadata that's relevant to this client.
type Process struct {
	Service string
	UUID    string
	Tags    []Tag
}

// ProcessSetter sets a process. This can be used by any class that requires
// the process to be set as part of initialization.
// See internal/throttler/remote/throttler.go for an example.
type ProcessSetter interface {
	SetProcess(process Process)
}
