package internalerror

import (
	"fmt"

	"github.com/thomaspoignant/go-feature-flag/ffcontext"
)

type RuleNotApply struct {
	Context ffcontext.Context
}

func (m *RuleNotApply) Error() string {
	return fmt.Sprintf("Rule does not apply for this user %s", m.Context.GetKey())
}
