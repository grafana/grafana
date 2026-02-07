// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package analysis

import (
	"os"

	"github.com/go-openapi/analysis/internal/debug"
)

var debugLog = debug.GetLogger("analysis", os.Getenv("SWAGGER_DEBUG") != "")
