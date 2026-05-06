package json

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/color"
)

func NewJsonPalette() *color.Palette {
	objKey := color.NewEffector()
	objKey.SetEffect(color.Bold)
	objKey.SetFGColor(color.Blue)

	str := color.NewEffector()
	str.SetFGColor(color.Green)

	num := color.NewEffector()
	num.SetFGColor(color.Magenta)

	b := color.NewEffector()
	b.SetFGColor(color.Yellow)
	b.SetEffect(color.Bold)

	n := color.NewEffector()
	n.SetFGColor(color.BrightBlack)

	p := color.NewPalette()
	p.SetEffector(ObjectKeyEffect, objKey)
	p.SetEffector(StringEffect, str)
	p.SetEffector(NumberEffect, num)
	p.SetEffector(BooleanEffect, b)
	p.SetEffector(NullEffect, n)

	return p
}

type NanInfHandling int8

const (
	ConvertToNull NanInfHandling = iota
	CreateError
	ConvertToStringNotation
)

type FloatFormat int8

const (
	NoExponent FloatFormat = iota
	ENotationForLargeExponents
)

type UnsupportedValueError struct {
	Value string
}

func (e UnsupportedValueError) Error() string {
	return fmt.Sprintf("%s is not supported", e.Value)
}

func NewUnsupportedValueError(value string) *UnsupportedValueError {
	return &UnsupportedValueError{
		Value: value,
	}
}

type Encoder struct {
	EscapeType     EscapeType
	PrettyPrint    bool
	NanInfHandling NanInfHandling
	FloatFormat    FloatFormat
	LineBreak      text.LineBreak
	IndentSpaces   int
	Palette        *color.Palette

	nameSeparator string
	lineBreak     string

	decoder *Decoder
}

func NewEncoder() *Encoder {
	return &Encoder{
		EscapeType:     Backslash,
		PrettyPrint:    false,
		NanInfHandling: ConvertToNull,
		FloatFormat:    NoExponent,
		LineBreak:      text.LF,
		IndentSpaces:   2,
		Palette:        nil,
		nameSeparator:  string(NameSeparator),
		decoder:        NewDecoder(),
	}
}

func (e *Encoder) Encode(structure Structure) (string, error) {
	if e.PrettyPrint {
		e.lineBreak = e.LineBreak.Value()
		e.nameSeparator = string(NameSeparator) + " "
		if e.Palette != nil {
			e.Palette.Enable()
		}
	} else {
		e.lineBreak = ""
		e.nameSeparator = string(NameSeparator)
		if e.Palette != nil {
			e.Palette.Disable()
		}
	}

	return e.encodeStructure(structure, 0)
}

func (e *Encoder) encodeStructure(structure Structure, depth int) (string, error) {
	var indent string
	var elementIndent string
	if e.PrettyPrint {
		indent = strings.Repeat(" ", e.IndentSpaces*depth)
		elementIndent = strings.Repeat(" ", e.IndentSpaces*(depth+1))
	}

	var encoded string

	switch v := structure.(type) {
	case Object:
		strs := make([]string, 0, v.Len())
		for _, member := range v.Members {
			s, err := e.encodeStructure(member.Value, depth+1)
			if err != nil {
				return encoded, err
			}
			strs = append(
				strs,
				elementIndent+
					e.effect(ObjectKeyEffect, e.formatString(member.Key))+
					e.nameSeparator+
					s,
			)
		}
		encoded = string(BeginObject) +
			e.lineBreak +
			strings.Join(strs[:], string(ValueSeparator)+e.lineBreak) +
			e.lineBreak +
			indent + string(EndObject)
	case Array:
		strs := make([]string, 0, len(v))
		for _, v := range v {
			s, err := e.encodeStructure(v, depth+1)
			if err != nil {
				return encoded, err
			}
			strs = append(strs, elementIndent+s)
		}
		if len(strs) < 1 {
			encoded = string(BeginArray) + string(EndArray)
		} else {
			encoded = string(BeginArray) +
				e.lineBreak +
				strings.Join(strs[:], string(ValueSeparator)+e.lineBreak) +
				e.lineBreak +
				indent + string(EndArray)
		}
	case Number:
		switch e.NanInfHandling {
		case CreateError:
			if v.IsNaN() || v.IsInf() {
				return encoded, NewUnsupportedValueError(e.formatFloat(v.Raw()))
			}
			encoded = e.effect(NumberEffect, e.formatFloat(v.Raw()))
		case ConvertToStringNotation:
			encoded = e.effect(NumberEffect, e.formatFloat(v.Raw()))
		default:
			if v.IsNaN() || v.IsInf() {
				encoded = e.effect(NullEffect, NullValue)
			} else {
				encoded = e.effect(NumberEffect, e.formatFloat(v.Raw()))
			}
		}
	case Integer:
		encoded = e.effect(NumberEffect, structure.Encode())
	case String:
		str := v.Raw()
		if 0 < len(str) {
			if decoded, _, err := e.decoder.Decode(str); err == nil && isComplexType(decoded) {
				s, err := e.encodeStructure(decoded, depth)
				if err != nil {
					return encoded, err
				}
				encoded = s
			} else {
				encoded = e.effect(StringEffect, e.formatString(str))
			}
		} else {
			encoded = e.effect(StringEffect, e.formatString(str))
		}
	case Boolean:
		encoded = e.effect(BooleanEffect, structure.Encode())
	case Null:
		encoded = e.effect(NullEffect, structure.Encode())
	}

	return encoded, nil
}

func (e *Encoder) formatString(s string) string {
	var escaped string

	switch e.EscapeType {
	case AllWithHexDigits:
		escaped = EscapeAll(s)
	case HexDigits:
		escaped = EscapeWithHexDigits(s)
	default:
		escaped = Escape(s)
	}

	return string(QuotationMark) + escaped + string(QuotationMark)
}

func (e *Encoder) formatFloat(f float64) string {
	switch e.FloatFormat {
	case ENotationForLargeExponents:
		return strconv.FormatFloat(f, 'g', -1, 64)
	default:
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
}

func (e *Encoder) effect(key string, s string) string {
	if e.Palette == nil {
		return s
	}
	return e.Palette.Render(key, s)
}

func isComplexType(s Structure) bool {
	return isObject(s) || isArray(s)
}

func isObject(s Structure) bool {
	_, ok := s.(Object)
	return ok
}

func isArray(s Structure) bool {
	_, ok := s.(Array)
	return ok
}
