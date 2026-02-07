package fixedlen

import (
	"strconv"
	"strings"

	"github.com/mithrandie/go-text"
)

type DelimiterPositions []int

func (p DelimiterPositions) Last() int {
	if len(p) < 1 {
		return 0
	}
	return p[len(p)-1]
}

func (p DelimiterPositions) Equal(p2 DelimiterPositions) bool {
	if (p == nil && p2 != nil) || (p != nil && p2 == nil) {
		return false
	}
	if len(p) != len(p2) {
		return false
	}
	for i := 0; i < len(p); i++ {
		if p[i] != p2[i] {
			return false
		}
	}
	return true
}

func (p DelimiterPositions) String() string {
	if p == nil {
		return "SPACES"
	}

	slist := make([]string, 0, len(p))
	for _, v := range p {
		slist = append(slist, strconv.Itoa(v))
	}
	return "[" + strings.Join(slist, ", ") + "]"
}

type Field struct {
	Contents  string
	Alignment text.FieldAlignment
}

func NewField(contents string, alignment text.FieldAlignment) Field {
	return Field{
		Contents:  contents,
		Alignment: alignment,
	}
}
