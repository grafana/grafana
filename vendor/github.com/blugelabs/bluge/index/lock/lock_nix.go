//  Copyright (c) 2020 The Bluge Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build darwin || dragonfly || freebsd || linux || netbsd || openbsd
// +build darwin dragonfly freebsd linux netbsd openbsd

package lock

import (
	"os"

	"golang.org/x/sys/unix"
)

func open(path string, flag int, perm os.FileMode, exclusive bool) (LockedFile, error) {
	f, err := os.OpenFile(path, flag, perm)
	if err != nil {
		return nil, err
	}
	how := unix.LOCK_SH | unix.LOCK_NB
	if exclusive {
		how = unix.LOCK_EX | unix.LOCK_NB
	}
	err = unix.Flock(int(f.Fd()), how)
	if err != nil {
		_ = f.Close()
		return nil, err
	}
	return &DefaultLockedFile{
		f:         f,
		exclusive: exclusive,
	}, nil
}

func (e *DefaultLockedFile) unlock() error {
	return nil
}
