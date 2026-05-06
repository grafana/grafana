package flagext

import (
	"flag"
)

type ignoredFlag struct {
	name string
}

func (ignoredFlag) String() string {
	return "ignored"
}

func (d ignoredFlag) Set(string) error {
	return nil
}

// IgnoredFlag ignores set value, without any warning
func IgnoredFlag(f *flag.FlagSet, name, message string) {
	f.Var(ignoredFlag{name}, name, message)
}
