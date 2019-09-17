// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.13

package xerrors

import "errors"

// A Formatter formats error messages.
type Formatter = errors.Formatter

// A Printer formats error messages.
//
// The most common implementation of Printer is the one provided by package fmt
// during Printf (as of Go 1.13). Localization packages such as golang.org/x/text/message
// typically provide their own implementations.
type Printer = errors.Printer
