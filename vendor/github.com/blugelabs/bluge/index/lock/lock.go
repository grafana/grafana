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

package lock

import (
	"os"
)

type LockedFile interface {
	File() *os.File
	Exclusive() bool
	Close() error
}

type DefaultLockedFile struct {
	f         *os.File
	exclusive bool
}

func OpenExclusive(path string, flag int, perm os.FileMode) (LockedFile, error) {
	return open(path, flag, perm, true)
}

func OpenShared(path string, flag int, perm os.FileMode) (LockedFile, error) {
	return open(path, flag, perm, false)
}

func (e *DefaultLockedFile) File() *os.File {
	return e.f
}

func (e *DefaultLockedFile) Exclusive() bool {
	return e.exclusive
}

func (e *DefaultLockedFile) Close() error {
	err := e.unlock()
	err2 := e.f.Close()
	if err2 != nil && err == nil {
		err = err2
	}
	return err
}
