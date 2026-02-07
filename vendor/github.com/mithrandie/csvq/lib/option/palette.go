package option

import (
	"errors"
	"fmt"

	"github.com/mithrandie/go-text/color"
)

const (
	NoEffect         = ""
	LableEffect      = "label"
	NumberEffect     = "number"
	StringEffect     = "string"
	BooleanEffect    = "boolean"
	TernaryEffect    = "ternary"
	DatetimeEffect   = "datetime"
	NullEffect       = "null"
	ObjectEffect     = "object"
	AttributeEffect  = "attribute"
	IdentifierEffect = "identifier"
	ValueEffect      = "value"
	EmphasisEffect   = "emphasis"
	PromptEffect     = "prompt"
	ErrorEffect      = "error"
	WarnEffect       = "warn"
	NoticeEffect     = "notice"
)

func NewPalette(env *Environment) (*color.Palette, error) {
	p, err := color.GeneratePalette(env.Palette)
	if err != nil {
		err = errors.New(fmt.Sprintf("palette configuration error: %s", err.Error()))
	}
	return p, err
}
