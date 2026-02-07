/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package sqlparser

import (
	"strconv"
	"strings"
	"unicode"
)

const (
	// DirectiveMultiShardAutocommit is the query comment directive to allow
	// single round trip autocommit with a multi-shard statement.
	DirectiveMultiShardAutocommit = "MULTI_SHARD_AUTOCOMMIT"
	// DirectiveSkipQueryPlanCache skips query plan cache when set.
	DirectiveSkipQueryPlanCache = "SKIP_QUERY_PLAN_CACHE"
	// DirectiveQueryTimeout sets a query timeout in vtgate. Only supported for SELECTS.
	DirectiveQueryTimeout = "QUERY_TIMEOUT_MS"
	// DirectiveScatterErrorsAsWarnings enables partial success scatter select queries
	DirectiveScatterErrorsAsWarnings = "SCATTER_ERRORS_AS_WARNINGS"
)

func isNonSpace(r rune) bool {
	return !unicode.IsSpace(r)
}

// leadingCommentEnd returns the first index after all leading comments, or
// 0 if there are no leading comments.
func leadingCommentEnd(text string) (end int) {
	hasComment := false
	pos := 0
	for pos < len(text) {
		// Eat up any whitespace. Trailing whitespace will be considered part of
		// the leading comments.
		nextVisibleOffset := strings.IndexFunc(text[pos:], isNonSpace)
		if nextVisibleOffset < 0 {
			break
		}
		pos += nextVisibleOffset
		remainingText := text[pos:]

		// Found visible characters. Look for '/*' at the beginning
		// and '*/' somewhere after that.
		if len(remainingText) < 4 || remainingText[:2] != "/*" {
			break
		}
		commentLength := 4 + strings.Index(remainingText[2:], "*/")
		if commentLength < 4 {
			// Missing end comment :/
			break
		}

		hasComment = true
		pos += commentLength
	}

	if hasComment {
		return pos
	}
	return 0
}

// trailingCommentStart returns the first index of trailing comments.
// If there are no trailing comments, returns the length of the input string.
func trailingCommentStart(text string) (start int) {
	hasComment := false
	reducedLen := len(text)
	for reducedLen > 0 {
		// Eat up any whitespace. Leading whitespace will be considered part of
		// the trailing comments.
		nextReducedLen := strings.LastIndexFunc(text[:reducedLen], isNonSpace) + 1
		if nextReducedLen == 0 {
			break
		}
		reducedLen = nextReducedLen
		if reducedLen < 4 || text[reducedLen-2:reducedLen] != "*/" {
			break
		}

		// Find the beginning of the comment
		startCommentPos := strings.LastIndex(text[:reducedLen-2], "/*")
		if startCommentPos < 0 {
			// Badly formatted sql :/
			break
		}

		hasComment = true
		reducedLen = startCommentPos
	}

	if hasComment {
		return reducedLen
	}
	return len(text)
}

// MarginComments holds the leading and trailing comments that surround a query.
type MarginComments struct {
	Leading  string
	Trailing string
}

// SplitMarginComments pulls out any leading or trailing comments from a raw sql query.
// This function also trims leading (if there's a comment) and trailing whitespace.
func SplitMarginComments(sql string) (query string, comments MarginComments) {
	trailingStart := trailingCommentStart(sql)
	leadingEnd := leadingCommentEnd(sql[:trailingStart])
	comments = MarginComments{
		Leading:  strings.TrimLeftFunc(sql[:leadingEnd], unicode.IsSpace),
		Trailing: strings.TrimRightFunc(sql[trailingStart:], unicode.IsSpace),
	}
	return strings.TrimFunc(sql[leadingEnd:trailingStart], unicode.IsSpace), comments
}

// StripLeadingComments trims the SQL string and removes any leading comments
func StripLeadingComments(sql string) string {
	sql = strings.TrimFunc(sql, unicode.IsSpace)

	for hasCommentPrefix(sql) {
		switch sql[0] {
		case '/':
			// Multi line comment
			index := strings.Index(sql, "*/")
			if index <= 1 {
				return sql
			}
			// don't strip /*! ... */ or /*!50700 ... */
			if len(sql) > 2 && sql[2] == '!' {
				return sql
			}
			sql = sql[index+2:]
		case '-':
			// Single line comment
			index := strings.Index(sql, "\n")
			if index == -1 {
				return ""
			}
			sql = sql[index+1:]
		}

		sql = strings.TrimFunc(sql, unicode.IsSpace)
	}

	return sql
}

func hasCommentPrefix(sql string) bool {
	return len(sql) > 1 && ((sql[0] == '/' && sql[1] == '*') || (sql[0] == '-' && sql[1] == '-'))
}

// StripComments removes all comments from the string regardless
// of where they occur
func StripComments(sql string) string {
	sql = StripLeadingComments(sql) // handle -- or /* ... */ at the beginning

	for {
		start := strings.Index(sql, "/*")
		if start == -1 {
			break
		}
		end := strings.Index(sql, "*/")
		if end <= 1 {
			break
		}
		sql = sql[:start] + sql[end+2:]
	}

	sql = strings.TrimFunc(sql, unicode.IsSpace)

	return sql
}

// ExtractMysqlComment extracts the version and SQL from a comment-only query
// such as /*!50708 sql here */
func ExtractMysqlComment(sql string) (version string, innerSQL string) {
	sql = sql[3 : len(sql)-2]

	digitCount := 0
	endOfVersionIndex := strings.IndexFunc(sql, func(c rune) bool {
		digitCount++
		return !unicode.IsDigit(c) || digitCount == 6
	})
	version = sql[0:endOfVersionIndex]
	innerSQL = strings.TrimFunc(sql[endOfVersionIndex:], unicode.IsSpace)

	return version, innerSQL
}

const commentDirectivePreamble = "/*vt+"

// CommentDirectives is the parsed representation for execution directives
// conveyed in query comments
type CommentDirectives map[string]interface{}

// ExtractCommentDirectives parses the comment list for any execution directives
// of the form:
//
//     /*vt+ OPTION_ONE=1 OPTION_TWO OPTION_THREE=abcd */
//
// It returns the map of the directive values or nil if there aren't any.
func ExtractCommentDirectives(comments Comments) CommentDirectives {
	if comments == nil {
		return nil
	}

	var vals map[string]interface{}

	for _, comment := range comments {
		commentStr := string(comment)
		if commentStr[0:5] != commentDirectivePreamble {
			continue
		}

		if vals == nil {
			vals = make(map[string]interface{})
		}

		// Split on whitespace and ignore the first and last directive
		// since they contain the comment start/end
		directives := strings.Fields(commentStr)
		for i := 1; i < len(directives)-1; i++ {
			directive := directives[i]
			sep := strings.IndexByte(directive, '=')

			// No value is equivalent to a true boolean
			if sep == -1 {
				vals[directive] = true
				continue
			}

			strVal := directive[sep+1:]
			directive = directive[:sep]

			intVal, err := strconv.Atoi(strVal)
			if err == nil {
				vals[directive] = intVal
				continue
			}

			boolVal, err := strconv.ParseBool(strVal)
			if err == nil {
				vals[directive] = boolVal
				continue
			}

			vals[directive] = strVal
		}
	}
	return vals
}

// IsSet checks the directive map for the named directive and returns
// true if the directive is set and has a true/false or 0/1 value
func (d CommentDirectives) IsSet(key string) bool {
	if d == nil {
		return false
	}

	val, ok := d[key]
	if !ok {
		return false
	}

	boolVal, ok := val.(bool)
	if ok {
		return boolVal
	}

	intVal, ok := val.(int)
	if ok {
		return intVal == 1
	}
	return false
}

// SkipQueryPlanCacheDirective returns true if skip query plan cache directive is set to true in query.
func SkipQueryPlanCacheDirective(stmt Statement) bool {
	switch stmt := stmt.(type) {
	case *Select:
		directives := ExtractCommentDirectives(stmt.Comments)
		if directives.IsSet(DirectiveSkipQueryPlanCache) {
			return true
		}
	case *Insert:
		directives := ExtractCommentDirectives(stmt.Comments)
		if directives.IsSet(DirectiveSkipQueryPlanCache) {
			return true
		}
	case *Update:
		directives := ExtractCommentDirectives(stmt.Comments)
		if directives.IsSet(DirectiveSkipQueryPlanCache) {
			return true
		}
	case *Delete:
		directives := ExtractCommentDirectives(stmt.Comments)
		if directives.IsSet(DirectiveSkipQueryPlanCache) {
			return true
		}
	default:
		return false
	}
	return false
}
