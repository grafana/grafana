// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

//go:build go1.20
// +build go1.20

package retryablehttp

import "crypto/tls"

func isCertError(err error) bool {
	_, ok := err.(*tls.CertificateVerificationError)
	return ok
}
