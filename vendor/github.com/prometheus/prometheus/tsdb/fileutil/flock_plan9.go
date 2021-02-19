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

import "os"

type plan9Lock struct {
	f *os.File
}

func (l *plan9Lock) Release() error {
	return l.f.Close()
}

func newLock(fileName string) (Releaser, error) {
	f, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, os.ModeExclusive|0666)
	if err != nil {
		return nil, err
	}
	return &plan9Lock{f}, nil
}
