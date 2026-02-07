// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package errors

import (
	"bytes"
	"fmt"
	"strings"
)

// APIVerificationFailed is an error that contains all the missing info for a mismatched section
// between the api registrations and the api spec
type APIVerificationFailed struct { //nolint: errname
	Section              string   `json:"section,omitempty"`
	MissingSpecification []string `json:"missingSpecification,omitempty"`
	MissingRegistration  []string `json:"missingRegistration,omitempty"`
}

func (v *APIVerificationFailed) Error() string {
	buf := bytes.NewBuffer(nil)

	hasRegMissing := len(v.MissingRegistration) > 0
	hasSpecMissing := len(v.MissingSpecification) > 0

	if hasRegMissing {
		fmt.Fprintf(buf, "missing [%s] %s registrations", strings.Join(v.MissingRegistration, ", "), v.Section)
	}

	if hasRegMissing && hasSpecMissing {
		buf.WriteString("\n")
	}

	if hasSpecMissing {
		fmt.Fprintf(buf, "missing from spec file [%s] %s", strings.Join(v.MissingSpecification, ", "), v.Section)
	}

	return buf.String()
}
