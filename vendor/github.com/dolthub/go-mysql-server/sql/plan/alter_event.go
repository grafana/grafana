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
	"io"
	"sync"
	"time"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.Node = (*AlterEvent)(nil)
var _ sql.Expressioner = (*AlterEvent)(nil)
var _ sql.Databaser = (*AlterEvent)(nil)

type AlterEvent struct {
	DefinitionNode sql.Node
	scheduler      sql.EventScheduler

	ddlNode

	Starts *OnScheduleTimestamp
	Ends   *OnScheduleTimestamp
	At     *OnScheduleTimestamp
	Every  *expression.Interval

	RenameToDb       string
	EventName        string
	Definer          string
	RenameToName     string
	DefinitionString string
	Comment          string

	Event  sql.EventDefinition
	Status sql.EventStatus

	AlterName       bool
	AlterStatus     bool
	AlterComment    bool
	AlterDefinition bool
	AlterOnSchedule bool
	AlterOnComp     bool
	OnCompPreserve  bool
}

// NewAlterEvent returns a *AlterEvent node.
func NewAlterEvent(
	db sql.Database,
	es sql.EventScheduler,
	name, definer string,
	alterSchedule bool,
	at, starts, ends *OnScheduleTimestamp,
	every *expression.Interval,
	alterOnComp bool,
	onCompletionPreserve bool,
	alterName bool,
	newName string,
	alterStatus bool,
	status sql.EventStatus,
	alterComment bool,
	comment string,
	alterDefinition bool,
	definitionString string,
	definition sql.Node,
) *AlterEvent {
	return &AlterEvent{
		ddlNode:          ddlNode{db},
		scheduler:        es,
		EventName:        name,
		Definer:          definer,
		AlterOnSchedule:  alterSchedule,
		At:               at,
		Every:            every,
		Starts:           starts,
		Ends:             ends,
		AlterOnComp:      alterOnComp,
		OnCompPreserve:   onCompletionPreserve,
		AlterName:        alterName,
		RenameToDb:       "", // TODO: moving events across dbs is not supported yet
		RenameToName:     newName,
		AlterStatus:      alterStatus,
		Status:           status,
		AlterComment:     alterComment,
		Comment:          comment,
		AlterDefinition:  alterDefinition,
		DefinitionString: definitionString,
		DefinitionNode:   definition,
	}
}

// String implements the sql.Node interface.
func (a *AlterEvent) String() string {
	stmt := "ALTER"

	if a.Definer != "" {
		stmt = fmt.Sprintf("%s DEFINER = %s", stmt, a.Definer)
	}

	stmt = fmt.Sprintf("%s EVENT", stmt)

	if a.AlterOnSchedule {
		if a.At != nil {
			stmt = fmt.Sprintf("%s ON SCHEDULE AT %s", stmt, a.At.String())
		} else {
			stmt = fmt.Sprintf("%s %s", stmt, onScheduleEveryString(a.Every, a.Starts, a.Ends))
		}
	}

	if a.AlterOnComp {
		onComp := "NOT PRESERVE"
		if a.OnCompPreserve {
			onComp = "PRESERVE"
		}
		stmt = fmt.Sprintf("%s ON COMPLETION %s", stmt, onComp)
	}

	if a.AlterName {
		// rename event database (moving event) is not supported yet
		stmt = fmt.Sprintf("%s RENAMTE TO %s", stmt, a.RenameToName)
	}

	if a.AlterStatus {
		stmt = fmt.Sprintf("%s %s", stmt, a.Status.String())
	}

	if a.AlterComment {
		if a.Comment != "" {
			stmt = fmt.Sprintf("%s COMMENT %s", stmt, a.Comment)
		}
	}

	if a.AlterDefinition {
		stmt = fmt.Sprintf("%s DO %s", stmt, sql.DebugString(a.DefinitionNode))
	}

	return stmt
}

// Resolved implements the sql.Node interface.
func (a *AlterEvent) Resolved() bool {
	r := a.ddlNode.Resolved()

	if a.AlterDefinition {
		r = r && a.DefinitionNode.Resolved()
	}
	if a.AlterOnSchedule {
		if a.At != nil {
			r = r && a.At.Resolved()
		} else {
			r = r && a.Every.Resolved()
			if a.Starts != nil {
				r = r && a.Starts.Resolved()
			}
			if a.Ends != nil {
				r = r && a.Ends.Resolved()
			}
		}
	}
	return r
}

// Schema implements the sql.Node interface.
func (a *AlterEvent) Schema() sql.Schema {
	return types.OkResultSchema
}

func (a *AlterEvent) IsReadOnly() bool {
	return false
}

// Children implements the sql.Node interface.
func (a *AlterEvent) Children() []sql.Node {
	if a.AlterDefinition {
		return []sql.Node{a.DefinitionNode}
	}
	return nil
}

// WithChildren implements the sql.Node interface.
func (a *AlterEvent) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) > 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), "0 or 1")
	}

	if !a.AlterDefinition {
		return a, nil
	}

	na := *a
	na.DefinitionNode = children[0]
	return &na, nil
}

// Database implements the sql.Databaser interface.
func (a *AlterEvent) Database() sql.Database {
	return a.Db
}

// WithDatabase implements the sql.Databaser interface.
func (a *AlterEvent) WithDatabase(database sql.Database) (sql.Node, error) {
	ae := *a
	ae.Db = database
	return &ae, nil
}

// RowIter implements the sql.Node interface.
func (a *AlterEvent) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	eventDb, ok := a.Db.(sql.EventDatabase)
	if !ok {
		return nil, sql.ErrEventsNotSupported.New(a.Db.Name())
	}

	// sanity check that Event was successfully loaded in analyzer
	if a.Event.Name == "" {
		return nil, fmt.Errorf("error loading existing event to alter from the database")
	}
	var err error
	ed := a.Event
	eventAlteredTime := ctx.QueryTime()
	sysTz := sql.SystemTimezoneOffset()
	ed.LastAltered = eventAlteredTime
	ed.Definer = a.Definer

	if a.AlterOnSchedule {
		if a.At != nil {
			ed.HasExecuteAt = true
			ed.ExecuteAt, err = a.At.EvalTime(ctx, sysTz)
			if err != nil {
				return nil, err
			}
			// if Schedule was defined using EVERY previously, clear its fields
			ed.ExecuteEvery = ""
			ed.Starts = time.Time{}
			ed.Ends = time.Time{}
			ed.HasEnds = false
		} else {
			delta, err := a.Every.EvalDelta(ctx, nil)
			if err != nil {
				return nil, err
			}
			interval := sql.NewEveryInterval(delta.Years, delta.Months, delta.Days, delta.Hours, delta.Minutes, delta.Seconds)
			iVal, iField := interval.GetIntervalValAndField()
			ed.ExecuteEvery = fmt.Sprintf("%s %s", iVal, iField)

			if a.Starts != nil {
				ed.Starts, err = a.Starts.EvalTime(ctx, sysTz)
				if err != nil {
					return nil, err
				}
			} else {
				// If STARTS is not defined, it defaults to CURRENT_TIMESTAMP
				ed.Starts = eventAlteredTime
			}
			if a.Ends != nil {
				ed.HasEnds = true
				ed.Ends, err = a.Ends.EvalTime(ctx, sysTz)
				if err != nil {
					return nil, err
				}
			}
			// if Schedule was defined using AT previously, clear its fields
			ed.HasExecuteAt = false
			ed.ExecuteAt = time.Time{}
		}
	}
	if a.AlterOnComp {
		ed.OnCompletionPreserve = a.OnCompPreserve
	}
	if a.AlterName {
		ed.Name = a.RenameToName
	}
	if a.AlterStatus {
		// TODO: support DISABLE ON SLAVE event status
		if a.Status == sql.EventStatus_DisableOnSlave && ctx != nil && ctx.Session != nil {
			ctx.Session.Warn(&sql.Warning{
				Level:   "Warning",
				Code:    mysql.ERNotSupportedYet,
				Message: fmt.Sprintf("DISABLE ON SLAVE status is not supported yet, used DISABLE status instead."),
			})
			ed.Status = sql.EventStatus_Disable.String()
		} else {
			ed.Status = a.Status.String()
		}
	}
	if a.AlterComment {
		ed.Comment = a.Comment
	}
	if a.AlterDefinition {
		ed.EventBody = a.DefinitionString
	}

	return &alterEventIter{
		originalName:  a.EventName,
		alterSchedule: a.AlterOnSchedule,
		alterStatus:   a.AlterStatus,
		event:         ed,
		eventDb:       eventDb,
		scheduler:     a.scheduler,
	}, nil
}

// Expressions implements the sql.Expressioner interface.
func (a *AlterEvent) Expressions() []sql.Expression {
	if a.AlterOnSchedule {
		if a.At != nil {
			return []sql.Expression{a.At}
		} else {
			if a.Starts == nil && a.Ends == nil {
				return []sql.Expression{a.Every}
			} else if a.Starts == nil {
				return []sql.Expression{a.Every, a.Ends}
			} else if a.Ends == nil {
				return []sql.Expression{a.Every, a.Starts}
			} else {
				return []sql.Expression{a.Every, a.Starts, a.Ends}
			}
		}
	}
	return nil
}

// WithExpressions implements the sql.Expressioner interface.
func (a *AlterEvent) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	if len(e) > 3 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(e), "up to 3")
	}

	if !a.AlterOnSchedule {
		return a, nil
	}

	na := *a
	if a.At != nil {
		ts, ok := e[0].(*OnScheduleTimestamp)
		if !ok {
			return nil, fmt.Errorf("expected `*OnScheduleTimestamp` but got `%T`", e[0])
		}
		na.At = ts
	} else {
		every, ok := e[0].(*expression.Interval)
		if !ok {
			return nil, fmt.Errorf("expected `*expression.Interval` but got `%T`", e[0])
		}
		na.Every = every

		var ts *OnScheduleTimestamp
		if len(e) > 1 {
			ts, ok = e[1].(*OnScheduleTimestamp)
			if !ok {
				return nil, fmt.Errorf("expected `*OnScheduleTimestamp` but got `%T`", e[1])
			}
			if a.Starts != nil {
				na.Starts = ts
			} else if a.Ends != nil {
				na.Ends = ts
			}
		}

		if len(e) == 3 {
			ts, ok = e[2].(*OnScheduleTimestamp)
			if !ok {
				return nil, fmt.Errorf("expected `*OnScheduleTimestamp` but got `%T`", e[2])
			}
			na.Ends = ts
		}
	}

	return &na, nil
}

// alterEventIter is the row iterator for *CreateEvent.
type alterEventIter struct {
	eventDb       sql.EventDatabase
	scheduler     sql.EventScheduler
	originalName  string
	event         sql.EventDefinition
	once          sync.Once
	alterSchedule bool
	alterStatus   bool
}

// Next implements the sql.RowIter interface.
func (a *alterEventIter) Next(ctx *sql.Context) (sql.Row, error) {
	run := false
	a.once.Do(func() {
		run = true
	})
	if !run {
		return nil, io.EOF
	}

	var eventEndingTime time.Time
	if a.event.HasExecuteAt {
		eventEndingTime = a.event.ExecuteAt
	} else if a.event.HasEnds {
		eventEndingTime = a.event.Ends
	}

	if (a.event.HasExecuteAt || a.event.HasEnds) && eventEndingTime.Sub(a.event.LastAltered).Seconds() < 0 {
		// If the event execution/end time is altered and in the past.
		if a.alterSchedule {
			if a.event.OnCompletionPreserve && ctx != nil && ctx.Session != nil {
				// If ON COMPLETION PRESERVE is defined, the event is disabled.
				a.event.Status = sql.EventStatus_Disable.String()
				ctx.Session.Warn(&sql.Warning{
					Level:   "Note",
					Code:    1544,
					Message: "Event execution time is in the past. Event has been disabled",
				})
			} else {
				return nil, fmt.Errorf("Event execution time is in the past and ON COMPLETION NOT PRESERVE is set. The event was not changed. Specify a time in the future.")
			}
		}

		if a.alterStatus {
			if a.event.OnCompletionPreserve {
				// If the event execution/end time is in the past and is ON COMPLETION PRESERVE, status must stay as DISABLE.
				a.event.Status = sql.EventStatus_Disable.String()
			} else {
				// If event status was set to ENABLE and ON COMPLETION NOT PRESERVE, it gets dropped.
				// make sure to notify the EventSchedulerStatus before dropping the event in the database
				if a.scheduler != nil {
					a.scheduler.RemoveEvent(a.eventDb.Name(), a.originalName)
				}
				err := a.eventDb.DropEvent(ctx, a.originalName)
				if err != nil {
					return nil, err
				}
				return sql.Row{types.NewOkResult(0)}, nil
			}
		}
	}

	enabled, err := a.eventDb.UpdateEvent(ctx, a.originalName, a.event)
	if err != nil {
		return nil, err
	}

	// make sure to notify the EventSchedulerStatus after updating the event in the database
	if a.scheduler != nil && enabled {
		a.scheduler.UpdateEvent(ctx, a.eventDb, a.originalName, a.event)
	}

	return sql.Row{types.NewOkResult(0)}, nil
}

// Close implements the sql.RowIter interface.
func (a *alterEventIter) Close(_ *sql.Context) error {
	return nil
}
