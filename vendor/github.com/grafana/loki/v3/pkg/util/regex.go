package util

import "github.com/grafana/regexp/syntax"

func IsCaseInsensitive(reg *syntax.Regexp) bool {
	return (reg.Flags & syntax.FoldCase) != 0
}

// AllNonGreedy turns greedy quantifiers such as `.*` and `.+` into non-greedy ones. This is the same effect as writing
// `.*?` and `.+?`. This is only safe because we use `Match`. If we were to find the exact position and length of the match
// we would not be allowed to make this optimization. `Match` can return quicker because it is not looking for the longest match.
// Prepending the expression with `(?U)` or passing `NonGreedy` to the expression compiler is not enough since it will
// just negate `.*` and `.*?`.
func AllNonGreedy(regs ...*syntax.Regexp) {
	ClearCapture(regs...)
	for _, re := range regs {
		switch re.Op {
		case syntax.OpCapture, syntax.OpConcat, syntax.OpAlternate:
			AllNonGreedy(re.Sub...)
		case syntax.OpStar, syntax.OpPlus:
			re.Flags = re.Flags | syntax.NonGreedy
		default:
			continue
		}
	}
}

// ClearCapture removes capture operation as they are not used for filtering.
func ClearCapture(regs ...*syntax.Regexp) {
	for _, r := range regs {
		if r.Op == syntax.OpCapture {
			*r = *r.Sub[0]
		}
	}
}
