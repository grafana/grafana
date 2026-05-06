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

package function

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type LoadFile struct {
	fileName sql.Expression
}

var _ sql.FunctionExpression = (*LoadFile)(nil)
var _ sql.CollationCoercible = (*LoadFile)(nil)

// NewLoadFile returns a LoadFile object for the LOAD_FILE() function.
func NewLoadFile(fileName sql.Expression) sql.Expression {
	return &LoadFile{
		fileName: fileName,
	}
}

// Description implements sql.FunctionExpression
func (l *LoadFile) Description() string {
	return "returns a LoadFile object."
}

// Resolved implements sql.Expression.
func (l *LoadFile) Resolved() bool {
	return l.fileName.Resolved()
}

// String implements sql.Expression.
func (l *LoadFile) String() string {
	return fmt.Sprintf("%s(%s)", l.FunctionName(), l.fileName)
}

// Type implements sql.Expression.
func (l *LoadFile) Type() sql.Type {
	return types.LongBlob
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*LoadFile) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements sql.Expression.
func (l *LoadFile) IsNullable() bool {
	return true
}

// TODO: Allow FILE privileges for GRANT
// Eval implements sql.Expression.
func (l *LoadFile) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	dir, err := ctx.Session.GetSessionVariable(ctx, "secure_file_priv")
	if err != nil {
		return "", err
	}

	// Read the file: Ensure it fits the max byte size
	file, err := l.getFile(ctx, row, dir.(string))
	if err != nil {
		// If the file doesn't exist we swallow that error
		if os.IsNotExist(err) {
			return nil, nil
		}

		return nil, err
	}
	if file == nil {
		return nil, nil
	}

	defer file.Close()

	size, isTooBig, err := isFileTooBig(ctx, file)
	if err != nil {
		return nil, err
	}
	// According to the mysql spec we must return NULL if the file is too big.
	if isTooBig {
		return nil, nil
	}

	// Finally, read the file
	data := make([]byte, size)
	_, err = file.Read(data)
	if err != nil {
		return nil, err
	}

	return data, nil
}

// getFile returns the file handler for the passed in filename. The file must be in the secure_file_priv
// directory.
func (l *LoadFile) getFile(ctx *sql.Context, row sql.Row, secureFileDir string) (*os.File, error) {
	fileName, err := l.fileName.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// If the secure_file_priv directory is not set, just read the file from whatever directory it is in
	// Otherwise determine whether the file is in the secure_file_priv directory.
	if secureFileDir == "" {
		return os.Open(fileName.(string))
	}

	// Open the two directories (secure_file_priv and the file dir) and validate they are the same.
	sDir, err := os.Open(secureFileDir)
	if err != nil {
		return nil, err
	}

	sStat, err := sDir.Stat()
	if err != nil {
		return nil, err
	}

	ffDir, err := os.Open(filepath.Dir(fileName.(string)))
	if err != nil {
		return nil, err
	}

	fStat, err := ffDir.Stat()
	if err != nil {
		return nil, err
	}

	// If the two directories are not equivalent we return nil
	if !os.SameFile(sStat, fStat) {
		return nil, nil
	}

	return os.Open(fileName.(string))
}

// isFileTooBig return the current file size and whether or not it is larger than max_allowed_packet.
func isFileTooBig(ctx *sql.Context, file *os.File) (int64, bool, error) {
	fi, err := file.Stat()
	if err != nil {
		return -1, false, err
	}

	val, err := ctx.Session.GetSessionVariable(ctx, "max_allowed_packet")
	if err != nil {
		return -1, false, err
	}

	return fi.Size(), fi.Size() > val.(int64), nil
}

// Children implements sql.Expression.
func (l *LoadFile) Children() []sql.Expression {
	return []sql.Expression{l.fileName}
}

// WithChildren implements sql.Expression.
func (l *LoadFile) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(children), 1)
	}

	return NewLoadFile(children[0]), nil
}

// FunctionName implements sql.FunctionExpression.
func (l *LoadFile) FunctionName() string {
	return "load_file"
}
