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

package casbin

import "errors"

// NewEnforcerSafe calls NewEnforcer in a safe way, returns error instead of causing panic.
func NewEnforcerSafe(params ...interface{}) (e *Enforcer, err error) {
	defer func() {
		if r := recover(); r != nil {
			switch x := r.(type) {
			case string:
				err = errors.New(x)
			case error:
				err = x
			default:
				err = errors.New("Unknown panic")
			}

			e = nil
		}
	}()

	e = NewEnforcer(params...)
	err = nil
	return
}

// LoadModelSafe calls LoadModel in a safe way, returns error instead of causing panic.
func (e *Enforcer) LoadModelSafe() (err error) {
	defer func() {
		if r := recover(); r != nil {
			switch x := r.(type) {
			case string:
				err = errors.New(x)
			case error:
				err = x
			default:
				err = errors.New("Unknown panic")
			}
		}
	}()

	e.LoadModel()
	err = nil
	return
}

// LoadPolicySafe calls LoadPolicy in a safe way, returns error instead of causing panic.
func (e *Enforcer) LoadPolicySafe() (err error) {
	defer func() {
		if r := recover(); r != nil {
			switch x := r.(type) {
			case string:
				err = errors.New(x)
			case error:
				err = x
			default:
				err = errors.New("Unknown panic")
			}
		}
	}()

	e.LoadPolicy()
	err = nil
	return
}

// SavePolicySafe calls SavePolicy in a safe way, returns error instead of causing panic.
func (e *Enforcer) SavePolicySafe() (err error) {
	defer func() {
		if r := recover(); r != nil {
			switch x := r.(type) {
			case string:
				err = errors.New(x)
			case error:
				err = x
			default:
				err = errors.New("Unknown panic")
			}
		}
	}()

	e.SavePolicy()
	err = nil
	return
}

// EnforceSafe calls Enforce in a safe way, returns error instead of causing panic.
func (e *Enforcer) EnforceSafe(rvals ...interface{}) (result bool, err error) {
	defer func() {
		if r := recover(); r != nil {
			switch x := r.(type) {
			case string:
				err = errors.New(x)
			case error:
				err = x
			default:
				err = errors.New("Unknown panic")
			}

			result = false
		}
	}()

	result = e.Enforce(rvals...)
	err = nil
	return
}
