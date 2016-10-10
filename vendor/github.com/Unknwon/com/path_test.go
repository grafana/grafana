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
	"runtime"
	"testing"
)

func TestGetGOPATHs(t *testing.T) {
	var gpsR []string

	if runtime.GOOS != "windows" {
		gpsR = []string{"path/to/gopath1", "path/to/gopath2", "path/to/gopath3"}
		os.Setenv("GOPATH", "path/to/gopath1:path/to/gopath2:path/to/gopath3")
	} else {
		gpsR = []string{"path/to/gopath1", "path/to/gopath2", "path/to/gopath3"}
		os.Setenv("GOPATH", "path\\to\\gopath1;path\\to\\gopath2;path\\to\\gopath3")
	}

	gps := GetGOPATHs()
	if !CompareSliceStr(gps, gpsR) {
		t.Errorf("GetGOPATHs:\n Expect => %s\n Got => %s\n", gpsR, gps)
	}
}

func TestGetSrcPath(t *testing.T) {

}

func TestHomeDir(t *testing.T) {
	_, err := HomeDir()
	if err != nil {
		t.Errorf("HomeDir:\n Expect => %v\n Got => %s\n", nil, err)
	}
}

func BenchmarkGetGOPATHs(b *testing.B) {
	for i := 0; i < b.N; i++ {
		GetGOPATHs()
	}
}

func BenchmarkGetSrcPath(b *testing.B) {
	for i := 0; i < b.N; i++ {
		GetSrcPath("github.com/Unknwon/com")
	}
}

func BenchmarkHomeDir(b *testing.B) {
	for i := 0; i < b.N; i++ {
		HomeDir()
	}
}
