// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package debug

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
)

var (
	output = os.Stdout
)

// GetLogger provides a prefix debug logger
func GetLogger(prefix string, debug bool) func(string, ...any) {
	if debug {
		logger := log.New(output, prefix+":", log.LstdFlags)

		return func(msg string, args ...any) {
			_, file1, pos1, _ := runtime.Caller(1)
			logger.Printf("%s:%d: %s", filepath.Base(file1), pos1, fmt.Sprintf(msg, args...))
		}
	}

	return func(_ string, _ ...any) {}
}
