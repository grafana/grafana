// Go MySQL Driver - A MySQL-Driver for Go's database/sql package.
//
// Copyright 2022 The Go-MySQL-Driver Authors. All rights reserved.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at http://mozilla.org/MPL/2.0/.
//go:build go1.19
// +build go1.19

package mysql

import "sync/atomic"

/******************************************************************************
*                               Sync utils                                    *
******************************************************************************/

type atomicBool = atomic.Bool
