// Copyright 2024 Dolthub, Inc.
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
	ast "github.com/dolthub/vitess/go/vt/sqlparser"
)

// NoopAuthorizationHandlerFactory is the AuthorizationHandlerFactory for emptyAuthorizationHandler.
type NoopAuthorizationHandlerFactory struct{}

var _ AuthorizationHandlerFactory = NoopAuthorizationHandlerFactory{}

// CreateHandler implements the AuthorizationHandlerFactory interface.
func (NoopAuthorizationHandlerFactory) CreateHandler(cat Catalog) AuthorizationHandler {
	return NoopAuthorizationHandler{}
}

// NoopAuthorizationHandler will always return a "true" result.
type NoopAuthorizationHandler struct{}

var _ AuthorizationHandler = NoopAuthorizationHandler{}

// NewQueryState implements the AuthorizationHandler interface.
func (NoopAuthorizationHandler) NewQueryState(ctx *Context) AuthorizationQueryState {
	return nil
}

// HandleAuth implements the AuthorizationHandler interface.
func (NoopAuthorizationHandler) HandleAuth(ctx *Context, aqs AuthorizationQueryState, auth ast.AuthInformation) error {
	return nil
}

// HandleAuthNode implements the AuthorizationHandler interface.
func (NoopAuthorizationHandler) HandleAuthNode(ctx *Context, state AuthorizationQueryState, node AuthorizationCheckerNode) error {
	return nil
}

// CheckDatabase implements the AuthorizationHandler interface.
func (NoopAuthorizationHandler) CheckDatabase(ctx *Context, aqs AuthorizationQueryState, dbName string) error {
	return nil
}

// CheckSchema implements the AuthorizationHandler interface.
func (NoopAuthorizationHandler) CheckSchema(ctx *Context, aqs AuthorizationQueryState, dbName string, schemaName string) error {
	return nil
}

// CheckTable implements the AuthorizationHandler interface.
func (NoopAuthorizationHandler) CheckTable(ctx *Context, aqs AuthorizationQueryState, dbName string, schemaName string, tableName string) error {
	return nil
}
