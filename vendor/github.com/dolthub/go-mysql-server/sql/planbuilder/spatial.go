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

package planbuilder

import (
	"fmt"
	"strconv"
	"unicode"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql/plan"
)

func (b *Builder) buildCreateSpatialRefSys(inScope *scope, n *ast.CreateSpatialRefSys) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	srid, err := strconv.ParseInt(string(n.SRID.Val), 10, 16)
	if err != nil {
		b.handleErr(err)
	}

	if n.SrsAttr == nil {
		b.handleErr(fmt.Errorf("missing attribute"))
	}

	if n.SrsAttr.Name == "" {
		b.handleErr(fmt.Errorf("missing mandatory attribute NAME"))
	}
	if unicode.IsSpace(rune(n.SrsAttr.Name[0])) || unicode.IsSpace(rune(n.SrsAttr.Name[len(n.SrsAttr.Name)-1])) {
		b.handleErr(fmt.Errorf("the spatial reference system name can't be an empty string or start or end with whitespace"))
	}
	// TODO: there are additional rules to validate the attribute definition
	if n.SrsAttr.Definition == "" {
		b.handleErr(fmt.Errorf("missing mandatory attribute DEFINITION"))
	}
	if n.SrsAttr.Organization == "" {
		b.handleErr(fmt.Errorf("missing mandatory attribute ORGANIZATION NAME"))
	}
	if unicode.IsSpace(rune(n.SrsAttr.Organization[0])) || unicode.IsSpace(rune(n.SrsAttr.Organization[len(n.SrsAttr.Organization)-1])) {
		b.handleErr(fmt.Errorf("the organization name can't be an empty string or start or end with whitespace"))
	}
	if n.SrsAttr.OrgID == nil {
		b.handleErr(fmt.Errorf("missing mandatory attribute ORGANIZATION ID"))
	}
	orgID, err := strconv.ParseInt(string(n.SrsAttr.OrgID.Val), 10, 16)
	if err != nil {
		b.handleErr(err)
	}

	srsAttr := plan.SrsAttribute{
		Name:         n.SrsAttr.Name,
		Definition:   n.SrsAttr.Definition,
		Organization: n.SrsAttr.Organization,
		OrgID:        uint32(orgID),
		Description:  n.SrsAttr.Description,
	}
	newN, err := plan.NewCreateSpatialRefSys(uint32(srid), n.OrReplace, n.IfNotExists, srsAttr)
	if err != nil {
		b.handleErr(err)
	}
	outScope.node = newN
	return outScope
}
