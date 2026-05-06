// Copyright 2023 Dolthub, Inc.
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

package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type SrsAttribute struct {
	Name         string
	Definition   string
	Organization string
	Description  string
	OrgID        uint32
}

// CreateSpatialRefSys represents the statement CREATE SPATIAL REFERENCE SYSTEM ...
type CreateSpatialRefSys struct {
	SrsAttr     SrsAttribute
	SRID        uint32
	OrReplace   bool
	IfNotExists bool
}

var _ sql.Node = (*CreateSpatialRefSys)(nil)

func NewCreateSpatialRefSys(srid uint32, orReplace, ifNotExists bool, srsAttr SrsAttribute) (sql.Node, error) {
	return &CreateSpatialRefSys{
		SRID:        srid,
		OrReplace:   orReplace,
		IfNotExists: ifNotExists,
		SrsAttr:     srsAttr,
	}, nil
}

// Resolved implements the interface sql.Node
func (n *CreateSpatialRefSys) Resolved() bool {
	return true
}

// String implements the interface sql.Node
func (n *CreateSpatialRefSys) String() string {
	str := "CREATE "
	if n.OrReplace {
		str += "OR REPLACE "
	}
	str += "SPATIAL REFERENCE SYSTEM "
	if n.IfNotExists {
		str += "IF NOT EXISTS "
	}
	str += fmt.Sprintf("NAME '%s' ", n.SrsAttr.Name)
	str += fmt.Sprintf("DEFINITION '%s' ", n.SrsAttr.Definition)
	str += fmt.Sprintf("ORGANIZATION '%s' IDENTIFIED BY %v ", n.SrsAttr.Organization, n.SrsAttr.OrgID)
	str += fmt.Sprintf("DESCRIPTION '%s' ", n.SrsAttr.Description)
	return str
}

// Schema implements the interface sql.Node
func (n *CreateSpatialRefSys) Schema() sql.Schema {
	return types.OkResultSchema
}

func (n *CreateSpatialRefSys) IsReadOnly() bool {
	return false
}

// Children implements the interface sql.Node
func (n *CreateSpatialRefSys) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node
func (n *CreateSpatialRefSys) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	nn := *n
	return &nn, nil
}
