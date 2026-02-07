// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"os"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/internal/global"
)

// Environment variable names.
const (
	// The time interval (in milliseconds) between the start of two export attempts.
	envInterval = "OTEL_METRIC_EXPORT_INTERVAL"
	// Maximum allowed time (in milliseconds) to export data.
	envTimeout = "OTEL_METRIC_EXPORT_TIMEOUT"
)

// envDuration returns an environment variable's value as duration in milliseconds if it is exists,
// or the defaultValue if the environment variable is not defined or the value is not valid.
func envDuration(key string, defaultValue time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	d, err := strconv.Atoi(v)
	if err != nil {
		global.Error(err, "parse duration", "environment variable", key, "value", v)
		return defaultValue
	}
	if d <= 0 {
		global.Error(errNonPositiveDuration, "non-positive duration", "environment variable", key, "value", v)
		return defaultValue
	}
	return time.Duration(d) * time.Millisecond
}
