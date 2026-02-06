// Copyright 2020-2021 Dolthub, Inc.
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
	"github.com/dolthub/go-mysql-server/sql"
)

type TriggerEvent string

const (
	InsertTrigger TriggerEvent = "insert"
	UpdateTrigger              = "update"
	DeleteTrigger              = "delete"
)

type TriggerTime string

const (
	BeforeTrigger TriggerTime = "before"
	AfterTrigger              = "after"
)

// TriggerExecutor is node that wraps, or is wrapped by, an INSERT, UPDATE, or DELETE node to execute defined trigger
// logic either before or after that operation. When a table has multiple triggers defined, TriggerExecutor nodes can
// wrap each other as well.
type TriggerExecutor struct {
	BinaryNode        // Left = wrapped node, Right = trigger execution logic
	TriggerEvent      TriggerEvent
	TriggerTime       TriggerTime
	TriggerDefinition sql.TriggerDefinition
}

var _ sql.Node = (*TriggerExecutor)(nil)
var _ sql.CollationCoercible = (*TriggerExecutor)(nil)

func NewTriggerExecutor(child, triggerLogic sql.Node, triggerEvent TriggerEvent, triggerTime TriggerTime, triggerDefinition sql.TriggerDefinition) *TriggerExecutor {
	return &TriggerExecutor{
		BinaryNode: BinaryNode{
			left:  child,
			right: triggerLogic,
		},
		TriggerEvent:      triggerEvent,
		TriggerTime:       triggerTime,
		TriggerDefinition: triggerDefinition,
	}
}

func (t *TriggerExecutor) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Trigger(%s)", t.TriggerDefinition.CreateStatement)
	_ = pr.WriteChildren(t.left.String())
	return pr.String()
}

func (t *TriggerExecutor) IsReadOnly() bool {
	return t.left.IsReadOnly() && t.right.IsReadOnly()
}

func (t *TriggerExecutor) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Trigger(%s)", t.TriggerDefinition.CreateStatement)
	_ = pr.WriteChildren(sql.DebugString(t.left), sql.DebugString(t.right))
	return pr.String()
}

func (t *TriggerExecutor) Schema() sql.Schema {
	return t.left.Schema()
}

func (t *TriggerExecutor) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 2)
	}

	return NewTriggerExecutor(children[0], children[1], t.TriggerEvent, t.TriggerTime, t.TriggerDefinition), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (t *TriggerExecutor) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, t.left)
}
