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

package fileutil

import "syscall"

type windowsLock struct {
	fd syscall.Handle
}

func (fl *windowsLock) Release() error {
	return syscall.Close(fl.fd)
}

func newLock(fileName string) (Releaser, error) {
	pathp, err := syscall.UTF16PtrFromString(fileName)
	if err != nil {
		return nil, err
	}
	fd, err := syscall.CreateFile(pathp, syscall.GENERIC_READ|syscall.GENERIC_WRITE, 0, nil, syscall.CREATE_ALWAYS, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return nil, err
	}
	return &windowsLock{fd}, nil
}
