// +build windows

package hclog

import (
	"os"

	colorable "github.com/mattn/go-colorable"
	"github.com/mattn/go-isatty"
)

// setColorization will mutate the values of this logger
// to approperately configure colorization options. It provides
// a wrapper to the output stream on Windows systems.
func (l *intLogger) setColorization(opts *LoggerOptions) {
	switch opts.Color {
	case ColorOff:
		return
	case ForceColor:
		fi := l.checkWriterIsFile()
		l.writer.w = colorable.NewColorable(fi)
	case AutoColor:
		fi := l.checkWriterIsFile()
		isUnixTerm := isatty.IsTerminal(os.Stdout.Fd())
		isCygwinTerm := isatty.IsCygwinTerminal(os.Stdout.Fd())
		isTerm := isUnixTerm || isCygwinTerm
		if !isTerm {
			l.writer.color = ColorOff
			return
		}
		l.writer.w = colorable.NewColorable(fi)
	}
}
