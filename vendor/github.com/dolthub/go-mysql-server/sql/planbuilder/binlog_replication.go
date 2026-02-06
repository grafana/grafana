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

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/binlogreplication"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

func (b *Builder) buildChangeReplicationSource(inScope *scope, n *ast.ChangeReplicationSource) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	convertedOptions := make([]binlogreplication.ReplicationOption, 0, len(n.Options))
	for _, option := range n.Options {
		convertedOption := b.buildReplicationOption(inScope, option)
		convertedOptions = append(convertedOptions, *convertedOption)
	}
	repSrc := plan.NewChangeReplicationSource(convertedOptions)
	if binCat, ok := b.cat.(binlogreplication.BinlogReplicaCatalog); ok && binCat.HasBinlogReplicaController() {
		repSrc.ReplicaController = binCat.GetBinlogReplicaController()
	}
	outScope.node = repSrc
	return outScope
}

func (b *Builder) buildReplicationOption(inScope *scope, option *ast.ReplicationOption) *binlogreplication.ReplicationOption {
	if option.Value == nil {
		err := fmt.Errorf("nil replication option specified for option %q", option.Name)
		b.handleErr(err)
	}
	switch vv := option.Value.(type) {
	case string:
		return binlogreplication.NewReplicationOption(option.Name, binlogreplication.StringReplicationOptionValue{Value: vv})
	case int:
		return binlogreplication.NewReplicationOption(option.Name, binlogreplication.IntegerReplicationOptionValue{Value: vv})
	case ast.TableNames:
		urts := make([]sql.UnresolvedTable, len(vv))
		for i, tableName := range vv {
			// downstream logic expects these to specifically be unresolved tables
			urts[i] = plan.NewUnresolvedTable(tableName.Name.String(), tableName.DbQualifier.String())
		}
		return binlogreplication.NewReplicationOption(option.Name, binlogreplication.TableNamesReplicationOptionValue{Value: urts})
	default:
		err := fmt.Errorf("unsupported option value type '%T' specified for option %q", option.Value, option.Name)
		b.handleErr(err)
	}
	return nil
}

func (b *Builder) buildChangeReplicationFilter(inScope *scope, n *ast.ChangeReplicationFilter) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	convertedOptions := make([]binlogreplication.ReplicationOption, 0, len(n.Options))
	for _, option := range n.Options {
		convertedOption := b.buildReplicationOption(inScope, option)
		convertedOptions = append(convertedOptions, *convertedOption)
	}
	changeFilter := plan.NewChangeReplicationFilter(convertedOptions)
	if binCat, ok := b.cat.(binlogreplication.BinlogReplicaCatalog); ok && binCat.HasBinlogReplicaController() {
		changeFilter.ReplicaController = binCat.GetBinlogReplicaController()
	}
	outScope.node = changeFilter
	return outScope
}
