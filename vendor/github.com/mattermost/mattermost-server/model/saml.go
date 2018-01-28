// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	USER_AUTH_SERVICE_SAML      = "saml"
	USER_AUTH_SERVICE_SAML_TEXT = "With SAML"
	SAML_IDP_CERTIFICATE        = 1
	SAML_PRIVATE_KEY            = 2
	SAML_PUBLIC_CERT            = 3
)

type SamlAuthRequest struct {
	Base64AuthRequest string
	URL               string
	RelayState        string
}

type SamlCertificateStatus struct {
	IdpCertificateFile    bool `json:"idp_certificate_file"`
	PrivateKeyFile        bool `json:"private_key_file"`
	PublicCertificateFile bool `json:"public_certificate_file"`
}

func (s *SamlCertificateStatus) ToJson() string {
	b, err := json.Marshal(s)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func SamlCertificateStatusFromJson(data io.Reader) *SamlCertificateStatus {
	decoder := json.NewDecoder(data)
	var status SamlCertificateStatus
	err := decoder.Decode(&status)
	if err == nil {
		return &status
	} else {
		return nil
	}
}
