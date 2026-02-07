// Copyright 2017 Google LLC. All Rights Reserved.
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

package compiler

import (
	"github.com/google/gnostic-models/compiler"
)

// Error represents compiler errors and their location in the document.
type Error = compiler.Error

// NewError creates an Error.
var NewError = compiler.NewError

// ErrorGroup is a container for groups of Error values.
type ErrorGroup = compiler.ErrorGroup

// NewErrorGroupOrNil returns a new ErrorGroup for a slice of errors or nil if the slice is empty.
var NewErrorGroupOrNil = compiler.NewErrorGroupOrNil
