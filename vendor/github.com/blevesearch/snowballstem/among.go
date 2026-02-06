package snowballstem

import "fmt"

type AmongF func(env *Env, ctx interface{}) bool

type Among struct {
	Str string
	A   int32
	B   int32
	F   AmongF
}

func (a *Among) String() string {
	return fmt.Sprintf("str: `%s`, a: %d, b: %d, f: %p", a.Str, a.A, a.B, a.F)
}
