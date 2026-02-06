package flagext

import (
	"flag"
	"time"
)

type FlagSetWithSkip struct {
	*flag.FlagSet
	skip map[string]struct{}
}

func NewFlagSetWithSkip(f *flag.FlagSet, skip []string) *FlagSetWithSkip {
	skipMap := make(map[string]struct{}, len(skip))
	for _, s := range skip {
		skipMap[s] = struct{}{}
	}
	return &FlagSetWithSkip{f, skipMap}
}

func (f *FlagSetWithSkip) ToFlagSet() *flag.FlagSet {
	return f.FlagSet
}

func (f *FlagSetWithSkip) DurationVar(p *time.Duration, name string, value time.Duration, usage string) {
	if _, ok := f.skip[name]; !ok {
		f.FlagSet.DurationVar(p, name, value, usage)
	}
}

func (f *FlagSetWithSkip) StringVar(p *string, name string, value string, usage string) {
	if _, ok := f.skip[name]; !ok {
		f.FlagSet.StringVar(p, name, value, usage)
	}
}

func (f *FlagSetWithSkip) BoolVar(p *bool, name string, value bool, usage string) {
	if _, ok := f.skip[name]; !ok {
		f.FlagSet.BoolVar(p, name, value, usage)
	}
}

func (f *FlagSetWithSkip) IntVar(p *int, name string, value int, usage string) {
	if _, ok := f.skip[name]; !ok {
		f.FlagSet.IntVar(p, name, value, usage)
	}
}

func (f *FlagSetWithSkip) Var(value flag.Value, name string, usage string) {
	if _, ok := f.skip[name]; !ok {
		f.FlagSet.Var(value, name, usage)
	}
}

// TODO: Add more methods as needed.
