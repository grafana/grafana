// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

const (
	EXPIRED_LICENSE_ERROR = "api.license.add_license.expired.app_error"
	INVALID_LICENSE_ERROR = "api.license.add_license.invalid.app_error"
)

type LicenseRecord struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	Bytes    string `json:"-"`
}

type License struct {
	Id        string    `json:"id"`
	IssuedAt  int64     `json:"issued_at"`
	StartsAt  int64     `json:"starts_at"`
	ExpiresAt int64     `json:"expires_at"`
	Customer  *Customer `json:"customer"`
	Features  *Features `json:"features"`
}

type Customer struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Company     string `json:"company"`
	PhoneNumber string `json:"phone_number"`
}

type Features struct {
	Users                     *int  `json:"users"`
	LDAP                      *bool `json:"ldap"`
	MFA                       *bool `json:"mfa"`
	GoogleOAuth               *bool `json:"google_oauth"`
	Office365OAuth            *bool `json:"office365_oauth"`
	Compliance                *bool `json:"compliance"`
	Cluster                   *bool `json:"cluster"`
	Metrics                   *bool `json:"metrics"`
	CustomBrand               *bool `json:"custom_brand"`
	MHPNS                     *bool `json:"mhpns"`
	SAML                      *bool `json:"saml"`
	PasswordRequirements      *bool `json:"password_requirements"`
	Elasticsearch             *bool `json:"elastic_search"`
	Announcement              *bool `json:"announcement"`
	ThemeManagement           *bool `json:"theme_management"`
	EmailNotificationContents *bool `json:"email_notification_contents"`
	DataRetention             *bool `json:"data_retention"`
	MessageExport             *bool `json:"message_export"`

	// after we enabled more features for webrtc we'll need to control them with this
	FutureFeatures *bool `json:"future_features"`
}

func (f *Features) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"ldap":                        *f.LDAP,
		"mfa":                         *f.MFA,
		"google":                      *f.GoogleOAuth,
		"office365":                   *f.Office365OAuth,
		"compliance":                  *f.Compliance,
		"cluster":                     *f.Cluster,
		"metrics":                     *f.Metrics,
		"custom_brand":                *f.CustomBrand,
		"mhpns":                       *f.MHPNS,
		"saml":                        *f.SAML,
		"password":                    *f.PasswordRequirements,
		"elastic_search":              *f.Elasticsearch,
		"email_notification_contents": *f.EmailNotificationContents,
		"data_retention":              *f.DataRetention,
		"message_export":              *f.MessageExport,
		"future":                      *f.FutureFeatures,
	}
}

func (f *Features) SetDefaults() {
	if f.FutureFeatures == nil {
		f.FutureFeatures = NewBool(true)
	}

	if f.Users == nil {
		f.Users = NewInt(0)
	}

	if f.LDAP == nil {
		f.LDAP = NewBool(*f.FutureFeatures)
	}

	if f.MFA == nil {
		f.MFA = NewBool(*f.FutureFeatures)
	}

	if f.GoogleOAuth == nil {
		f.GoogleOAuth = NewBool(*f.FutureFeatures)
	}

	if f.Office365OAuth == nil {
		f.Office365OAuth = NewBool(*f.FutureFeatures)
	}

	if f.Compliance == nil {
		f.Compliance = NewBool(*f.FutureFeatures)
	}

	if f.Cluster == nil {
		f.Cluster = NewBool(*f.FutureFeatures)
	}

	if f.Metrics == nil {
		f.Metrics = NewBool(*f.FutureFeatures)
	}

	if f.CustomBrand == nil {
		f.CustomBrand = NewBool(*f.FutureFeatures)
	}

	if f.MHPNS == nil {
		f.MHPNS = NewBool(*f.FutureFeatures)
	}

	if f.SAML == nil {
		f.SAML = NewBool(*f.FutureFeatures)
	}

	if f.PasswordRequirements == nil {
		f.PasswordRequirements = NewBool(*f.FutureFeatures)
	}

	if f.Elasticsearch == nil {
		f.Elasticsearch = NewBool(*f.FutureFeatures)
	}

	if f.Announcement == nil {
		f.Announcement = NewBool(true)
	}

	if f.ThemeManagement == nil {
		f.ThemeManagement = NewBool(true)
	}

	if f.EmailNotificationContents == nil {
		f.EmailNotificationContents = NewBool(*f.FutureFeatures)
	}

	if f.DataRetention == nil {
		f.DataRetention = NewBool(*f.FutureFeatures)
	}

	if f.MessageExport == nil {
		f.MessageExport = NewBool(*f.FutureFeatures)
	}
}

func (l *License) IsExpired() bool {
	return l.ExpiresAt < GetMillis()
}

func (l *License) IsStarted() bool {
	return l.StartsAt < GetMillis()
}

func (l *License) ToJson() string {
	b, err := json.Marshal(l)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func LicenseFromJson(data io.Reader) *License {
	decoder := json.NewDecoder(data)
	var o License
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (lr *LicenseRecord) IsValid() *AppError {
	if len(lr.Id) != 26 {
		return NewAppError("LicenseRecord.IsValid", "model.license_record.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if lr.CreateAt == 0 {
		return NewAppError("LicenseRecord.IsValid", "model.license_record.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if len(lr.Bytes) == 0 || len(lr.Bytes) > 10000 {
		return NewAppError("LicenseRecord.IsValid", "model.license_record.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (lr *LicenseRecord) PreSave() {
	lr.CreateAt = GetMillis()
}
