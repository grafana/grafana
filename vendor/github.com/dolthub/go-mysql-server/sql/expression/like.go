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

package expression

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Like performs pattern matching against two strings.
type Like struct {
	BinaryExpressionStub
	Escape sql.Expression
	pool   *sync.Pool
	once   sync.Once
	cached bool
}

var _ sql.Expression = (*Like)(nil)
var _ sql.CollationCoercible = (*Like)(nil)

type likeMatcherErrTuple struct {
	err     error
	matcher LikeMatcher
}

// NewLike creates a new LIKE expression.
func NewLike(left, right, escape sql.Expression) sql.Expression {
	var cached = true
	sql.Inspect(right, func(e sql.Expression) bool {
		if _, ok := e.(*GetField); ok {
			cached = false
		}
		return true
	})

	return &Like{
		BinaryExpressionStub: BinaryExpressionStub{left, right},
		Escape:               escape,
		pool:                 nil,
		once:                 sync.Once{},
		cached:               cached,
	}
}

// Type implements the sql.Expression interface.
func (l *Like) Type() sql.Type { return types.Boolean }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (l *Like) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, l.LeftChild)
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, l.RightChild)
	return sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
}

// Eval implements the sql.Expression interface.
func (l *Like) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span("expression.Like")
	defer span.End()

	left, err := l.LeftChild.Eval(ctx, row)
	if err != nil || left == nil {
		return nil, err
	}
	left, err = sql.UnwrapAny(ctx, left)
	if err != nil {
		return nil, err
	}
	if _, ok := left.(string); !ok {
		// Use type-aware conversion for enum types
		leftStr, _, err := types.ConvertToCollatedString(ctx, left, l.Left().Type())
		if err != nil {
			return nil, err
		}
		left = leftStr
	}

	var lm LikeMatcher
	right, escape, err := l.evalRight(ctx, row)
	if err != nil {
		return nil, err
	}
	if right == nil {
		return nil, nil
	}
	if !l.cached {
		// for non-cached regex every time create a new matcher
		collation, _ := l.CollationCoercibility(ctx)
		lm, err = ConstructLikeMatcher(collation, *right, escape)
	} else {
		l.once.Do(func() {
			l.pool = &sync.Pool{
				New: func() interface{} {
					collation, _ := l.CollationCoercibility(ctx)
					m, e := ConstructLikeMatcher(collation, *right, escape)
					return likeMatcherErrTuple{matcher: m, err: e}
				},
			}
		})
		tpl := l.pool.Get().(likeMatcherErrTuple)
		lm, err = tpl.matcher, tpl.err
	}
	if err != nil {
		return nil, err
	}

	ok := lm.Match(left.(string))
	if l.cached {
		l.pool.Put(likeMatcherErrTuple{matcher: lm})
	}
	return ok, nil
}

func (l *Like) evalRight(ctx *sql.Context, row sql.Row) (right *string, escape rune, err error) {
	rightVal, err := l.RightChild.Eval(ctx, row)
	if err != nil || rightVal == nil {
		return nil, 0, err
	}
	rightVal, err = sql.UnwrapAny(ctx, rightVal)
	if err != nil {
		return nil, 0, err
	}
	if _, ok := rightVal.(string); !ok {
		// Use type-aware conversion for enum types
		rightStr, _, err := types.ConvertToCollatedString(ctx, rightVal, l.Right().Type())
		if err != nil {
			return nil, 0, err
		}
		rightVal = rightStr
	}

	var escapeVal interface{}
	if l.Escape != nil {
		escapeVal, err = l.Escape.Eval(ctx, row)
		if err != nil {
			return nil, 0, err
		}
		if escapeVal == nil {
			escapeVal = `\`
		}
		if _, ok := escapeVal.(string); !ok {
			escapeVal, _, err = types.LongText.Convert(ctx, escapeVal)
			if err != nil {
				return nil, 0, err
			}
		}
		if utf8.RuneCountInString(escapeVal.(string)) > 1 {
			return nil, 0, sql.ErrInvalidArgument.New("ESCAPE")
		}
	} else {
		escapeVal = `\`
	}

	rightStr := rightVal.(string)
	return &rightStr, []rune(escapeVal.(string))[0], nil
}

func (l *Like) String() string {
	return fmt.Sprintf("%s LIKE %s", l.LeftChild, l.RightChild)
}

// WithChildren implements the Expression interface.
func (l *Like) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(children), 2)
	}
	return NewLike(children[0], children[1], l.Escape), nil
}

func patternToGoRegex(pattern string) string {
	var buf bytes.Buffer
	buf.WriteString("(?s)")
	buf.WriteRune('^')
	var escaped bool
	for _, r := range strings.Replace(regexp.QuoteMeta(pattern), `\\`, `\`, -1) {
		switch r {
		case '_':
			if escaped {
				buf.WriteRune(r)
			} else {
				buf.WriteRune('.')
			}
		case '%':
			if escaped {
				buf.WriteRune(r)
			} else {
				buf.WriteString(".*")
			}
		case '\\':
			if escaped {
				buf.WriteString(`\\`)
			} else {
				escaped = true
				continue
			}
		default:
			if escaped {
				buf.WriteString(`\`)
			}
			buf.WriteRune(r)
		}

		if escaped {
			escaped = false
		}
	}

	buf.WriteRune('$')
	return buf.String()
}

func patternToGoRegexWithEscape(pattern, escape string) string {
	var buf bytes.Buffer
	buf.WriteString("(?s)")
	buf.WriteRune('^')
	var escaped bool

	for _, r := range strings.Replace(strings.Replace(regexp.QuoteMeta(pattern), `\\`, `\`, -1), regexp.QuoteMeta(escape), escape, -1) {
		switch r {
		case rune(escape[0]):
			if escaped {
				buf.WriteString(regexp.QuoteMeta(escape))
			} else {
				escaped = true
				continue
			}
		case '_':
			if escaped {
				buf.WriteRune(r)
			} else {
				buf.WriteRune('.')
			}
		case '%':
			if escaped {
				buf.WriteRune(r)
			} else {
				buf.WriteString(".*")
			}
		case '\\':
			if escaped {
				buf.WriteString(`\\`)
			} else {
				escaped = true
				continue
			}
		default:
			if escaped {
				buf.WriteString(`\`)
			}
			buf.WriteRune(r)
		}

		if escaped {
			escaped = false
		}
	}

	buf.WriteRune('$')
	return buf.String()
}

// LikeMatcher is a collation-supported matcher for LIKE expressions.
type LikeMatcher struct {
	nodes     []likeMatcherNode
	collation sql.CollationID
	escape    rune
}

// ConstructLikeMatcher returns a new LikeMatcher.
func ConstructLikeMatcher(collation sql.CollationID, pattern string, escape rune) (LikeMatcher, error) {
	charsetEncoder := collation.CharacterSet().Encoder()
	sorter := collation.Sorter()
	matcher := LikeMatcher{nil, collation, escape}
	for i := 0; i < len(pattern); {
		nextRune, advance := charsetEncoder.NextRune(pattern[i:])
		if nextRune == utf8.RuneError {
			return LikeMatcher{}, sql.ErrCharSetInvalidString.New(collation.CharacterSet().Name(), pattern)
		}
		i += advance

		switch nextRune {
		case '_': // Matches any single character
			matcher.nodes = append(matcher.nodes, likeMatcherRune{'_', -1})
		case '%': // Matches any sequence of characters, including the empty sequence
			matcher.nodes = append(matcher.nodes, likeMatcherAny{})
		case escape: // States that the next character should be taken literally
			nextRune, advance = charsetEncoder.NextRune(pattern[i:])
			if nextRune == utf8.RuneError {
				return LikeMatcher{}, sql.ErrCharSetInvalidString.New(collation.CharacterSet().Name(), pattern)
			}
			i += advance
			matcher.nodes = append(matcher.nodes, likeMatcherRune{nextRune, sorter(nextRune)})
		default: // A regular character that we'll match against
			matcher.nodes = append(matcher.nodes, likeMatcherRune{nextRune, sorter(nextRune)})
		}
	}
	return matcher, nil
}

// Match returns whether the given string conforms to the nodes contained in this matcher.
func (l LikeMatcher) Match(s string) bool {
	if len(l.nodes) == 0 {
		if len(s) == 0 {
			return true
		}
		return false
	}

	charsetEncoder := l.collation.CharacterSet().Encoder()
	stringIndex := 0
	nodeIndex := 0
	nodeNextIndex := make([]int, 0, len(l.nodes))
	for {
		// If both indexes equal their lengths, we've fully matched the string with all nodes
		if stringIndex == len(s) && nodeIndex == len(l.nodes) {
			return true
		}
		// If all nodes have found a match but we still have runes left in the string, we backtrack to allow earlier
		// nodes to match more runes. If we're unable to backtrack, then the string does not match.
		if stringIndex < len(s) && nodeIndex == len(l.nodes) {
			var matched bool
			matched, nodeIndex = l.backtrack(s, nodeIndex-1, nodeNextIndex)
			if !matched {
				return false
			}
			nodeNextIndex = nodeNextIndex[:nodeIndex]
			stringIndex = nodeNextIndex[nodeIndex-1]
			continue
		}
		// If all runes have found a match but we still have nodes left in the matcher, we check if the remaining nodes
		// are all "any sequence" nodes. If they're not, then the string is too short and does not match.
		if stringIndex == len(s) && nodeIndex < len(l.nodes) {
			for ; nodeIndex < len(l.nodes); nodeIndex++ {
				if _, ok := l.nodes[nodeIndex].(likeMatcherAny); !ok {
					return false
				}
			}
			return true
		}

		nextRune, advance := charsetEncoder.NextRune(s[stringIndex:])
		if nextRune == utf8.RuneError {
			return false
		}
		matched, consumed := l.nodes[nodeIndex].Match(l.collation, nextRune)
		if consumed {
			stringIndex += advance
		}
		if matched {
			nodeNextIndex = append(nodeNextIndex, stringIndex)
			nodeIndex++
		} else {
			// If we didn't match on this rune, we backtrack to allow earlier nodes to match more runes
			matched, nodeIndex = l.backtrack(s, nodeIndex, nodeNextIndex)
			if !matched {
				return false
			}
			nodeNextIndex = nodeNextIndex[:nodeIndex]
			stringIndex = nodeNextIndex[nodeIndex-1]
			continue
		}
	}
}

// String returns the string form of this LIKE expression. If an Escape character was provided, it is used instead of
// the default.
func (l LikeMatcher) String() string {
	sb := strings.Builder{}
	for _, node := range l.nodes {
		switch node := node.(type) {
		case likeMatcherRune:
			if node.original == '%' {
				sb.WriteRune(l.escape)
				sb.WriteRune('%')
			} else if node.original == '_' {
				if node.sortOrder != -1 {
					sb.WriteRune(l.escape)
				}
				sb.WriteRune('_')
			} else {
				sb.WriteRune(node.original)
			}
		case likeMatcherAny:
			sb.WriteRune('%')
		}
	}
	return sb.String()
}

// backtrack unwinds the stack until we can find a node that can match the next rune compared to the rune that it last
// matched against. The returned node index is the index to use for the next match.
func (l LikeMatcher) backtrack(s string, nodeIndex int, nodeNextIndex []int) (matched bool, newNodeIndex int) {
	charsetEncoder := l.collation.CharacterSet().Encoder()
	// If the slice doesn't contain an entry for the node, then that node was never matched (and therefore we can't
	// backtrack over it).
	if nodeIndex >= len(nodeNextIndex) {
		nodeIndex = len(nodeNextIndex) - 1
	}
	for ; nodeIndex >= 0; nodeIndex-- {
		stringIndex := nodeNextIndex[nodeIndex]
		nextRune, advance := charsetEncoder.NextRune(s[stringIndex:])
		if nextRune == utf8.RuneError {
			return false, 0
		}
		if l.nodes[nodeIndex].MatchNext(l.collation, nextRune) {
			nodeNextIndex[nodeIndex] = stringIndex + advance
			return true, nodeIndex + 1
		}
	}
	// We exhausted all nodes, no nodes may match further
	return false, 0
}

// likeMatcherNode handles the match characteristics for a particular character from the pattern.
type likeMatcherNode interface {
	// Match returns whether the given rune is matched on the initial match, and also whether this rune is consumed. If
	// not consumed, the same rune will be given to the next node. It is assumed that consuming a rune always matches
	// the rune.
	Match(collation sql.CollationID, r rune) (matched bool, consumed bool)
	// MatchNext returns whether the given rune is matched on a subsequent match. Only the first match may optionally
	// consume a rune, all subsequent matches will consume the rune.
	MatchNext(collation sql.CollationID, r rune) bool
}

// likeMatcherRune matches exactly one rune. If the sort order is negative, then this matches any rune (but still only
// a single rune).
type likeMatcherRune struct {
	original  rune
	sortOrder int32
}

var _ likeMatcherNode = likeMatcherRune{}

// Match implements the interface likeMatcherNode.
func (l likeMatcherRune) Match(collation sql.CollationID, r rune) (matched bool, consumed bool) {
	if l.sortOrder < 0 || collation.Sorter()(r) == l.sortOrder {
		return true, true
	}
	return false, false
}

// MatchNext implements the interface likeMatcherNode. As this only matches a single rune, all subsequent matches will
// fail.
func (l likeMatcherRune) MatchNext(collation sql.CollationID, r rune) bool {
	return false
}

// likeMatcherAny matches any sequence of characters, including the empty sequence.
type likeMatcherAny struct{}

var _ likeMatcherNode = likeMatcherAny{}

// Match implements the interface likeMatcherNode. This node is a reluctant matcher, meaning it attempts to match as few
// runes as possible. As this will always match the empty sequence first, we'll return true on the match, but will not
// consume the given rune.
func (l likeMatcherAny) Match(collation sql.CollationID, r rune) (matched bool, consumed bool) {
	return true, false
}

// MatchNext implements the interface likeMatcherNode.
func (l likeMatcherAny) MatchNext(collation sql.CollationID, r rune) bool {
	return true
}
