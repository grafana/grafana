// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	SYSTEM_DIAGNOSTIC_ID        = "DiagnosticId"
	SYSTEM_RAN_UNIT_TESTS       = "RanUnitTests"
	SYSTEM_LAST_SECURITY_TIME   = "LastSecurityTime"
	SYSTEM_ACTIVE_LICENSE_ID    = "ActiveLicenseId"
	SYSTEM_LAST_COMPLIANCE_TIME = "LastComplianceTime"
)

type System struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

func (o *System) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func SystemFromJson(data io.Reader) *System {
	decoder := json.NewDecoder(data)
	var o System
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
