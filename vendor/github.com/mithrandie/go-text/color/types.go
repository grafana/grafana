package color

import (
	"errors"
	"fmt"
	"strings"
)

type EffectCode int

const (
	Reset EffectCode = iota
	Bold
	Faint
	Italic
	Underline
	SlowBlink
	RapidBlink
	ReverseVideo
	Conceal
	CrossedOut
)

var effectCodeLiterals = map[EffectCode]string{
	Reset:        "Reset",
	Bold:         "Bold",
	Faint:        "Faint",
	Italic:       "Italic",
	Underline:    "Underline",
	SlowBlink:    "SlowBlink",
	RapidBlink:   "RapidBlink",
	ReverseVideo: "ReverseVideo",
	Conceal:      "Conceal",
	CrossedOut:   "CrossedOut",
}

func (c EffectCode) String() string {
	if s, ok := effectCodeLiterals[c]; ok {
		return s
	}
	return ""
}

type Code int

const (
	Black Code = iota + 30
	Red
	Green
	Yellow
	Blue
	Magenta
	Cyan
	White
)

const DefaultColor Code = 39

const (
	BrightBlack Code = iota + 90
	BrightRed
	BrightGreen
	BrightYellow
	BrightBlue
	BrightMagenta
	BrightCyan
	BrightWhite
)

var colorCodeLiterals = map[Code]string{
	Black:         "Black",
	Red:           "Red",
	Green:         "Green",
	Yellow:        "Yellow",
	Blue:          "Blue",
	Magenta:       "Magenta",
	Cyan:          "Cyan",
	White:         "White",
	BrightBlack:   "BrightBlack",
	BrightRed:     "BrightRed",
	BrightGreen:   "BrightGreen",
	BrightYellow:  "BrightYellow",
	BrightBlue:    "BrightBlue",
	BrightMagenta: "BrightMagenta",
	BrightCyan:    "BrightCyan",
	BrightWhite:   "BrightWhite",
	DefaultColor:  "DefaultColor",
}

func (c Code) String() string {
	if s, ok := colorCodeLiterals[c]; ok {
		return s
	}
	return ""
}

func ParseEffectCode(s string) (EffectCode, error) {
	switch strings.ToUpper(s) {
	case "RESET":
		return Reset, nil
	case "BOLD":
		return Bold, nil
	case "FAINT":
		return Faint, nil
	case "ITALIC":
		return Italic, nil
	case "UNDERLINE":
		return Underline, nil
	case "SLOWBLINK":
		return SlowBlink, nil
	case "RAPIDBLINK":
		return RapidBlink, nil
	case "REVERSEVIDEO":
		return ReverseVideo, nil
	case "CONCEAL":
		return Conceal, nil
	case "CROSSEDOUT":
		return CrossedOut, nil
	default:
		return -1, errors.New(fmt.Sprintf("%q cannot convert to EffectCode", s))
	}
}

func ParseColorCode(s string) (Code, error) {
	switch strings.ToUpper(s) {
	case "BLACK":
		return Black, nil
	case "RED":
		return Red, nil
	case "GREEN":
		return Green, nil
	case "YELLOW":
		return Yellow, nil
	case "BLUE":
		return Blue, nil
	case "MAGENTA":
		return Magenta, nil
	case "CYAN":
		return Cyan, nil
	case "WHITE":
		return White, nil
	case "BRIGHTBLACK":
		return BrightBlack, nil
	case "BRIGHTRED":
		return BrightRed, nil
	case "BRIGHTGREEN":
		return BrightGreen, nil
	case "BRIGHTYELLOW":
		return BrightYellow, nil
	case "BRIGHTBLUE":
		return BrightBlue, nil
	case "BRIGHTMAGENTA":
		return BrightMagenta, nil
	case "BRIGHTCYAN":
		return BrightCyan, nil
	case "BRIGHTWHITE":
		return BrightWhite, nil
	case "DEFAULTCOLOR":
		return DefaultColor, nil
	default:
		return -1, errors.New(fmt.Sprintf("%q cannot convert to Color Code", s))
	}
}
