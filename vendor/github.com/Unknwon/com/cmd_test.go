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
	"fmt"
	"runtime"
	"strings"
	"testing"
)

func TestColorLogS(t *testing.T) {
	if runtime.GOOS != "windows" {
		// Trace + path.
		cls := ColorLogS("[TRAC] Trace level test with path( %s )", "/path/to/somethere")
		clsR := fmt.Sprintf(
			"[\033[%dmTRAC%s] Trace level test with path(\033[%dm%s%s)",
			Blue, EndColor, Yellow, "/path/to/somethere", EndColor)
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}

		// Error + error.
		cls = ColorLogS("[ERRO] Error level test with error[ %s ]", "test error")
		clsR = fmt.Sprintf(
			"[\033[%dmERRO%s] Error level test with error[\033[%dm%s%s]",
			Red, EndColor, Red, "test error", EndColor)
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}

		// Warning + highlight.
		cls = ColorLogS("[WARN] Warnning level test with highlight # %s #", "special offer!")
		clsR = fmt.Sprintf(
			"[\033[%dmWARN%s] Warnning level test with highlight \033[%dm%s%s",
			Magenta, EndColor, Gray, "special offer!", EndColor)
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}

		// Success.
		cls = ColorLogS("[SUCC] Success level test")
		clsR = fmt.Sprintf(
			"[\033[%dmSUCC%s] Success level test",
			Green, EndColor)
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}

		// Default.
		cls = ColorLogS("[INFO] Default level test")
		clsR = fmt.Sprintf(
			"[INFO] Default level test")
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}
	} else {
		// Trace + path.
		cls := ColorLogS("[TRAC] Trace level test with path( %s )", "/path/to/somethere")
		clsR := fmt.Sprintf(
			"[TRAC] Trace level test with path(%s)",
			"/path/to/somethere")
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}

		// Error + error.
		cls = ColorLogS("[ERRO] Error level test with error[ %s ]", "test error")
		clsR = fmt.Sprintf(
			"[ERRO] Error level test with error[%s]",
			"test error")
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}

		// Warning + highlight.
		cls = ColorLogS("[WARN] Warnning level test with highlight # %s #", "special offer!")
		clsR = fmt.Sprintf(
			"[WARN] Warnning level test with highlight %s",
			"special offer!")
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}

		// Success.
		cls = ColorLogS("[SUCC] Success level test")
		clsR = fmt.Sprintf(
			"[SUCC] Success level test")
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}

		// Default.
		cls = ColorLogS("[INFO] Default level test")
		clsR = fmt.Sprintf(
			"[INFO] Default level test")
		if cls != clsR {
			t.Errorf("ColorLogS:\n Expect => %s\n Got => %s\n", clsR, cls)
		}
	}
}

func TestExecCmd(t *testing.T) {
	stdout, stderr, err := ExecCmd("go", "help", "get")
	if err != nil {
		t.Errorf("ExecCmd:\n Expect => %v\n Got => %v\n", nil, err)
	} else if len(stderr) != 0 {
		t.Errorf("ExecCmd:\n Expect => %s\n Got => %s\n", "", stderr)
	} else if !strings.HasPrefix(stdout, "usage: go get") {
		t.Errorf("ExecCmd:\n Expect => %s\n Got => %s\n", "usage: go get", stdout)
	}
}

func BenchmarkColorLogS(b *testing.B) {
	log := fmt.Sprintf(
		"[WARN] This is a tesing log that should be colored, path( %s ),"+
			" highlight # %s #, error [ %s ].",
		"path to somewhere", "highlighted content", "tesing error")
	for i := 0; i < b.N; i++ {
		ColorLogS(log)
	}
}

func BenchmarkExecCmd(b *testing.B) {
	for i := 0; i < b.N; i++ {
		ExecCmd("go", "help", "get")
	}
}
