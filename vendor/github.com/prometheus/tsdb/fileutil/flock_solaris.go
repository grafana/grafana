// Copyright 2016 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// +build solaris

package fileutil

import (
	"os"
	"syscall"
)

type unixLock struct {
	f *os.File
}

func (l *unixLock) Release() error {
	if err := l.set(false); err != nil {
		return err
	}
	return l.f.Close()
}

func (l *unixLock) set(lock bool) error {
	flock := syscall.Flock_t{
		Type:   syscall.F_UNLCK,
		Start:  0,
		Len:    0,
		Whence: 1,
	}
	if lock {
		flock.Type = syscall.F_WRLCK
	}
	return syscall.FcntlFlock(l.f.Fd(), syscall.F_SETLK, &flock)
}

func newLock(fileName string) (Releaser, error) {
	f, err := os.OpenFile(fileName, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return nil, err
	}
	l := &unixLock{f}
	err = l.set(true)
	if err != nil {
		f.Close()
		return nil, err
	}
	return l, nil
}
