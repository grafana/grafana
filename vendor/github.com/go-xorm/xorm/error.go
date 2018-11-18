// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
)

var (
	// ErrParamsType params error
	ErrParamsType = errors.New("Params type error")
	// ErrTableNotFound table not found error
	ErrTableNotFound = errors.New("Not found table")
	// ErrUnSupportedType unsupported error
	ErrUnSupportedType = errors.New("Unsupported type error")
	// ErrNotExist record is not exist error
	ErrNotExist = errors.New("Not exist error")
	// ErrCacheFailed cache failed error
	ErrCacheFailed = errors.New("Cache failed")
	// ErrNeedDeletedCond delete needs less one condition error
	ErrNeedDeletedCond = errors.New("Delete need at least one condition")
	// ErrNotImplemented not implemented
	ErrNotImplemented = errors.New("Not implemented")
	// ErrConditionType condition type unsupported
	ErrConditionType = errors.New("Unsupported conditon type")
)
