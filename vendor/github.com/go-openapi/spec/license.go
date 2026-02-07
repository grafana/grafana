// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"encoding/json"

	"github.com/go-openapi/swag/jsonutils"
)

// License information for the exposed API.
//
// For more information: http://goo.gl/8us55a#licenseObject
type License struct {
	LicenseProps
	VendorExtensible
}

// LicenseProps holds the properties of a License object
type LicenseProps struct {
	Name string `json:"name,omitempty"`
	URL  string `json:"url,omitempty"`
}

// UnmarshalJSON hydrates License from json
func (l *License) UnmarshalJSON(data []byte) error {
	if err := json.Unmarshal(data, &l.LicenseProps); err != nil {
		return err
	}
	return json.Unmarshal(data, &l.VendorExtensible)
}

// MarshalJSON produces License as json
func (l License) MarshalJSON() ([]byte, error) {
	b1, err := json.Marshal(l.LicenseProps)
	if err != nil {
		return nil, err
	}
	b2, err := json.Marshal(l.VendorExtensible)
	if err != nil {
		return nil, err
	}
	return jsonutils.ConcatJSON(b1, b2), nil
}
