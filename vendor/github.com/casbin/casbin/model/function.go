// Copyright 2017 The casbin Authors. All Rights Reserved.
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

package model

import "github.com/casbin/casbin/util"

// FunctionMap represents the collection of Function.
type FunctionMap map[string]func(args ...interface{}) (interface{}, error)

// Function represents a function that is used in the matchers, used to get attributes in ABAC.
type Function func(args ...interface{}) (interface{}, error)

// AddFunction adds an expression function.
func (fm FunctionMap) AddFunction(name string, function Function) {
	fm[name] = function
}

// LoadFunctionMap loads an initial function map.
func LoadFunctionMap() FunctionMap {
	fm := make(FunctionMap)

	fm.AddFunction("keyMatch", util.KeyMatchFunc)
	fm.AddFunction("keyMatch2", util.KeyMatch2Func)
	fm.AddFunction("regexMatch", util.RegexMatchFunc)
	fm.AddFunction("ipMatch", util.IPMatchFunc)

	return fm
}
