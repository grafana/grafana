// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"encoding/json"

	"github.com/go-openapi/swag/jsonutils"
)

// ContactInfo contact information for the exposed API.
//
// For more information: http://goo.gl/8us55a#contactObject
type ContactInfo struct {
	ContactInfoProps
	VendorExtensible
}

// ContactInfoProps hold the properties of a ContactInfo object
type ContactInfoProps struct {
	Name  string `json:"name,omitempty"`
	URL   string `json:"url,omitempty"`
	Email string `json:"email,omitempty"`
}

// UnmarshalJSON hydrates ContactInfo from json
func (c *ContactInfo) UnmarshalJSON(data []byte) error {
	if err := json.Unmarshal(data, &c.ContactInfoProps); err != nil {
		return err
	}
	return json.Unmarshal(data, &c.VendorExtensible)
}

// MarshalJSON produces ContactInfo as json
func (c ContactInfo) MarshalJSON() ([]byte, error) {
	b1, err := json.Marshal(c.ContactInfoProps)
	if err != nil {
		return nil, err
	}
	b2, err := json.Marshal(c.VendorExtensible)
	if err != nil {
		return nil, err
	}
	return jsonutils.ConcatJSON(b1, b2), nil
}
