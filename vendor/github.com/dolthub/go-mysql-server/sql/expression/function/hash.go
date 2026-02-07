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

package function

import (
	"bytes"
	"compress/zlib"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"hash"
	"io"
	"unicode"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// MD5 function returns the MD5 hash of the input.
// https://dev.mysql.com/doc/refman/8.0/en/encryption-functions.html#function_md5
type MD5 struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*MD5)(nil)
var _ sql.CollationCoercible = (*MD5)(nil)

// NewMD5 returns a new MD5 function expression
func NewMD5(arg sql.Expression) sql.Expression {
	return &MD5{NewUnaryFunc(arg, "MD5", types.LongText)}
}

// Description implements sql.FunctionExpression
func (f *MD5) Description() string {
	return "calculates MD5 checksum."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MD5) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// Eval implements sql.Expression
func (f *MD5) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := f.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}
	if arg == nil {
		return nil, nil
	}

	val, _, err := types.LongBlob.Convert(ctx, arg)
	if err != nil {
		return nil, err
	}

	h := md5.New()
	_, err = h.Write(val.([]byte))
	if err != nil {
		return nil, err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// WithChildren implements sql.Expression
func (f *MD5) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}
	return NewMD5(children[0]), nil
}

// SHA1 function returns the SHA1 hash of the input.
// https://dev.mysql.com/doc/refman/8.0/en/encryption-functions.html#function_sha1
type SHA1 struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*SHA1)(nil)
var _ sql.CollationCoercible = (*SHA1)(nil)

// NewSHA1 returns a new SHA1 function expression
func NewSHA1(arg sql.Expression) sql.Expression {
	return &SHA1{NewUnaryFunc(arg, "SHA1", types.LongText)}
}

// Description implements sql.FunctionExpression
func (f *SHA1) Description() string {
	return "calculates an SHA-1 160-bit checksum."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*SHA1) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// Eval implements sql.Expression
func (f *SHA1) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := f.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}
	if arg == nil {
		return nil, nil
	}

	val, _, err := types.LongBlob.Convert(ctx, arg)
	if err != nil {
		return nil, err
	}
	val, err = sql.UnwrapAny(ctx, val)
	if err != nil {
		return nil, err
	}

	h := sha1.New()
	_, err = io.WriteString(h, string(val.([]byte)))
	if err != nil {
		return nil, err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// WithChildren implements sql.Expression
func (f *SHA1) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}
	return NewSHA1(children[0]), nil
}

// SHA2 function returns the SHA-224/256/384/512 hash of the input.
// https://dev.mysql.com/doc/refman/8.0/en/encryption-functions.html#function_sha2
type SHA2 struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*SHA2)(nil)
var _ sql.CollationCoercible = (*SHA2)(nil)

// NewSHA2 returns a new SHA2 function expression
func NewSHA2(arg, count sql.Expression) sql.Expression {
	return &SHA2{expression.BinaryExpressionStub{LeftChild: arg, RightChild: count}}
}

// Description implements sql.FunctionExpression
func (f *SHA2) Description() string {
	return "calculates an SHA-2 checksum."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*SHA2) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// Eval implements sql.Expression
func (f *SHA2) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := f.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if arg == nil {
		return nil, nil
	}
	countArg, err := f.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if countArg == nil {
		return nil, nil
	}

	val, _, err := types.LongBlob.Convert(ctx, arg)
	if err != nil {
		return nil, err
	}
	count, _, err := types.Int64.Convert(ctx, countArg)
	if err != nil {
		return nil, err
	}

	var h hash.Hash
	switch count.(int64) {
	case 224:
		h = sha256.New224()
	case 256, 0:
		h = sha256.New()
	case 384:
		h = sha512.New384()
	case 512:
		h = sha512.New()
	default:
		return nil, nil
	}

	_, err = h.Write(val.([]byte))
	if err != nil {
		return nil, err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// FunctionName implements sql.FunctionExpression
func (f *SHA2) FunctionName() string {
	return "sha2"
}

// String implements sql.Expression
func (f *SHA2) String() string {
	return fmt.Sprintf("%s(%s,%s)", f.FunctionName(), f.LeftChild, f.RightChild)
}

// Type implements sql.Expression
func (f *SHA2) Type() sql.Type {
	return types.LongText
}

// WithChildren implements sql.Expression
func (f *SHA2) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 2)
	}
	return NewSHA2(children[0], children[1]), nil
}

// Compress function returns the compressed binary string of the input.
// https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_compress
type Compress struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Compress)(nil)
var _ sql.CollationCoercible = (*Compress)(nil)

// NewCompress returns a new Compress function expression
func NewCompress(arg sql.Expression) sql.Expression {
	return &Compress{NewUnaryFunc(arg, "Compress", types.LongBlob)}
}

// Description implements sql.FunctionExpression
func (f *Compress) Description() string {
	return "compresses a string and returns the result as a binary string."
}

func (f *Compress) Type() sql.Type {
	return types.LongBlob
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Compress) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// Eval implements sql.Expression
func (f *Compress) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := f.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}
	if arg == nil {
		return nil, nil
	}

	val, _, err := types.LongBlob.Convert(ctx, arg)
	if err != nil {
		return nil, err
	}
	valBytes := val.([]byte)
	if len(valBytes) == 0 {
		return []byte{}, nil
	}

	// TODO: the golang standard library implementation of zlib is different than the original C implementation that
	// MySQL uses. This means that the output of compressed data will be different. However, this library claims to be
	// able to uncompress MySQL compressed data. There are unit tests for this in hash_test.go.
	var buf bytes.Buffer
	writer, err := zlib.NewWriterLevel(&buf, zlib.BestCompression)
	if err != nil {
		return nil, err
	}
	_, err = writer.Write(valBytes)
	if err != nil {
		return nil, err
	}
	err = writer.Close()
	if err != nil {
		return nil, err
	}

	// Prepend length of original string
	lenHeader := make([]byte, 4)
	binary.LittleEndian.PutUint32(lenHeader, uint32(len(valBytes)))
	res := append(lenHeader, buf.Bytes()...)
	return res, nil
}

// WithChildren implements sql.Expression
func (f *Compress) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}
	return NewCompress(children[0]), nil
}

// Uncompress function returns the binary string from the compressed input.
// https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_uncompress
type Uncompress struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Uncompress)(nil)
var _ sql.CollationCoercible = (*Uncompress)(nil)

const (
	compressHeaderSize = 4
	compressMaxSize    = 0x04000000
)

// NewUncompress returns a new Uncompress function expression
func NewUncompress(arg sql.Expression) sql.Expression {
	return &Uncompress{NewUnaryFunc(arg, "Uncompress", types.LongBlob)}
}

// Description implements sql.FunctionExpression
func (f *Uncompress) Description() string {
	return "uncompresses a string compressed by the COMPRESS() function."
}

func (f *Uncompress) Type() sql.Type {
	return types.LongBlob
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Uncompress) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// Eval implements sql.Expression
func (f *Uncompress) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := f.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}
	if arg == nil {
		return nil, nil
	}

	val, _, err := types.LongBlob.Convert(ctx, arg)
	if err != nil {
		ctx.Warn(1258, "%s", err.Error())
		return nil, nil
	}
	valBytes := val.([]byte)
	if len(valBytes) == 0 {
		return []byte{}, nil
	}
	if len(valBytes) <= compressHeaderSize {
		ctx.Warn(1258, "input data corrupted")
		return nil, nil
	}

	var inBuf bytes.Buffer
	inBuf.Write(valBytes[compressHeaderSize:]) // skip length header
	reader, err := zlib.NewReader(&inBuf)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	outLen := binary.LittleEndian.Uint32(valBytes[:compressHeaderSize])
	if outLen > compressMaxSize {
		ctx.Warn(1258, "Uncompressed data too large; the maximum size is %d", compressMaxSize)
		return nil, nil
	}

	outBuf := make([]byte, outLen)
	readLen, err := reader.Read(outBuf)
	if err != nil && err != io.EOF {
		ctx.Warn(1258, "%s", err.Error())
		return nil, nil
	}
	// if we don't receive io.EOF, then received outLen was too small
	if err == nil {
		ctx.Warn(1258, "not enough room in output buffer")
		return nil, nil
	}
	return outBuf[:readLen], nil
}

// WithChildren implements sql.Expression
func (f *Uncompress) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}
	return NewUncompress(children[0]), nil
}

// UncompressedLength function returns the length of the original string from the compressed string input.
// https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_uncompress
type UncompressedLength struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*UncompressedLength)(nil)
var _ sql.CollationCoercible = (*UncompressedLength)(nil)

// NewUncompressedLength returns a new UncompressedLength function expression
func NewUncompressedLength(arg sql.Expression) sql.Expression {
	return &UncompressedLength{NewUnaryFunc(arg, "UncompressedLength", types.Uint32)}
}

// Description implements sql.FunctionExpression
func (f *UncompressedLength) Description() string {
	return "returns length of original uncompressed string from compressed string input."
}

func (f *UncompressedLength) Type() sql.Type {
	return types.Uint32
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*UncompressedLength) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// Eval implements sql.Expression
func (f *UncompressedLength) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := f.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}
	if arg == nil {
		return nil, nil
	}

	val, _, err := types.LongBlob.Convert(ctx, arg)
	if err != nil {
		ctx.Warn(1258, "%s", err.Error())
		return nil, nil
	}
	valBytes := val.([]byte)
	if len(valBytes) == 0 {
		return uint32(0), nil
	}
	if len(valBytes) <= compressHeaderSize {
		ctx.Warn(1258, "input data corrupted")
		return nil, nil
	}

	outLen := binary.LittleEndian.Uint32(valBytes[:compressHeaderSize])
	return outLen, nil
}

// WithChildren implements sql.Expression
func (f *UncompressedLength) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}
	return NewUncompressedLength(children[0]), nil
}

// ValidatePasswordStrength function returns an integer to indicate how strong the password is.
// https://dev.mysql.com/doc/refman/8.4/en/validate-password.html
type ValidatePasswordStrength struct {
	*UnaryFunc
}

const minPasswordLength = 4

var _ sql.FunctionExpression = (*ValidatePasswordStrength)(nil)
var _ sql.CollationCoercible = (*ValidatePasswordStrength)(nil)

// NewValidatePasswordStrength returns a new ValidatePasswordStrength function expression
func NewValidatePasswordStrength(arg sql.Expression) sql.Expression {
	return &ValidatePasswordStrength{NewUnaryFunc(arg, "ValidatePasswordStrength", types.Uint32)}
}

// Description implements sql.FunctionExpression
func (f *ValidatePasswordStrength) Description() string {
	return "returns an integer to indicate how strong the password is."
}

func (f *ValidatePasswordStrength) Type() sql.Type {
	return types.Int32
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ValidatePasswordStrength) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// Eval implements sql.Expression
func (f *ValidatePasswordStrength) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := f.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}
	if arg == nil {
		return nil, nil
	}

	val, _, err := types.LongText.Convert(ctx, arg)
	if err != nil {
		return nil, nil
	}
	password := val.(string)
	strength := 0
	if len(password) < minPasswordLength {
		return strength, nil
	}
	strength += 25

	// Requirements for LOW password strength
	_, passLen, ok := sql.SystemVariables.GetGlobal("validate_password.length")
	if !ok {
		return nil, err
	}
	passLenInt, ok := types.CoalesceInt(passLen)
	if !ok {
		return nil, fmt.Errorf("invalid value for validate_password.length: %v", passLen)
	}
	if len(password) < passLenInt {
		return strength, nil
	}
	strength += 25

	// Requirements for MEDIUM password strength
	_, numCount, ok := sql.SystemVariables.GetGlobal("validate_password.number_count")
	if !ok {
		return nil, fmt.Errorf("error: validate_password.number_count variable was not found")
	}
	numCountInt, ok := types.CoalesceInt(numCount)
	if !ok {
		return nil, fmt.Errorf("invalid value for validate_password.number_count: %v", numCount)
	}
	_, mixCaseCount, ok := sql.SystemVariables.GetGlobal("validate_password.mixed_case_count")
	if !ok {
		return nil, fmt.Errorf("error: validate_password.mixed_case_count variable was not found")
	}
	mixCaseCountInt, ok := types.CoalesceInt(mixCaseCount)
	if !ok {
		return nil, fmt.Errorf("invalid value for validate_password.mixed_case_count: %v", mixCaseCount)
	}
	lowerCount, upperCount := mixCaseCountInt, mixCaseCountInt
	_, specialCharCount, ok := sql.SystemVariables.GetGlobal("validate_password.special_char_count")
	if !ok {
		return nil, fmt.Errorf("error: validate_password.special_char_count variable was not found")
	}
	specialCharCountInt, ok := types.CoalesceInt(specialCharCount)
	if !ok {
		return nil, fmt.Errorf("invalid value for validate_password.special_char_count: %v", specialCharCount)
	}
	for _, c := range password {
		if unicode.IsNumber(c) {
			numCountInt--
		} else if unicode.IsUpper(c) {
			upperCount--
		} else if unicode.IsLower(c) {
			lowerCount--
		} else {
			specialCharCountInt--
		}
	}
	if numCountInt > 0 || upperCount > 0 || lowerCount > 0 || specialCharCountInt > 0 {
		return strength, nil
	}
	strength += 25

	// Requirements for STRONG password strength
	// TODO: support dictionary file substring matching
	strength += 25

	return strength, nil
}

// WithChildren implements sql.Expression
func (f *ValidatePasswordStrength) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}
	return NewValidatePasswordStrength(children[0]), nil
}
