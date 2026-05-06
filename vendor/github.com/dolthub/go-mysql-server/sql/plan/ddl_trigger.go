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
	"fmt"
	"time"

	"github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type TriggerOrder struct {
	PrecedesOrFollows string // PrecedesStr, FollowsStr
	OtherTriggerName  string
}

type CreateTrigger struct {
	ddlNode
	TriggerName         string
	TriggerTime         string
	TriggerEvent        string
	TriggerOrder        *TriggerOrder
	Table               sql.Node
	Body                sql.Node
	CreateTriggerString string
	BodyString          string
	CreatedAt           time.Time
	Definer             string
	SqlMode             string
}

var _ sql.Node = (*CreateTrigger)(nil)
var _ sql.CollationCoercible = (*CreateTrigger)(nil)

func NewCreateTrigger(triggerDb sql.Database,
	triggerName,
	triggerTime,
	triggerEvent string,
	triggerOrder *TriggerOrder,
	table sql.Node,
	body sql.Node,
	createTriggerString,
	bodyString string,
	createdAt time.Time,
	definer string) *CreateTrigger {
	return &CreateTrigger{
		ddlNode:             ddlNode{Db: triggerDb},
		TriggerName:         triggerName,
		TriggerTime:         triggerTime,
		TriggerEvent:        triggerEvent,
		TriggerOrder:        triggerOrder,
		Table:               table,
		Body:                body,
		BodyString:          bodyString,
		CreateTriggerString: createTriggerString,
		CreatedAt:           createdAt,
		Definer:             definer,
	}
}

func (c *CreateTrigger) Database() sql.Database {
	return c.Db
}

func (c *CreateTrigger) WithDatabase(database sql.Database) (sql.Node, error) {
	ct := *c
	ct.Db = database
	return &ct, nil
}

func (c *CreateTrigger) Resolved() bool {
	// c.Body can be unresolved since it can have unresolved table reference to non-existent table
	return c.ddlNode.Resolved() && c.Table.Resolved()
}

func (c *CreateTrigger) IsReadOnly() bool {
	return false
}

func (c *CreateTrigger) Schema() sql.Schema {
	return types.OkResultSchema
}

func (c *CreateTrigger) Children() []sql.Node {
	return []sql.Node{c.Table}
}

func (c *CreateTrigger) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}

	nc := *c
	nc.Table = children[0]
	return &nc, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*CreateTrigger) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (c *CreateTrigger) String() string {
	order := ""
	if c.TriggerOrder != nil {
		order = fmt.Sprintf("%s %s ", c.TriggerOrder.PrecedesOrFollows, c.TriggerOrder.OtherTriggerName)
	}
	return fmt.Sprintf("CREATE TRIGGER %s %s %s ON %s FOR EACH ROW %s%s", c.TriggerName, c.TriggerTime, c.TriggerEvent, c.Table, order, c.Body)
}

func (c *CreateTrigger) DebugString() string {
	order := ""
	if c.TriggerOrder != nil {
		order = fmt.Sprintf("%s %s ", c.TriggerOrder.PrecedesOrFollows, c.TriggerOrder.OtherTriggerName)
	}
	return fmt.Sprintf("CREATE TRIGGER %s %s %s ON %s FOR EACH ROW %s%s", c.TriggerName, c.TriggerTime, c.TriggerEvent, sql.DebugString(c.Table), order, sql.DebugString(c.Body))
}

// OrderTriggers is a utility method that first sorts triggers into their precedence. It then splits the triggers into
// before and after pairs.
func OrderTriggers(triggers []*CreateTrigger) (beforeTriggers []*CreateTrigger, afterTriggers []*CreateTrigger) {
	orderedTriggers := make([]*CreateTrigger, len(triggers))
	copy(orderedTriggers, triggers)

Top:
	for i, trigger := range triggers {
		if trigger.TriggerOrder != nil {
			ref := trigger.TriggerOrder.OtherTriggerName
			// remove the trigger from the slice
			orderedTriggers = append(orderedTriggers[:i], orderedTriggers[i+1:]...)
			// then find where to reinsert it
			for j, t := range orderedTriggers {
				if t.TriggerName == ref {
					if trigger.TriggerOrder.PrecedesOrFollows == sqlparser.PrecedesStr {
						orderedTriggers = append(orderedTriggers[:j], append(triggers[i:i+1], orderedTriggers[j:]...)...)
					} else if trigger.TriggerOrder.PrecedesOrFollows == sqlparser.FollowsStr {
						if len(orderedTriggers) == j-1 {
							orderedTriggers = append(orderedTriggers, triggers[i])
						} else {
							orderedTriggers = append(orderedTriggers[:j+1], append(triggers[i:i+1], orderedTriggers[j+1:]...)...)
						}
					} else {
						panic("unexpected value for trigger order")
					}
					continue Top
				}
			}
			panic(fmt.Sprintf("Referenced trigger %s not found", ref))
		}
	}

	// Now that we have ordered the triggers according to precedence, split them into BEFORE / AFTER triggers
	for _, trigger := range orderedTriggers {
		if trigger.TriggerTime == sqlparser.BeforeStr {
			beforeTriggers = append(beforeTriggers, trigger)
		} else {
			afterTriggers = append(afterTriggers, trigger)
		}
	}

	return beforeTriggers, afterTriggers
}
