package dsl

import (
	"github.com/quasilyte/go-ruleguard/dsl/types"
)

type DoContext struct{}

func (*DoContext) Var(varname string) *DoVar { return nil }

func (*DoContext) SetReport(report string) {}

func (*DoContext) SetSuggest(suggest string) {}

type DoVar struct{}

func (*DoVar) Text() string { return "" }

func (*DoVar) Type() types.Type { return nil }
