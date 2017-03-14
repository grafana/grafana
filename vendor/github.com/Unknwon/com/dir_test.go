// Copyright 2013 com authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package com

import (
	"os"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestIsDir(t *testing.T) {
	Convey("Check if given path is a directory", t, func() {
		Convey("Pass a file name", func() {
			So(IsDir("file.go"), ShouldEqual, false)
		})
		Convey("Pass a directory name", func() {
			So(IsDir("testdata"), ShouldEqual, true)
		})
		Convey("Pass a invalid path", func() {
			So(IsDir("foo"), ShouldEqual, false)
		})
	})
}

func TestCopyDir(t *testing.T) {
	Convey("Items of two slices should be same", t, func() {
		s1, err := StatDir("testdata", true)
		So(err, ShouldEqual, nil)

		err = CopyDir("testdata", "testdata2")
		So(err, ShouldEqual, nil)

		s2, err := StatDir("testdata2", true)
		os.RemoveAll("testdata2")
		So(err, ShouldEqual, nil)

		So(CompareSliceStr(s1, s2), ShouldEqual, true)
	})
}

func BenchmarkIsDir(b *testing.B) {
	for i := 0; i < b.N; i++ {
		IsDir("file.go")
	}
}
