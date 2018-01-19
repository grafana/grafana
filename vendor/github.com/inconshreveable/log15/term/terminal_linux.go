// Based on ssh/terminal:
// Copyright 2013 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build !appengine

package term

import "syscall"

const ioctlReadTermios = syscall.TCGETS

// Termios functions describe a general terminal interface that is
// provided to control asynchronous communications ports.
type Termios syscall.Termios
