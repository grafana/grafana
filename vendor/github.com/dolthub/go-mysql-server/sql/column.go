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

package sql

import (
	"fmt"
	"reflect"
	"strings"
)

// Column is the definition of a table column.
// As SQL:2016 puts it:
//
//	A column is a named component of a table. It has a data type, a default,
//	and a nullability characteristic.
type Column struct {
	// Type is the data type of the column.
	Type Type
	// Default contains the default value of the column or nil if it was not explicitly defined.
	Default *ColumnDefaultValue
	// Generated is non-nil if the column is defined with a generated value. Mutually exclusive with Default
	Generated *ColumnDefaultValue
	// OnUpdate contains the on update value of the column or nil if it was not explicitly defined.
	OnUpdate *ColumnDefaultValue
	// Name is the name of the column.
	Name string
	// Source is the name of the table this column came from.
	Source string
	// DatabaseSource is the name of the database this column came from.
	DatabaseSource string
	// Comment contains the string comment for this column.
	Comment string
	// Extra contains any additional information to put in the `extra` column under `information_schema.columns`.
	Extra string
	// PrimaryKey is true if the column is part of the primary key for its table.
	PrimaryKey bool
	// Nullable is true if the column can contain NULL values, or false
	// otherwise.
	Nullable bool
	// Virtual is true if the column is defined as a virtual column. Generated must be non-nil in this case.
	// Virtual column values will be provided for write operations, in case integrators need to use them to update
	// indexes, but must not be returned in rows from tables that include them.
	Virtual bool
	// AutoIncrement is true if the column auto-increments.
	AutoIncrement bool
}

// Check ensures the value is correct for this column.
func (c *Column) Check(ctx *Context, v interface{}) bool {
	if v == nil {
		return c.Nullable
	}

	_, _, err := c.Type.Convert(ctx, v)
	return err == nil
}

// Equals checks whether two columns are equal.
func (c *Column) Equals(c2 *Column) bool {
	if c.Source != "" {
		return strings.EqualFold(c.Name, c2.Name) &&
			strings.EqualFold(c.Source, c2.Source) &&
			strings.EqualFold(c.DatabaseSource, c2.DatabaseSource) &&
			c.Nullable == c2.Nullable &&
			reflect.DeepEqual(c.Default, c2.Default) &&
			reflect.DeepEqual(c.Type, c2.Type)
	}
	return c.Name == c2.Name &&
		strings.EqualFold(c.Source, c2.Source) &&
		strings.EqualFold(c.DatabaseSource, c2.DatabaseSource) &&
		c.Nullable == c2.Nullable &&
		reflect.DeepEqual(c.Default, c2.Default) &&
		reflect.DeepEqual(c.Type, c2.Type)
}

func (c *Column) DebugString() string {
	sb := strings.Builder{}
	sb.WriteString("Name: ")
	sb.WriteString(c.Name)
	sb.WriteString(", ")
	sb.WriteString("Source: ")
	sb.WriteString(c.Source)
	sb.WriteString(", ")
	sb.WriteString("Type: ")
	sb.WriteString(c.Type.String())
	sb.WriteString(", ")
	sb.WriteString("PrimaryKey: ")
	sb.WriteString(fmt.Sprintf("%v", c.PrimaryKey))
	sb.WriteString(", ")
	sb.WriteString("Nullable: ")
	sb.WriteString(fmt.Sprintf("%v", c.Nullable))
	sb.WriteString(", ")
	sb.WriteString("Comment: ")
	sb.WriteString(c.Comment)
	sb.WriteString(", ")
	sb.WriteString("Default: ")
	sb.WriteString(DebugString(c.Default))
	sb.WriteString("Generated: ")
	sb.WriteString(DebugString(c.Generated))
	sb.WriteString(", ")
	sb.WriteString("AutoIncrement: ")
	sb.WriteString(fmt.Sprintf("%v", c.AutoIncrement))
	sb.WriteString(", ")
	sb.WriteString("Extra: ")
	sb.WriteString(c.Extra)

	return sb.String()
}

func (c Column) Copy() *Column {
	// Create a copy of the default and generated column, rather than referencing the same pointer
	if c.Default != nil {
		c.Default = &(*c.Default)
	}
	if c.Generated != nil {
		c.Generated = &(*c.Generated)
	}
	return &c
}

func (c *Column) String() string {
	return c.Source + "." + c.Name
}

// TableId is the unique identifier of a table or table alias in a multi-db environment.
// The long-term goal is to migrate all uses of table name strings to this and minimize places where we
// construct/inspect TableIDs. By treating this as an opaque identifier, it will be easier to migrate to
// a system where we compute IDs once during plan building.
// For aliases, DatabaseName is nil.
type TableId uint16

func (i TableId) IsEmpty() bool {
	return i == 0
}
