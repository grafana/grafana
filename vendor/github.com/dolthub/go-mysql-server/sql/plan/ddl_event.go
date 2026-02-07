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
	"strings"
	"sync"
	"time"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.Node = (*CreateEvent)(nil)
var _ sql.Expressioner = (*CreateEvent)(nil)
var _ sql.Databaser = (*CreateEvent)(nil)

type CreateEvent struct {
	ddlNode
	scheduler        sql.EventScheduler
	DefinitionNode   sql.Node
	Ends             *OnScheduleTimestamp
	Every            *expression.Interval
	Starts           *OnScheduleTimestamp
	At               *OnScheduleTimestamp
	Comment          string
	DefinitionString string
	Definer          string
	EventName        string
	OnCompPreserve   bool
	Status           sql.EventStatus
	IfNotExists      bool
}

// NewCreateEvent returns a *CreateEvent node.
func NewCreateEvent(
	db sql.Database,
	es sql.EventScheduler,
	name, definer string,
	at, starts, ends *OnScheduleTimestamp,
	every *expression.Interval,
	onCompletionPreserve bool,
	status sql.EventStatus,
	comment, definitionString string,
	definition sql.Node,
	ifNotExists bool,
) *CreateEvent {
	return &CreateEvent{
		ddlNode:          ddlNode{db},
		scheduler:        es,
		EventName:        name,
		Definer:          definer,
		At:               at,
		Every:            every,
		Starts:           starts,
		Ends:             ends,
		OnCompPreserve:   onCompletionPreserve,
		Status:           status,
		Comment:          comment,
		DefinitionString: definitionString,
		DefinitionNode:   prepareCreateEventDefinitionNode(definition),
		IfNotExists:      ifNotExists,
	}
}

// Resolved implements the sql.Node interface.
func (c *CreateEvent) Resolved() bool {
	r := c.ddlNode.Resolved() && c.DefinitionNode.Resolved()
	if c.At != nil {
		r = r && c.At.Resolved()
	} else {
		r = r && c.Every.Resolved()
		if c.Starts != nil {
			r = r && c.Starts.Resolved()
		}
		if c.Ends != nil {
			r = r && c.Ends.Resolved()
		}
	}
	return r
}

func (c *CreateEvent) IsReadOnly() bool {
	return false
}

// Schema implements the sql.Node interface.
func (c *CreateEvent) Schema() sql.Schema {
	return types.OkResultSchema
}

// Children implements the sql.Node interface.
func (c *CreateEvent) Children() []sql.Node {
	return []sql.Node{c.DefinitionNode}
}

// WithChildren implements the sql.Node interface.
func (c *CreateEvent) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}

	nc := *c
	nc.DefinitionNode = prepareCreateEventDefinitionNode(children[0])

	return &nc, nil
}

// Database implements the sql.Databaser interface.
func (c *CreateEvent) Database() sql.Database {
	return c.Db
}

// WithDatabase implements the sql.Databaser interface.
func (c *CreateEvent) WithDatabase(database sql.Database) (sql.Node, error) {
	ce := *c
	ce.Db = database
	return &ce, nil
}

// String implements the sql.Node interface.
func (c *CreateEvent) String() string {
	definer := ""
	if c.Definer != "" {
		definer = fmt.Sprintf(" DEFINER = %s", c.Definer)
	}

	onSchedule := ""
	if c.At != nil {
		onSchedule = fmt.Sprintf(" ON SCHEDULE %s", c.At.String())
	} else {
		onSchedule = onScheduleEveryString(c.Every, c.Starts, c.Ends)
	}

	onCompletion := ""
	if !c.OnCompPreserve {
		onCompletion = " ON COMPLETION NOT PRESERVE"
	}

	comment := ""
	if c.Comment != "" {
		comment = fmt.Sprintf(" COMMENT '%s'", c.Comment)
	}

	return fmt.Sprintf("CREATE%s EVENT %s %s%s%s%s DO %s",
		definer, c.EventName, onSchedule, onCompletion, c.Status.String(), comment, sql.DebugString(c.DefinitionNode))
}

// Expressions implements the sql.Expressioner interface.
func (c *CreateEvent) Expressions() []sql.Expression {
	if c.At != nil {
		return []sql.Expression{c.At}
	} else {
		if c.Starts == nil && c.Ends == nil {
			return []sql.Expression{c.Every}
		} else if c.Starts == nil {
			return []sql.Expression{c.Every, c.Ends}
		} else if c.Ends == nil {
			return []sql.Expression{c.Every, c.Starts}
		} else {
			return []sql.Expression{c.Every, c.Starts, c.Ends}
		}
	}
}

// WithExpressions implements the sql.Expressioner interface.
func (c *CreateEvent) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	if len(e) < 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(e), "at least 1")
	}

	nc := *c
	if c.At != nil {
		ts, ok := e[0].(*OnScheduleTimestamp)
		if !ok {
			return nil, fmt.Errorf("expected `*OnScheduleTimestamp` but got `%T`", e[0])
		}
		nc.At = ts
	} else {
		every, ok := e[0].(*expression.Interval)
		if !ok {
			return nil, fmt.Errorf("expected `*expression.Interval` but got `%T`", e[0])
		}
		nc.Every = every

		var ts *OnScheduleTimestamp
		if len(e) > 1 {
			ts, ok = e[1].(*OnScheduleTimestamp)
			if !ok {
				return nil, fmt.Errorf("expected `*OnScheduleTimestamp` but got `%T`", e[1])
			}
			if c.Starts != nil {
				nc.Starts = ts
			} else if c.Ends != nil {
				nc.Ends = ts
			}
		}

		if len(e) == 3 {
			ts, ok = e[2].(*OnScheduleTimestamp)
			if !ok {
				return nil, fmt.Errorf("expected `*OnScheduleTimestamp` but got `%T`", e[2])
			}
			nc.Ends = ts
		}
	}

	return &nc, nil
}

// RowIter implements the sql.Node interface.
func (c *CreateEvent) RowIter(ctx *sql.Context, _ sql.Row) (sql.RowIter, error) {
	eventCreationTime := ctx.QueryTime()
	// TODO: event time values are evaluated in 'SYSTEM' TZ for now (should be session TZ)
	eventDefinition, err := c.GetEventDefinition(ctx, eventCreationTime, eventCreationTime, time.Time{}, sql.SystemTimezoneOffset())
	if err != nil {
		return nil, err
	}

	eventDb, ok := c.Db.(sql.EventDatabase)
	if !ok {
		return nil, sql.ErrEventsNotSupported.New(c.Db.Name())
	}

	return &createEventIter{
		event:          eventDefinition,
		eventDb:        eventDb,
		ifNotExists:    c.IfNotExists,
		eventScheduler: c.scheduler,
	}, nil
}

// GetEventDefinition returns an EventDefinition object with all of its fields populated from the details
// of this CREATE EVENT statement.
func (c *CreateEvent) GetEventDefinition(ctx *sql.Context, eventCreationTime, lastAltered, lastExecuted time.Time, tz string) (sql.EventDefinition, error) {
	// TODO: support DISABLE ON SLAVE event status
	if c.Status == sql.EventStatus_DisableOnSlave && ctx != nil && ctx.Session != nil {
		ctx.Session.Warn(&sql.Warning{
			Level:   "Warning",
			Code:    mysql.ERNotSupportedYet,
			Message: fmt.Sprintf("DISABLE ON SLAVE status is not supported yet, used DISABLE status instead."),
		})
		c.Status = sql.EventStatus_Disable
	}

	eventDefinition := sql.EventDefinition{
		Name:                 c.EventName,
		Definer:              c.Definer,
		OnCompletionPreserve: c.OnCompPreserve,
		Status:               c.Status.String(),
		Comment:              c.Comment,
		EventBody:            c.DefinitionString,
		TimezoneOffset:       tz,
	}

	if c.At != nil {
		var err error
		eventDefinition.HasExecuteAt = true
		eventDefinition.ExecuteAt, err = c.At.EvalTime(ctx, tz)
		if err != nil {
			return sql.EventDefinition{}, err
		}
	} else {
		delta, err := c.Every.EvalDelta(ctx, nil)
		if err != nil {
			return sql.EventDefinition{}, err
		}
		interval := sql.NewEveryInterval(delta.Years, delta.Months, delta.Days, delta.Hours, delta.Minutes, delta.Seconds)
		iVal, iField := interval.GetIntervalValAndField()
		eventDefinition.ExecuteEvery = fmt.Sprintf("%s %s", iVal, iField)

		if c.Starts != nil {
			eventDefinition.Starts, err = c.Starts.EvalTime(ctx, tz)
			if err != nil {
				return sql.EventDefinition{}, err
			}
		} else {
			// If STARTS is not defined, it defaults to CURRENT_TIMESTAMP
			eventDefinition.Starts = eventCreationTime
		}
		if c.Ends != nil {
			eventDefinition.HasEnds = true
			eventDefinition.Ends, err = c.Ends.EvalTime(ctx, tz)
			if err != nil {
				return sql.EventDefinition{}, err
			}
		}
	}

	eventDefinition.CreatedAt = eventCreationTime
	eventDefinition.LastAltered = lastAltered
	eventDefinition.LastExecuted = lastExecuted
	return eventDefinition, nil
}

// prepareCreateEventDefinitionNode fills in any missing ProcedureReference structures for
// BeginEndBlocks in the event's definition.
func prepareCreateEventDefinitionNode(definition sql.Node) sql.Node {
	beginEndBlock, ok := definition.(*BeginEndBlock)
	if !ok {
		return definition
	}

	// NOTE: To execute a multi-statement event body in a BeginEndBlock, a ProcedureReference
	//       must be set in the BeginEndBlock, but this currently only gets initialized in the
	//       analyzer for ProcedureCalls, so we initialize it here.
	// TODO: How does this work for triggers, which would have the same issue; seems like there
	//       should be a cleaner way to handle this
	// TODO: treat this the same way we treat triggers and stored procedures
	beginEndBlock.Pref = expression.NewProcedureReference()

	newChildren := make([]sql.Node, len(beginEndBlock.Children()))
	for i, child := range beginEndBlock.Children() {
		newChildren[i] = prepareCreateEventDefinitionNode(child)
	}
	newNode, _ := beginEndBlock.WithChildren(newChildren...)
	return newNode
}

// createEventIter is the row iterator for *CreateEvent.
type createEventIter struct {
	eventDb        sql.EventDatabase
	eventScheduler sql.EventScheduler
	event          sql.EventDefinition
	once           sync.Once
	ifNotExists    bool
}

// Next implements the sql.RowIter interface.
func (c *createEventIter) Next(ctx *sql.Context) (sql.Row, error) {
	run := false
	c.once.Do(func() {
		run = true
	})
	if !run {
		return nil, io.EOF
	}

	mode := sql.LoadSqlMode(ctx)
	c.event.SqlMode = mode.String()

	// checks if the defined ENDS time is before STARTS time
	if c.event.HasEnds {
		if c.event.Ends.Sub(c.event.Starts).Seconds() < 0 {
			return nil, fmt.Errorf("ENDS is either invalid or before STARTS")
		}
	}

	enabled, err := c.eventDb.SaveEvent(ctx, c.event)
	if err != nil {
		if sql.ErrEventAlreadyExists.Is(err) && c.ifNotExists {
			ctx.Session.Warn(&sql.Warning{
				Level:   "Note",
				Code:    1537,
				Message: err.Error(),
			})
			return sql.Row{types.NewOkResult(0)}, nil
		}
		return nil, err
	}

	if c.event.HasExecuteAt {
		// If the event execution time is in the past and is set.
		if c.event.ExecuteAt.Sub(c.event.CreatedAt).Seconds() <= -1 {
			if c.event.OnCompletionPreserve && ctx != nil && ctx.Session != nil {
				// If ON COMPLETION PRESERVE is defined, the event is disabled.
				c.event.Status = sql.EventStatus_Disable.String()
				_, err = c.eventDb.UpdateEvent(ctx, c.event.Name, c.event)
				if err != nil {
					return nil, err
				}
				ctx.Session.Warn(&sql.Warning{
					Level:   "Note",
					Code:    1544,
					Message: "Event execution time is in the past. Event has been disabled",
				})
			} else {
				// If ON COMPLETION NOT PRESERVE is defined, the event is dropped immediately after creation.
				err = c.eventDb.DropEvent(ctx, c.event.Name)
				if err != nil {
					return nil, err
				}
				ctx.Session.Warn(&sql.Warning{
					Level:   "Note",
					Code:    1588,
					Message: "Event execution time is in the past and ON COMPLETION NOT PRESERVE is set. The event was dropped immediately after creation.",
				})
			}
			return sql.Row{types.NewOkResult(0)}, nil
		}
	}

	// make sure to notify the EventSchedulerStatus AFTER adding the event in the database
	if c.eventScheduler != nil && enabled {
		c.eventScheduler.AddEvent(ctx, c.eventDb, c.event)
	}

	return sql.Row{types.NewOkResult(0)}, nil
}

// Close implements the sql.RowIter interface.
func (c *createEventIter) Close(ctx *sql.Context) error {
	return nil
}

// onScheduleEveryString returns ON SCHEDULE EVERY clause part of CREATE EVENT statement.
func onScheduleEveryString(every sql.Expression, starts, ends *OnScheduleTimestamp) string {
	everyInterval := strings.TrimPrefix(every.String(), "INTERVAL ")
	startsStr := ""
	if starts != nil {
		startsStr = fmt.Sprintf(" %s", starts.String())
	}
	endsStr := ""
	if ends != nil {
		endsStr = fmt.Sprintf(" %s", ends.String())
	}

	return fmt.Sprintf("ON SCHEDULE EVERY %s%s%s", everyInterval, startsStr, endsStr)
}

// OnScheduleTimestamp is object used for EVENT ON SCHEDULE { AT / STARTS / ENDS } optional fields only.
type OnScheduleTimestamp struct {
	field     string
	timestamp sql.Expression
	intervals []sql.Expression
}

var _ sql.Expression = (*OnScheduleTimestamp)(nil)

// NewOnScheduleTimestamp creates OnScheduleTimestamp object used for EVENT ON SCHEDULE { AT / STARTS / ENDS } optional fields only.
func NewOnScheduleTimestamp(f string, ts sql.Expression, i []sql.Expression) *OnScheduleTimestamp {
	return &OnScheduleTimestamp{
		field:     f,
		timestamp: ts,
		intervals: i,
	}
}

func (ost *OnScheduleTimestamp) IsReadOnly() bool {
	return true
}

func (ost *OnScheduleTimestamp) Type() sql.Type {
	return ost.timestamp.Type()
}

func (ost *OnScheduleTimestamp) IsNullable() bool {
	if ost.timestamp.IsNullable() {
		return true
	}
	for _, i := range ost.intervals {
		if i.IsNullable() {
			return true
		}
	}
	return false
}

func (ost *OnScheduleTimestamp) Children() []sql.Expression {
	var exprs = []sql.Expression{ost.timestamp}
	return append(exprs, ost.intervals...)
}

func (ost *OnScheduleTimestamp) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) == 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(ost, len(children), "at least 1")
	}

	var intervals = make([]sql.Expression, 0)
	if len(children) > 1 {
		intervals = append(intervals, children[1:]...)
	}

	return NewOnScheduleTimestamp(ost.field, children[0], intervals), nil
}

// Resolved implements the sql.Node interface.
func (ost *OnScheduleTimestamp) Resolved() bool {
	var children = []sql.Expression{ost.timestamp}
	children = append(children, ost.intervals...)
	for _, child := range children {
		if !child.Resolved() {
			return false
		}
	}
	return true
}

// String implements the sql.Node interface.
func (ost *OnScheduleTimestamp) String() string {
	intervals := ""
	for _, interval := range ost.intervals {
		intervals = fmt.Sprintf("%s + %s", intervals, interval.String())
	}
	return fmt.Sprintf("%s %s%s", ost.field, ost.timestamp.String(), intervals)
}

func (ost *OnScheduleTimestamp) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	panic("OnScheduleTimestamp.Eval is just a placeholder method and should not be called directly")
}

// EvalTime returns time.Time value converted to UTC evaluating given expressions as expected to be time value
// and optional interval values. The value returned is time.Time value from timestamp value plus all intervals given.
func (ost *OnScheduleTimestamp) EvalTime(ctx *sql.Context, tz string) (time.Time, error) {
	value, err := ost.timestamp.Eval(ctx, nil)
	if err != nil {
		return time.Time{}, err
	}

	if bs, ok := value.([]byte); ok {
		value = string(bs)
	}

	var t time.Time
	switch v := value.(type) {
	case time.Time:
		// TODO: check if this value is in session timezone
		t = v
	case string:
		t, err = sql.GetTimeValueFromStringInput(ost.field, v)
		if err != nil {
			return time.Time{}, err
		}
	default:
		return time.Time{}, fmt.Errorf("unexpected type: %s", v)
	}

	for _, interval := range ost.intervals {
		i, ok := interval.(*expression.Interval)
		if !ok {
			return time.Time{}, fmt.Errorf("expected interval but got: %s", interval)
		}

		timeDelta, err := i.EvalDelta(ctx, nil)
		if err != nil {
			return time.Time{}, err
		}
		t = timeDelta.Add(t)
	}

	// truncates the timezone part from the time value and returns the time value in given TZ
	truncatedVal, err := time.Parse(sql.EventDateSpaceTimeFormat, t.Format(sql.EventDateSpaceTimeFormat))
	if err != nil {
		return time.Time{}, err
	}
	return sql.ConvertTimeToLocation(truncatedVal, tz)
}

var _ sql.Node = (*DropEvent)(nil)
var _ sql.Databaser = (*DropEvent)(nil)

type DropEvent struct {
	ddlNode
	scheduler sql.EventScheduler
	EventName string
	IfExists  bool
}

// NewDropEvent creates a new *DropEvent node.
func NewDropEvent(db sql.Database, es sql.EventScheduler, eventName string, ifExists bool) *DropEvent {
	return &DropEvent{
		ddlNode:   ddlNode{db},
		scheduler: es,
		EventName: strings.ToLower(eventName),
		IfExists:  ifExists,
	}
}

// String implements the sql.Node interface.
func (d *DropEvent) String() string {
	ifExists := ""
	if d.IfExists {
		ifExists = "IF EXISTS "
	}
	return fmt.Sprintf("DROP PROCEDURE %s%s", ifExists, d.EventName)
}

// Schema implements the sql.Node interface.
func (d *DropEvent) Schema() sql.Schema {
	return types.OkResultSchema
}

func (d *DropEvent) IsReadOnly() bool {
	return false
}

// RowIter implements the sql.Node interface.
func (d *DropEvent) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	eventDb, ok := d.Db.(sql.EventDatabase)
	if !ok {
		if d.IfExists {
			return sql.RowsToRowIter(), nil
		} else {
			return nil, sql.ErrEventsNotSupported.New(d.EventName)
		}
	}

	// make sure to notify the EventSchedulerStatus before dropping the event in the database
	if d.scheduler != nil {
		d.scheduler.RemoveEvent(eventDb.Name(), d.EventName)
	}

	err := eventDb.DropEvent(ctx, d.EventName)
	if d.IfExists && sql.ErrEventDoesNotExist.Is(err) && ctx != nil && ctx.Session != nil {
		ctx.Session.Warn(&sql.Warning{
			Level:   "Note",
			Code:    1305,
			Message: fmt.Sprintf("Event %s does not exist", d.EventName),
		})
	} else if err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(sql.Row{types.NewOkResult(0)}), nil
}

// WithChildren implements the sql.Node interface.
func (d *DropEvent) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(d, children...)
}

// WithDatabase implements the sql.Databaser interface.
func (d *DropEvent) WithDatabase(database sql.Database) (sql.Node, error) {
	nde := *d
	nde.Db = database
	return &nde, nil
}
