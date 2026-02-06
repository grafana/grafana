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
	"github.com/dolthub/vitess/go/mysql"
	"github.com/dolthub/vitess/go/vt/proto/query"
)

// MysqlConnectionUser is stored in mysql's connection as UserData once a connection has been authenticated.
type MysqlConnectionUser struct {
	User string
	Host string
}

var _ mysql.Getter = MysqlConnectionUser{}

// Get implements the interface mysql.Getter.
func (m MysqlConnectionUser) Get() *query.VTGateCallerID {
	return &query.VTGateCallerID{Username: m.User, Groups: nil}
}
