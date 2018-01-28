// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

const (
	ACCESS_TOKEN_GRANT_TYPE  = "authorization_code"
	ACCESS_TOKEN_TYPE        = "bearer"
	REFRESH_TOKEN_GRANT_TYPE = "refresh_token"
)

type AccessData struct {
	ClientId     string `json:"client_id"`
	UserId       string `json:"user_id"`
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	RedirectUri  string `json:"redirect_uri"`
	ExpiresAt    int64  `json:"expires_at"`
	Scope        string `json:"scope"`
}

type AccessResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int32  `json:"expires_in"`
	Scope        string `json:"scope"`
	RefreshToken string `json:"refresh_token"`
}

// IsValid validates the AccessData and returns an error if it isn't configured
// correctly.
func (ad *AccessData) IsValid() *AppError {

	if len(ad.ClientId) == 0 || len(ad.ClientId) > 26 {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.client_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ad.UserId) == 0 || len(ad.UserId) > 26 {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ad.Token) != 26 {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.access_token.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ad.RefreshToken) > 26 {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.refresh_token.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ad.RedirectUri) == 0 || len(ad.RedirectUri) > 256 || !IsValidHttpUrl(ad.RedirectUri) {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.redirect_uri.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (me *AccessData) IsExpired() bool {

	if me.ExpiresAt <= 0 {
		return false
	}

	if GetMillis() > me.ExpiresAt {
		return true
	}

	return false
}

func (ad *AccessData) ToJson() string {
	b, err := json.Marshal(ad)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AccessDataFromJson(data io.Reader) *AccessData {
	decoder := json.NewDecoder(data)
	var ad AccessData
	err := decoder.Decode(&ad)
	if err == nil {
		return &ad
	} else {
		return nil
	}
}

func (ar *AccessResponse) ToJson() string {
	b, err := json.Marshal(ar)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AccessResponseFromJson(data io.Reader) *AccessResponse {
	decoder := json.NewDecoder(data)
	var ar AccessResponse
	err := decoder.Decode(&ar)
	if err == nil {
		return &ar
	} else {
		return nil
	}
}
