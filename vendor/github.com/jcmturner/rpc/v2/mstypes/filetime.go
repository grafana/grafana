// Package mstypes implements representations of Microsoft types
package mstypes

import (
	"time"
)

/*
FILETIME is a windows data structure.
Ref: https://msdn.microsoft.com/en-us/library/windows/desktop/ms724284%28v=vs.85%29.aspx
It contains two parts that are 32bit integers:
	dwLowDateTime
	dwHighDateTime
We need to combine these two into one 64bit integer.
This gives the number of 100 nano second period from January 1, 1601, Coordinated Universal Time (UTC)
*/

const unixEpochDiff = 116444736000000000

// FileTime implements the Microsoft FILETIME type https://msdn.microsoft.com/en-us/library/cc230324.aspx
type FileTime struct {
	LowDateTime  uint32
	HighDateTime uint32
}

// Time return a golang Time type from the FileTime
func (ft FileTime) Time() time.Time {
	ns := (ft.MSEpoch() - unixEpochDiff) * 100
	return time.Unix(0, int64(ns)).UTC()
}

// MSEpoch returns the FileTime as a Microsoft epoch, the number of 100 nano second periods elapsed from January 1, 1601 UTC.
func (ft FileTime) MSEpoch() int64 {
	return (int64(ft.HighDateTime) << 32) + int64(ft.LowDateTime)
}

// Unix returns the FileTime as a Unix time, the number of seconds elapsed since January 1, 1970 UTC.
func (ft FileTime) Unix() int64 {
	return (ft.MSEpoch() - unixEpochDiff) / 10000000
}

// GetFileTime returns a FileTime type from the provided Golang Time type.
func GetFileTime(t time.Time) FileTime {
	ns := t.UnixNano()
	fp := (ns / 100) + unixEpochDiff
	hd := fp >> 32
	ld := fp - (hd << 32)
	return FileTime{
		LowDateTime:  uint32(ld),
		HighDateTime: uint32(hd),
	}
}
