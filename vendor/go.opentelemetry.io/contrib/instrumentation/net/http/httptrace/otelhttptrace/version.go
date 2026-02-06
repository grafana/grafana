// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otelhttptrace // import "go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace"

// Version is the current release version of the httptrace instrumentation.
func Version() string {
	return "0.64.0"
	// This string is updated by the pre_release.sh script during release
}
