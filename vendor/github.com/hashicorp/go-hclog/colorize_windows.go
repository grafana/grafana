// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MIT

//go:build windows
// +build windows

package hclog

import (
	"os"

	colorable "github.com/mattn/go-colorable"
)

// setColorization will mutate the values of this logger
// to appropriately configure colorization options. It provides
// a wrapper to the output stream on Windows systems.
func (l *intLogger) setColorization(opts *LoggerOptions) {
	if opts.Color == ColorOff {
		return
	}

	fi, ok := l.writer.w.(*os.File)
	if !ok {
		l.writer.color = ColorOff
		l.headerColor = ColorOff
		return
	}

	cfi := colorable.NewColorable(fi)

	// NewColorable detects if color is possible and if it's not, then it
	// returns the original value. So we can test if we got the original
	// value back to know if color is possible.
	if cfi == fi {
		l.writer.color = ColorOff
		l.headerColor = ColorOff
	} else {
		l.writer.w = cfi
	}
}
