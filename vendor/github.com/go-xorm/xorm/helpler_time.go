// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import "time"

const (
	zeroTime0 = "0000-00-00 00:00:00"
	zeroTime1 = "0001-01-01 00:00:00"
)

func formatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

func isTimeZero(t time.Time) bool {
	return t.IsZero() || formatTime(t) == zeroTime0 ||
		formatTime(t) == zeroTime1
}
