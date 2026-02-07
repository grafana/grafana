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
	"bytes"

	"github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
)

type LoadData struct {
	File               string
	FieldsEscapedBy    string
	LinesTerminatedBy  string
	LinesStartingBy    string
	Charset            string
	FieldsTerminatedBy string
	FieldsEnclosedBy   string

	DestSch  sql.Schema
	ColNames []string
	SetExprs []sql.Expression
	UserVars []sql.Expression

	IgnoreNum           int64
	Local               bool
	FieldsEnclosedByOpt bool
	IsIgnore            bool
	IsReplace           bool
}

var _ sql.Node = (*LoadData)(nil)
var _ sql.CollationCoercible = (*LoadData)(nil)

func (l *LoadData) Resolved() bool {
	return l.DestSch.Resolved()
}

func (l *LoadData) String() string {
	pr := sql.NewTreePrinter()

	_ = pr.WriteNode("LOAD DATA %s", l.File)
	return pr.String()
}

func (l *LoadData) Schema() sql.Schema {
	return l.DestSch
}

func (l *LoadData) Children() []sql.Node {
	return nil
}

func (l *LoadData) IsReadOnly() bool {
	return false
}

func (l *LoadData) SplitLines(data []byte, atEOF bool) (advance int, token []byte, err error) {
	// Return Nothing if at end of file and no data passed.
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}

	// Find the index of the LINES TERMINATED BY delim.
	if i := bytes.Index(data, []byte(l.LinesTerminatedBy)); i >= 0 {
		// Include the terminator in the token so parser can detect EOF vs terminated lines
		return i + len(l.LinesTerminatedBy), data[0 : i+len(l.LinesTerminatedBy)], nil
	}

	// If at end of file with data return the data (no terminator present = EOF)
	if atEOF {
		return len(data), data, nil
	}

	return
}

func (l *LoadData) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(children), 0)
	}
	nl := *l
	return &nl, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*LoadData) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func NewLoadData(local bool, file string, destSch sql.Schema, cols []string, userVars []sql.Expression, ignoreNum int64, ignoreOrReplace string) *LoadData {
	isReplace := ignoreOrReplace == sqlparser.ReplaceStr
	isIgnore := ignoreOrReplace == sqlparser.IgnoreStr || (local && !isReplace)
	return &LoadData{
		Local:     local,
		File:      file,
		DestSch:   destSch,
		ColNames:  cols,
		UserVars:  userVars,
		IgnoreNum: ignoreNum,
		IsIgnore:  isIgnore,
		IsReplace: isReplace,

		FieldsTerminatedBy:  defaultFieldsTerminatedBy,
		FieldsEnclosedBy:    defaultFieldsEnclosedBy,
		FieldsEnclosedByOpt: defaultFieldsEnclosedByOpt,
		FieldsEscapedBy:     defaultFieldsEscapedBy,

		LinesStartingBy:   defaultLinesStartingBy,
		LinesTerminatedBy: defaultLinesTerminatedBy,
	}
}
