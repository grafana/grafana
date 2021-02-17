// +build !windows

package hclog

import (
	"github.com/mattn/go-isatty"
)

// setColorization will mutate the values of this logger
// to approperately configure colorization options. It provides
// a wrapper to the output stream on Windows systems.
func (l *intLogger) setColorization(opts *LoggerOptions) {
	switch opts.Color {
	case ColorOff:
		fallthrough
	case ForceColor:
		return
	case AutoColor:
		fi := l.checkWriterIsFile()
		isUnixTerm := isatty.IsTerminal(fi.Fd())
		isCygwinTerm := isatty.IsCygwinTerminal(fi.Fd())
		isTerm := isUnixTerm || isCygwinTerm
		if !isTerm {
			l.writer.color = ColorOff
		}
	}
}
