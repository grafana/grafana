// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MIT

//go:build !windows
// +build !windows

package hclog

import (
	"github.com/mattn/go-isatty"
)

// hasFD is used to check if the writer has an Fd value to check
// if it's a terminal.
type hasFD interface {
	Fd() uintptr
}

// setColorization will mutate the values of this logger
// to appropriately configure colorization options. It provides
// a wrapper to the output stream on Windows systems.
func (l *intLogger) setColorization(opts *LoggerOptions) {
	if opts.Color != AutoColor {
		return
	}

	if sc, ok := l.writer.w.(SupportsColor); ok {
		if !sc.SupportsColor() {
			l.headerColor = ColorOff
			l.writer.color = ColorOff
		}
		return
	}

	fi, ok := l.writer.w.(hasFD)
	if !ok {
		return
	}

	if !isatty.IsTerminal(fi.Fd()) {
		l.headerColor = ColorOff
		l.writer.color = ColorOff
	}
}
