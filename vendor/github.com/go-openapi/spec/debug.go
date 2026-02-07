// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"fmt"
	"log"
	"os"
	"path"
	"runtime"
)

// Debug is true when the SWAGGER_DEBUG env var is not empty.
//
// It enables a more verbose logging of this package.
var Debug = os.Getenv("SWAGGER_DEBUG") != ""

var (
	// specLogger is a debug logger for this package
	specLogger *log.Logger
)

func init() {
	debugOptions()
}

func debugOptions() {
	specLogger = log.New(os.Stdout, "spec:", log.LstdFlags)
}

func debugLog(msg string, args ...any) {
	// A private, trivial trace logger, based on go-openapi/spec/expander.go:debugLog()
	if Debug {
		_, file1, pos1, _ := runtime.Caller(1)
		specLogger.Printf("%s:%d: %s", path.Base(file1), pos1, fmt.Sprintf(msg, args...))
	}
}
