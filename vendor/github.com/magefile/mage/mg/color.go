package mg

// Color is ANSI color type
type Color int

// If you add/change/remove any items in this constant,
// you will need to run "stringer -type=Color" in this directory again.
// NOTE: Please keep the list in an alphabetical order.
const (
	Black Color = iota
	Red
	Green
	Yellow
	Blue
	Magenta
	Cyan
	White
	BrightBlack
	BrightRed
	BrightGreen
	BrightYellow
	BrightBlue
	BrightMagenta
	BrightCyan
	BrightWhite
)

// AnsiColor are ANSI color codes for supported terminal colors.
var ansiColor = map[Color]string{
	Black:         "\u001b[30m",
	Red:           "\u001b[31m",
	Green:         "\u001b[32m",
	Yellow:        "\u001b[33m",
	Blue:          "\u001b[34m",
	Magenta:       "\u001b[35m",
	Cyan:          "\u001b[36m",
	White:         "\u001b[37m",
	BrightBlack:   "\u001b[30;1m",
	BrightRed:     "\u001b[31;1m",
	BrightGreen:   "\u001b[32;1m",
	BrightYellow:  "\u001b[33;1m",
	BrightBlue:    "\u001b[34;1m",
	BrightMagenta: "\u001b[35;1m",
	BrightCyan:    "\u001b[36;1m",
	BrightWhite:   "\u001b[37;1m",
}

// AnsiColorReset is an ANSI color code to reset the terminal color.
const AnsiColorReset = "\033[0m"

// DefaultTargetAnsiColor is a default ANSI color for colorizing targets.
// It is set to Cyan as an arbitrary color, because it has a neutral meaning
var DefaultTargetAnsiColor = ansiColor[Cyan]

func toLowerCase(s string) string {
	// this is a naive implementation
	// borrowed from https://golang.org/src/strings/strings.go
	// and only considers alphabetical characters [a-zA-Z]
	// so that we don't depend on the "strings" package
	buf := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if 'A' <= c && c <= 'Z' {
			c += 'a' - 'A'
		}
		buf[i] = c
	}
	return string(buf)
}

func getAnsiColor(color string) (string, bool) {
	colorLower := toLowerCase(color)
	for k, v := range ansiColor {
		colorConstLower := toLowerCase(k.String())
		if colorConstLower == colorLower {
			return v, true
		}
	}
	return "", false
}
