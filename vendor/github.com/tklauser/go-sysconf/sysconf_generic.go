// Copyright 2021 Tobias Klauser. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build darwin || dragonfly || freebsd || linux || netbsd || openbsd

package sysconf

import "os"

func sysconfGeneric(name int) (int64, error) {
	// POSIX default values
	if sc, err := sysconfPOSIX(name); err == nil {
		return sc, nil
	}

	switch name {
	case SC_BC_BASE_MAX:
		return _BC_BASE_MAX, nil
	case SC_BC_DIM_MAX:
		return _BC_DIM_MAX, nil
	case SC_BC_SCALE_MAX:
		return _BC_SCALE_MAX, nil
	case SC_BC_STRING_MAX:
		return _BC_STRING_MAX, nil
	case SC_COLL_WEIGHTS_MAX:
		return _COLL_WEIGHTS_MAX, nil
	case SC_EXPR_NEST_MAX:
		return _EXPR_NEST_MAX, nil
	case SC_HOST_NAME_MAX:
		return _HOST_NAME_MAX, nil
	case SC_LINE_MAX:
		return _LINE_MAX, nil
	case SC_LOGIN_NAME_MAX:
		return _LOGIN_NAME_MAX, nil
	case SC_PAGESIZE: // same as SC_PAGE_SIZE
		return int64(os.Getpagesize()), nil
	case SC_RE_DUP_MAX:
		return _RE_DUP_MAX, nil
	case SC_SYMLOOP_MAX:
		return _SYMLOOP_MAX, nil
	}

	return -1, errInvalid
}
