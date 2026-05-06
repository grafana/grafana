package doc

import (
	"bufio"
	"bytes"
	"strings"

	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/go-text/color"
)

const DefaultPadding = 1

type Writer struct {
	Flags   *option.Flags
	Palette *color.Palette

	MaxWidth    int
	Padding     int
	Indent      int
	IndentWidth int

	Title1       string
	Title1Effect string
	Title2       string
	Title2Effect string

	buf bytes.Buffer

	subBlock  int
	lineWidth int
	Column    int
}

func NewWriter(screenWidth int, flags *option.Flags, palette *color.Palette) *Writer {
	return &Writer{
		Flags:       flags,
		Palette:     palette,
		MaxWidth:    screenWidth,
		Indent:      0,
		IndentWidth: 4,
		Padding:     DefaultPadding,
		lineWidth:   0,
		Column:      0,
		subBlock:    0,
	}
}

func (w *Writer) Clear() {
	w.Title1 = ""
	w.Title1Effect = ""
	w.Title2 = ""
	w.Title2Effect = ""
	w.lineWidth = 0
	w.Column = 0
	w.subBlock = 0
	w.buf.Reset()
}

func (w *Writer) WriteColorWithoutLineBreak(s string, effect string) {
	w.write(s, effect, true)
}

func (w *Writer) WriteColor(s string, effect string) {
	w.write(s, effect, false)
}

func (w *Writer) write(s string, effect string, withoutLineBreak bool) {
	startOfLine := w.Column < 1

	if startOfLine {
		width := w.LeadingSpacesWidth() + w.subBlock
		w.writeToBuf(strings.Repeat(" ", width))
		w.Column = width
	}

	if !withoutLineBreak && !startOfLine && !w.FitInLine(s) {
		w.NewLine()
		w.write(s, effect, withoutLineBreak)
	} else {
		if w.Palette == nil {
			w.writeToBuf(s)
		} else {
			w.writeToBuf(w.Palette.Render(effect, s))
		}
		w.Column = w.Column + option.TextWidth(s, w.Flags)
	}
}

func (w *Writer) writeToBuf(s string) {
	w.buf.WriteString(s)
}

func (w *Writer) LeadingSpacesWidth() int {
	return w.Padding + (w.Indent * w.IndentWidth)
}

func (w *Writer) FitInLine(s string) bool {
	if w.MaxWidth-(w.Padding*2)-1 < w.Column+option.TextWidth(s, w.Flags) {
		return false
	}
	return true
}

func (w *Writer) WriteWithoutLineBreak(s string) {
	w.WriteColorWithoutLineBreak(s, option.NoEffect)
}

func (w *Writer) Write(s string) {
	w.WriteColor(s, option.NoEffect)
}

func (w *Writer) WriteWithAutoLineBreak(s string) {
	w.writeWithAutoLineBreak(s, false, true)
}

func (w *Writer) WriteWithAutoLineBreakWithContinueMark(s string) {
	w.writeWithAutoLineBreak(s, true, false)
}

func (w *Writer) writeWithAutoLineBreak(s string, useContinueMark bool, useBlock bool) {
	continueMark := ""
	if useContinueMark {
		continueMark = "\\"
	}

	scanner := bufio.NewScanner(strings.NewReader(s))
	firstLine := true
	blockQuote := false
	preformatted := false
	for scanner.Scan() {
		if blockQuote {
			w.EndBlock()
			blockQuote = false
		}

		line := scanner.Text()
		if useBlock && option.TrimSpace(line) == "```" {
			preformatted = !preformatted
			continue
		} else {
			if firstLine {
				firstLine = false
			} else {
				w.NewLine()
			}
		}

		if preformatted {
			w.Write(line)
			continue
		}

		wscanner := bufio.NewScanner(strings.NewReader(line))
		wscanner.Split(bufio.ScanWords)
		lineHead := true

		for wscanner.Scan() {
			word := wscanner.Text()
			if lineHead {
				if useBlock && blockQuote == false && word == ">" {
					blockQuote = true
					w.BeginBlock()
					continue
				}

				lineHead = false
			} else {
				if !w.FitInLine(" " + word + continueMark) {
					w.Write(continueMark)
					w.NewLine()
				} else {
					word = " " + word
				}
			}

			w.Write(word)
		}
	}

	if blockQuote {
		w.EndBlock()
	}
}

func (w *Writer) WriteSpaces(l int) {
	w.Write(strings.Repeat(" ", l))
}

func (w *Writer) NewLine() {
	w.buf.WriteRune('\n')
	if w.lineWidth < w.Column {
		w.lineWidth = w.Column
	}
	w.Column = 0
}

func (w *Writer) BeginBlock() {
	w.Indent++
}

func (w *Writer) EndBlock() {
	w.Indent--
}

func (w *Writer) BeginSubBlock() {
	w.subBlock = w.Column - w.LeadingSpacesWidth()
}

func (w *Writer) EndSubBlock() {
	w.subBlock = 0
}

func (w *Writer) ClearBlock() {
	w.Indent = 0
}

func (w *Writer) String() string {
	var header bytes.Buffer
	if 0 < len(w.Title1) || 0 < len(w.Title2) {
		tw := option.TextWidth(w.Title1, w.Flags) + option.TextWidth(w.Title2, w.Flags)
		if 0 < len(w.Title1) && 0 < len(w.Title2) {
			tw++
		}

		hlLen := tw + 2
		if hlLen < w.lineWidth+1 {
			hlLen = w.lineWidth + 1
		}
		if hlLen < w.Column+1 {
			hlLen = w.Column + 1
		}
		if w.MaxWidth < hlLen {
			hlLen = w.MaxWidth
		}

		if tw < hlLen {
			header.Write(bytes.Repeat([]byte(" "), (hlLen-tw)/2))
		}
		if 0 < len(w.Title1) {
			if w.Palette == nil {
				header.WriteString(w.Title1)
			} else {
				header.WriteString(w.Palette.Render(w.Title1Effect, w.Title1))
			}
		}
		if 0 < len(w.Title2) {
			header.WriteRune(' ')
			if w.Palette == nil {
				header.WriteString(w.Title2)
			} else {
				header.WriteString(w.Palette.Render(w.Title2Effect, w.Title2))
			}
		}
		header.WriteRune('\n')
		header.Write(bytes.Repeat([]byte("-"), hlLen))
		header.WriteRune('\n')
	}

	return header.String() + w.buf.String()
}
