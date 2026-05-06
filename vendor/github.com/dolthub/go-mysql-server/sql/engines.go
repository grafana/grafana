// Copyright 2021 Dolthub, Inc.
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

import "fmt"

// Engine represents a sql engine.
type Engine struct {
	Name        string
	support     string
	comment     string
	transaction string
	xa          string
	savepoints  string
}

var SupportedEngines = []Engine{
	{Name: "InnoDB", support: "DEFAULT", comment: "Supports transactions, row-level locking, and foreign keys", transaction: "YES", xa: "YES", savepoints: "YES"},
}

// Support returns the server's level of support for the storage engine,
func (e Engine) Support() string {
	support := e.support
	if support == "" {
		panic(fmt.Sprintf("%v does not have a default support set", e.String()))
	}
	return support
}

// Comment returns a brief description of the storage engine.
func (e Engine) Comment() string {
	comment := e.comment
	if comment == "" {
		panic(fmt.Sprintf("%v does not have a comment", e.String()))
	}
	return comment
}

// Transactions returns whether the storage engine supports transactions.
func (e Engine) Transactions() string {
	transaction := e.transaction
	if transaction == "" {
		panic(fmt.Sprintf("%v does not have a tranasaction", e.String()))
	}
	return transaction
}

// XA returns whether the storage engine supports XA transactions.
func (e Engine) XA() string {
	xa := e.xa
	if e.xa == "" {
		panic(fmt.Sprintf("%v does not have xa support determined", e.String()))
	}
	return xa
}

// Savepoints returns whether the storage engine supports savepoints.
func (e Engine) Savepoints() string {
	savepoints := e.savepoints
	if savepoints == "" {
		panic(fmt.Sprintf("%v does not have a default savepoints set", e.String()))
	}
	return savepoints
}

// String returns the string representation of the Engine.
func (e Engine) String() string {
	return e.Name
}
