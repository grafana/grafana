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

package sql

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/dolthub/vitess/go/vt/sqlparser"
)

const (
	SqlModeSessionVar = "SQL_MODE"

	RealAsFloat           = "REAL_AS_FLOAT"
	PipesAsConcat         = "PIPES_AS_CONCAT"
	ANSIQuotes            = "ANSI_QUOTES"
	IgnoreSpace           = "IGNORE_SPACE"
	OnlyFullGroupBy       = "ONLY_FULL_GROUP_BY"
	NoUnsignedSubtraction = "NO_UNSIGNED_SUBTRACTION"
	NoDirInCreate         = "NO_DIR_IN_CREATE"
	// ANSI mode includes REAL_AS_FLOAT, PIPES_AS_CONCAT, ANSI_QUOTES, IGNORE_SPACE, and ONLY_FULL_GROUP_BY
	ANSI                   = "ANSI"
	NoAutoValueOnZero      = "NO_AUTO_VALUE_ON_ZERO"
	NoBackslashEscapes     = "NO_BACKSLASH_ESCAPES"
	StrictTransTables      = "STRICT_TRANS_TABLES"
	StrictAllTables        = "STRICT_ALL_TABLES"
	NoZeroInDate           = "NO_ZERO_IN_DATE"
	AllowInvalidDates      = "ALLOW_INVALID_DATES"
	ErrorForDivisionByZero = "ERROR_FOR_DIVISION_BY_ZERO"
	// Traditional mode includes STRICT_TRANS_TABLES, STRICT_ALL_TABLES, NO_ZERO_IN_DATE, ERROR_FOR_DIVISION_BY_ZERO,
	// and NO_ENGINE_SUBSTITUTION
	Traditional            = "TRADITIONAL"
	HighNotPrecedence      = "HIGH_NOT_PRECEDENCE"
	NoEngineSubstitution   = "NO_ENGINE_SUBSTITUTION"
	PadCharToFullLength    = "PAD_CHAR_TO_FULL_LENGTH"
	TimeTruncateFractional = "TIME_TRUNCATE_FRACTIONAL"
)

// Bits for different SQL modes
// https://github.com/mysql/mysql-server/blob/f362272c18e856930c867952a7dd1d840cbdb3b1/sql/system_variables.h#L123-L173
const (
	modeRealAsFloat            = 1
	modePipesAsConcat          = 2
	modeAnsiQuotes             = 4
	modeIgnoreSpace            = 8
	modeOnlyFullGroupBy        = 32
	modeNoUnsignedSubtraction  = 64
	modeNoDirInCreate          = 128
	modeAnsi                   = 0x40000
	modeNoAutoValueOnZero      = modeAnsi * 2
	modeNoBackslashEscapes     = modeNoAutoValueOnZero * 2
	modeStrictTransTables      = modeNoBackslashEscapes * 2
	modeStrictAllTables        = modeStrictTransTables * 2
	modeNoZeroInDate           = modeStrictAllTables * 2
	modeNoZeroDate             = modeNoZeroInDate * 2
	modeAllowInvalidDates      = modeNoZeroDate * 2
	modeErrorForDivisionByZero = modeAllowInvalidDates * 2
	modeTraditional            = modeErrorForDivisionByZero * 2
	modeHighNotPrecedence      = 1 << 29
	modeNoEngineSubstitution   = modeHighNotPrecedence * 2
	modePadCharToFullLength    = 1 << 31
	modeTimeTruncateFractional = 1 << 32

	// modeIgnoredMask contains deprecated/obsolete SQL mode bits that can be safely ignored
	// during binlog replication. These modes existed in older MySQL versions but are no longer used.
	// See: https://github.com/mysql/mysql-server/blob/trunk/sql/system_variables.h MODE_IGNORED_MASK
	modeIgnoredMask = 0x00100 | // was: MODE_POSTGRESQL
		0x00200 | // was: MODE_ORACLE
		0x00400 | // was: MODE_MSSQL
		0x00800 | // was: MODE_DB2
		0x01000 | // was: MODE_MAXDB
		0x02000 | // was: MODE_NO_KEY_OPTIONS
		0x04000 | // was: MODE_NO_TABLE_OPTIONS
		0x08000 | // was: MODE_NO_FIELD_OPTIONS
		0x10000 | // was: MODE_MYSQL323
		0x20000 | // was: MODE_MYSQL40
		0x10000000 // was: MODE_NO_AUTO_CREATE_USER
)

// sqlModeBitMap maps SQL mode bit flags to their string names.
var sqlModeBitMap = map[uint64]string{
	modeRealAsFloat:            RealAsFloat,
	modePipesAsConcat:          PipesAsConcat,
	modeAnsiQuotes:             ANSIQuotes,
	modeIgnoreSpace:            IgnoreSpace,
	modeOnlyFullGroupBy:        OnlyFullGroupBy,
	modeNoUnsignedSubtraction:  NoUnsignedSubtraction,
	modeNoDirInCreate:          NoDirInCreate,
	modeAnsi:                   ANSI,
	modeNoAutoValueOnZero:      NoAutoValueOnZero,
	modeNoBackslashEscapes:     NoBackslashEscapes,
	modeStrictTransTables:      StrictTransTables,
	modeStrictAllTables:        StrictAllTables,
	modeNoZeroInDate:           NoZeroInDate,
	modeAllowInvalidDates:      AllowInvalidDates,
	modeErrorForDivisionByZero: ErrorForDivisionByZero,
	modeTraditional:            Traditional,
	// Note: modeNoAutoCreateUser is NOT in this map - it's in modeIgnoredMask and filtered out
	modeHighNotPrecedence:      HighNotPrecedence,
	modeNoEngineSubstitution:   NoEngineSubstitution,
	modePadCharToFullLength:    PadCharToFullLength,
	modeTimeTruncateFractional: TimeTruncateFractional,
}

var DefaultSqlMode = strings.Join([]string{
	NoEngineSubstitution,
	OnlyFullGroupBy,
	StrictTransTables,
}, ",")

var defaultMode *SqlMode

func init() {
	elements := strings.Split(strings.ToLower(DefaultSqlMode), ",")
	sort.Strings(elements)
	modes := map[string]struct{}{}
	for _, element := range elements {
		modes[element] = struct{}{}
	}
	defaultMode = &SqlMode{
		modes:      modes,
		modeString: DefaultSqlMode,
	}
}

// SqlMode encodes the SQL mode string and provides methods for querying the enabled modes.
type SqlMode struct {
	modes      map[string]struct{}
	modeString string
}

// LoadSqlMode loads the SQL mode using the session data contained in |ctx| and returns a SqlMode
// instance that can be used to query which modes are enabled.
func LoadSqlMode(ctx *Context) *SqlMode {
	sqlMode, err := ctx.Session.GetSessionVariable(ctx, SqlModeSessionVar)
	if err != nil {
		// if system variables are not initialized, assume default sqlMode
		return &SqlMode{modes: nil, modeString: ""}
	}

	sqlModeString, ok := sqlMode.(string)
	if !ok {
		ctx.GetLogger().Warnf("sqlMode system variable value is invalid: '%v'", sqlMode)
		return &SqlMode{modes: nil, modeString: ""}
	}

	return NewSqlModeFromString(sqlModeString)
}

// NewSqlModeFromString returns a new SqlMode instance, constructed from the specified |sqlModeString| that
// has a comma-delimited list of SQL modes (e.g. "ONLY_FULLY_GROUP_BY,ANSI_QUOTES").
func NewSqlModeFromString(sqlModeString string) *SqlMode {
	if sqlModeString == DefaultSqlMode {
		return defaultMode
	}
	sqlModeString = strings.ToLower(sqlModeString)
	elements := strings.Split(sqlModeString, ",")
	sort.Strings(elements)
	modes := map[string]struct{}{}
	for _, element := range elements {
		modes[element] = struct{}{}
	}

	return &SqlMode{
		modes:      modes,
		modeString: strings.ToUpper(strings.Join(elements, ",")),
	}
}

// AnsiQuotes returns true if the ANSI_QUOTES SQL mode is enabled. Note that the ANSI mode is a compound mode that
// includes ANSI_QUOTES and other options, so if ANSI or ANSI_QUOTES is enabled, this function will return true.
func (s *SqlMode) AnsiQuotes() bool {
	return s.ModeEnabled(ANSIQuotes) || s.ModeEnabled(ANSI)
}

// OnlyFullGroupBy returns true is ONLY_TRUE_GROUP_BY SQL mode is enabled. Note that ANSI mode is a compound mode that
// includes ONLY_FULL_GROUP_BY and other options, so if ANSI or ONLY_TRUE_GROUP_BY is enabled, this function will
// return true.
func (s *SqlMode) OnlyFullGroupBy() bool {
	return s.ModeEnabled(OnlyFullGroupBy) || s.ModeEnabled(ANSI)
}

// PipesAsConcat returns true if PIPES_AS_CONCAT SQL mode is enabled. Note that ANSI mode is a compound mode that
// includes PIPES_AS_CONCAT and other options, so if ANSI or PIPES_AS_CONCAT is enabled, this function will return true.
func (s *SqlMode) PipesAsConcat() bool {
	return s.ModeEnabled(PipesAsConcat) || s.ModeEnabled(ANSI)
}

// StrictTransTables returns true if STRICT_TRANS_TABLES SQL mode is enabled. Note that TRADITIONAL mode is a compound
// mode that includes STRICT_TRANS_TABLES and other options, so if TRADITIONAL or STRICT_TRANS_TABLES is enabled, this
// function will return true.
func (s *SqlMode) StrictTransTables() bool {
	return s.ModeEnabled(StrictTransTables) || s.ModeEnabled(Traditional)
}

// StrictAllTables returns true if STRICT_ALL_TABLES SQL mode is enabled. Note that TRADITIONAL mode is a compound
// mode that includes STRICT_ALL_TABLES and other options, so if TRADITIONAL or STRICT_ALL_TABLES is enabled, this
// function will return true.
func (s *SqlMode) StrictAllTables() bool {
	return s.ModeEnabled(StrictAllTables) || s.ModeEnabled(Traditional)
}

// Strict mode is enabled when either STRICT_TRANS_TABLES or STRICT_ALL_TABLES is enabled.
func (s *SqlMode) Strict() bool {
	return s.StrictAllTables() || s.StrictTransTables()
}

// ModeEnabled returns true if |mode| was explicitly specified in the SQL_MODE string that was used to
// create this SqlMode instance. Note this function does not support expanding compound modes into the
// individual modes they contain (e.g. if "ANSI" is the SQL_MODE string, then this function will not
// report that "ANSI_QUOTES" is enabled). To deal with compound modes, use the mode specific functions,
// such as SqlMode::AnsiQuotes().
func (s *SqlMode) ModeEnabled(mode string) bool {
	_, ok := s.modes[strings.ToLower(mode)]
	return ok
}

// ParserOptions returns a ParserOptions struct, with options set based on what SQL modes are enabled.
func (s *SqlMode) ParserOptions() sqlparser.ParserOptions {
	return sqlparser.ParserOptions{
		AnsiQuotes:    s.AnsiQuotes(),
		PipesAsConcat: s.PipesAsConcat(),
	}
}

// String returns the SQL_MODE string representing this SqlMode instance.
func (s *SqlMode) String() string {
	return s.modeString
}

// ConvertSqlModeBitmask converts sql_mode values to their string representation.
func ConvertSqlModeBitmask(val any) (string, error) {
	var bitmask uint64
	switch v := val.(type) {
	case []byte:
		if n, err := strconv.ParseUint(string(v), 10, 64); err == nil {
			bitmask = n
		}
	case int8:
		bitmask = uint64(v)
	case int16:
		bitmask = uint64(v)
	case int:
		bitmask = uint64(v)
	case int32:
		bitmask = uint64(v)
	case int64:
		bitmask = uint64(v)
	case uint8:
		bitmask = uint64(v)
	case uint16:
		bitmask = uint64(v)
	case uint:
		bitmask = uint64(v)
	case uint32:
		bitmask = uint64(v)
	case uint64:
		bitmask = v
	default:
		return fmt.Sprintf("%v", val), nil
	}

	bitmask = bitmask &^ modeIgnoredMask

	var modes []string
	var matchedBits uint64
	for bit, modeName := range sqlModeBitMap {
		if bitmask&bit != 0 {
			modes = append(modes, modeName)
			matchedBits |= bit
		}
	}

	if bitmask != 0 && matchedBits != bitmask {
		return fmt.Sprintf("%v", val), nil
	}

	if len(modes) == 0 {
		return "", nil
	}

	return strings.Join(modes, ","), nil
}
