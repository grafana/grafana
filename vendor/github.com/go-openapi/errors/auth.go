// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package errors

import "net/http"

// Unauthenticated returns an unauthenticated error
func Unauthenticated(scheme string) Error {
	return New(http.StatusUnauthorized, "unauthenticated for %s", scheme)
}
