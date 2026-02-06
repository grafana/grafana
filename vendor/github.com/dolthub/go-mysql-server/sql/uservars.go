// Copyright 2022 Dolthub, Inc.
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

package sql

import (
	"strings"
	"sync"
)

// SessionUserVariables is a simple dictionary to set and retrieve user variables within a session.
type SessionUserVariables interface {
	// SetUserVariable sets the user variable name to the given value and type
	SetUserVariable(ctx *Context, varName string, value interface{}, typ Type) error
	// GetUserVariable returns the value and type of the user variable named
	GetUserVariable(ctx *Context, varName string) (Type, interface{}, error)
}

type UserVars struct {
	userVars map[string]TypedValue
	mu       *sync.RWMutex
}

var _ SessionUserVariables = (*UserVars)(nil)

func NewUserVars() SessionUserVariables {
	return &UserVars{
		userVars: make(map[string]TypedValue),
		mu:       &sync.RWMutex{},
	}
}

func (u *UserVars) SetUserVariable(ctx *Context, varName string, value interface{}, typ Type) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.userVars[strings.ToLower(varName)] = TypedValue{Value: value, Typ: typ}
	return nil
}

// GetUserVariable implements the Session interface.
func (u *UserVars) GetUserVariable(ctx *Context, varName string) (Type, interface{}, error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	val, ok := u.userVars[strings.ToLower(varName)]
	if !ok {
		return nil, nil, nil
	}

	return val.Typ, val.Value, nil
}
