// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
)

var (
	// Debug is true when the SWAGGER_DEBUG env var is not empty.
	// It enables a more verbose logging of validators.
	Debug = os.Getenv("SWAGGER_DEBUG") != ""
	// validateLogger is a debug logger for this package
	validateLogger *log.Logger
)

func init() {
	debugOptions()
}

func debugOptions() {
	validateLogger = log.New(os.Stdout, "validate:", log.LstdFlags)
}

func debugLog(msg string, args ...any) {
	// A private, trivial trace logger, based on go-openapi/spec/expander.go:debugLog()
	if Debug {
		_, file1, pos1, _ := runtime.Caller(1)
		validateLogger.Printf("%s:%d: %s", filepath.Base(file1), pos1, fmt.Sprintf(msg, args...))
	}
}
