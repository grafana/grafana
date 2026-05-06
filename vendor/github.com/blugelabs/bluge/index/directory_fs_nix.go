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

package index

import (
	"os"
	"path/filepath"
)

func (d *FileSystemDirectory) remove(kind string, id uint64) error {
	segmentPath := filepath.Join(d.path, d.fileName(kind, id))
	segmentFile, err := d.openExclusive(segmentPath, os.O_CREATE|os.O_RDWR, d.newFilePerm)
	if err != nil {
		return err
	}
	defer func() {
		_ = segmentFile.Close()
	}()

	return os.Remove(segmentPath)
}
