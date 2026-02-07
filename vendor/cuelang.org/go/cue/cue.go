// Copyright 2020 CUE Authors
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

// Package cue is the main API for CUE evaluation.
//
// Value is the main type that represents CUE evaluations. Values are created
// with a cue.Context. Only values created from the same Context can be
// involved in the same operation.
//
// A Context defines the set of active packages, the translations of field
// names to unique codes, as well as the set of builtins. Use
//
//	import "cuelang.org/go/cue/cuecontext"
//
//	ctx := cuecontext.New()
//
// to obtain a context.
//
// Note that the following types are DEPRECATED and their usage should be
// avoided if possible:
//
//	FieldInfo
//	Instance
//	Runtime
//	Struct
//
// Many types also have deprecated methods. Code that already uses deprecated
// methods can keep using them for at least some time. We aim to provide a
// go or cue fix solution to automatically rewrite code using the new API.
package cue
