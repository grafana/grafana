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

package plan

import (
	"fmt"
	"sort"
	"strings"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
)

// SignalConditionItemName represents the item name for the set conditions of a SIGNAL statement.
type SignalConditionItemName string

const (
	SignalConditionItemName_Unknown           SignalConditionItemName = ""
	SignalConditionItemName_ClassOrigin       SignalConditionItemName = "class_origin"
	SignalConditionItemName_SubclassOrigin    SignalConditionItemName = "subclass_origin"
	SignalConditionItemName_MessageText       SignalConditionItemName = "message_text"
	SignalConditionItemName_MysqlErrno        SignalConditionItemName = "mysql_errno"
	SignalConditionItemName_ConstraintCatalog SignalConditionItemName = "constraint_catalog"
	SignalConditionItemName_ConstraintSchema  SignalConditionItemName = "constraint_schema"
	SignalConditionItemName_ConstraintName    SignalConditionItemName = "constraint_name"
	SignalConditionItemName_CatalogName       SignalConditionItemName = "catalog_name"
	SignalConditionItemName_SchemaName        SignalConditionItemName = "schema_name"
	SignalConditionItemName_TableName         SignalConditionItemName = "table_name"
	SignalConditionItemName_ColumnName        SignalConditionItemName = "column_name"
	SignalConditionItemName_CursorName        SignalConditionItemName = "cursor_name"
)

var SignalItems = []SignalConditionItemName{
	SignalConditionItemName_ClassOrigin,
	SignalConditionItemName_SubclassOrigin,
	SignalConditionItemName_MessageText,
	SignalConditionItemName_MysqlErrno,
	SignalConditionItemName_ConstraintCatalog,
	SignalConditionItemName_ConstraintSchema,
	SignalConditionItemName_ConstraintName,
	SignalConditionItemName_CatalogName,
	SignalConditionItemName_SchemaName,
	SignalConditionItemName_TableName,
	SignalConditionItemName_ColumnName,
	SignalConditionItemName_CursorName,
}

// SignalInfo represents a piece of information for a SIGNAL statement.
type SignalInfo struct {
	ExprVal           sql.Expression
	ConditionItemName SignalConditionItemName
	StrValue          string
	IntValue          int64
}

// Signal represents the SIGNAL statement with a set SQLSTATE.
type Signal struct {
	Info          map[SignalConditionItemName]SignalInfo
	SqlStateValue string // Will always be a string with length 5
}

// SignalName represents the SIGNAL statement with a condition name.
type SignalName struct {
	Signal *Signal
	Name   string
}

var _ sql.Node = (*Signal)(nil)
var _ sql.Node = (*SignalName)(nil)
var _ sql.Expressioner = (*Signal)(nil)
var _ sql.CollationCoercible = (*Signal)(nil)
var _ sql.CollationCoercible = (*SignalName)(nil)

// NewSignal returns a *Signal node.
func NewSignal(sqlstate string, info map[SignalConditionItemName]SignalInfo) *Signal {
	// https://dev.mysql.com/doc/refman/8.0/en/signal.html#signal-condition-information-items
	// https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
	firstTwo := sqlstate[0:2]
	if _, ok := info[SignalConditionItemName_MessageText]; !ok {
		si := SignalInfo{
			ConditionItemName: SignalConditionItemName_MessageText,
		}
		switch firstTwo {
		case "01":
			si.StrValue = "Unhandled user-defined warning condition"
		case "02":
			si.StrValue = "Unhandled user-defined not found condition"
		default:
			si.StrValue = "Unhandled user-defined exception condition"
		}
		info[SignalConditionItemName_MessageText] = si
	}
	if _, ok := info[SignalConditionItemName_MysqlErrno]; !ok {
		si := SignalInfo{
			ConditionItemName: SignalConditionItemName_MysqlErrno,
		}
		switch firstTwo {
		case "01":
			si.IntValue = 1642
		case "02":
			si.IntValue = 1643
		default:
			si.IntValue = 1644
		}
		info[SignalConditionItemName_MysqlErrno] = si
	}
	return &Signal{
		SqlStateValue: sqlstate,
		Info:          info,
	}
}

// NewSignalName returns a *SignalName node.
func NewSignalName(name string, info map[SignalConditionItemName]SignalInfo) *SignalName {
	return &SignalName{
		Signal: &Signal{
			Info: info,
		},
		Name: name,
	}
}

// Resolved implements the sql.Node interface.
func (s *Signal) Resolved() bool {
	for _, e := range s.Expressions() {
		if !e.Resolved() {
			return false
		}
	}
	return true
}

// String implements the sql.Node interface.
func (s *Signal) String() string {
	infoStr := ""
	if len(s.Info) > 0 {
		infoStr = " SET"
		i := 0
		for _, k := range SignalItems {
			// enforce deterministic ordering
			if info, ok := s.Info[k]; ok {
				if i > 0 {
					infoStr += ","
				}
				infoStr += " " + info.String()
				i++
			}
		}
	}
	return fmt.Sprintf("SIGNAL SQLSTATE '%s'%s", s.SqlStateValue, infoStr)
}

func (s *Signal) IsReadOnly() bool {
	return true
}

// DebugString implements the sql.DebugStringer interface.
func (s *Signal) DebugString() string {
	infoStr := ""
	if len(s.Info) > 0 {
		infoStr = " SET"
		i := 0
		for _, k := range SignalItems {
			// enforce deterministic ordering
			if info, ok := s.Info[k]; ok {
				if i > 0 {
					infoStr += ","
				}
				infoStr += " " + info.DebugString()
				i++
			}
		}
	}
	return fmt.Sprintf("SIGNAL SQLSTATE '%s'%s", s.SqlStateValue, infoStr)
}

// Schema implements the sql.Node interface.
func (s *Signal) Schema() sql.Schema {
	return nil
}

// Children implements the sql.Node interface.
func (s *Signal) Children() []sql.Node {
	return nil
}

// WithChildren implements the sql.Node interface.
func (s *Signal) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(s, children...)
}

func (s *Signal) Expressions() []sql.Expression {
	items := s.signalItemsWithExpressions()

	var exprs []sql.Expression
	for _, itemInfo := range items {
		exprs = append(exprs, itemInfo.ExprVal)
	}

	return exprs
}

// signalItemsWithExpressions returns the subset of the Info map entries that have an expression value, sorted by
// item name
func (s *Signal) signalItemsWithExpressions() []SignalInfo {
	var items []SignalInfo

	for _, itemInfo := range s.Info {
		if itemInfo.ExprVal != nil {
			items = append(items, itemInfo)
		}
	}

	// Very important to have a consistent sort order between here and the WithExpressions call
	sort.Slice(items, func(i, j int) bool {
		return items[i].ConditionItemName < items[j].ConditionItemName
	})

	return items
}

func (s Signal) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	itemsWithExprs := s.signalItemsWithExpressions()
	if len(itemsWithExprs) != len(exprs) {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(exprs), len(itemsWithExprs))
	}

	mapCopy := make(map[SignalConditionItemName]SignalInfo)
	for k, v := range s.Info {
		mapCopy[k] = v
	}

	for i := range exprs {
		// transfer the expression to the new info map
		newInfo := itemsWithExprs[i]
		newInfo.ExprVal = exprs[i]
		mapCopy[itemsWithExprs[i].ConditionItemName] = newInfo
	}

	s.Info = mapCopy
	return &s, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Signal) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// RowIter implements the sql.Node interface.
func (s *Signal) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	//TODO: implement CLASS_ORIGIN
	//TODO: implement SUBCLASS_ORIGIN
	//TODO: implement CONSTRAINT_CATALOG
	//TODO: implement CONSTRAINT_SCHEMA
	//TODO: implement CONSTRAINT_NAME
	//TODO: implement CATALOG_NAME
	//TODO: implement SCHEMA_NAME
	//TODO: implement TABLE_NAME
	//TODO: implement COLUMN_NAME
	//TODO: implement CURSOR_NAME
	if s.SqlStateValue[0:2] == "01" {
		//TODO: implement warnings
		return nil, fmt.Errorf("warnings not yet implemented")
	} else {

		messageItem := s.Info[SignalConditionItemName_MessageText]
		strValue := messageItem.StrValue
		if messageItem.ExprVal != nil {
			exprResult, err := messageItem.ExprVal.Eval(ctx, nil)
			if err != nil {
				return nil, err
			}
			s, ok := exprResult.(string)
			if !ok {
				return nil, fmt.Errorf("message text expression did not evaluate to a string")
			}
			strValue = s
		}

		return nil, mysql.NewSQLError(
			int(s.Info[SignalConditionItemName_MysqlErrno].IntValue),
			s.SqlStateValue,
			"%s",
			strValue,
		)
	}
}

// Resolved implements the sql.Node interface.
func (s *SignalName) Resolved() bool {
	return true
}

// String implements the sql.Node interface.
func (s *SignalName) String() string {
	infoStr := ""
	if len(s.Signal.Info) > 0 {
		infoStr = " SET"
		i := 0
		for _, info := range s.Signal.Info {
			if i > 0 {
				infoStr += ","
			}
			infoStr += " " + info.String()
			i++
		}
	}
	return fmt.Sprintf("SIGNAL %s%s", s.Name, infoStr)
}

// Schema implements the sql.Node interface.
func (s *SignalName) Schema() sql.Schema {
	return nil
}

func (s *SignalName) IsReadOnly() bool {
	return true
}

// Children implements the sql.Node interface.
func (s *SignalName) Children() []sql.Node {
	return nil // SignalName is an alternate form of Signal rather than an encapsulating node, thus no children
}

// WithChildren implements the sql.Node interface.
func (s *SignalName) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(s, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*SignalName) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// RowIter implements the sql.Node interface.
func (s *SignalName) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return nil, fmt.Errorf("may not iterate over unresolved node *SignalName")
}

func (s SignalInfo) IsReadOnly() bool {
	return true
}

func (s SignalInfo) String() string {
	itemName := strings.ToUpper(string(s.ConditionItemName))
	if s.ExprVal != nil {
		return fmt.Sprintf("%s = %s", itemName, s.ExprVal.String())
	} else if s.ConditionItemName == SignalConditionItemName_MysqlErrno {
		return fmt.Sprintf("%s = %d", itemName, s.IntValue)
	}
	return fmt.Sprintf("%s = %s", itemName, s.StrValue)
}

func (s SignalInfo) DebugString() string {
	itemName := strings.ToUpper(string(s.ConditionItemName))
	if s.ExprVal != nil {
		return fmt.Sprintf("%s = %s", itemName, sql.DebugString(s.ExprVal))
	} else if s.ConditionItemName == SignalConditionItemName_MysqlErrno {
		return fmt.Sprintf("%s = %d", itemName, s.IntValue)
	}
	return fmt.Sprintf("%s = %s", itemName, s.StrValue)
}
