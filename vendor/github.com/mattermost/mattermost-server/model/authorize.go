// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

const (
	AUTHCODE_EXPIRE_TIME   = 60 * 10 // 10 minutes
	AUTHCODE_RESPONSE_TYPE = "code"
	DEFAULT_SCOPE          = "user"
)

type AuthData struct {
	ClientId    string `json:"client_id"`
	UserId      string `json:"user_id"`
	Code        string `json:"code"`
	ExpiresIn   int32  `json:"expires_in"`
	CreateAt    int64  `json:"create_at"`
	RedirectUri string `json:"redirect_uri"`
	State       string `json:"state"`
	Scope       string `json:"scope"`
}

type AuthorizeRequest struct {
	ResponseType string `json:"response_type"`
	ClientId     string `json:"client_id"`
	RedirectUri  string `json:"redirect_uri"`
	Scope        string `json:"scope"`
	State        string `json:"state"`
}

// IsValid validates the AuthData and returns an error if it isn't configured
// correctly.
func (ad *AuthData) IsValid() *AppError {

	if len(ad.ClientId) != 26 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.client_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ad.UserId) != 26 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ad.Code) == 0 || len(ad.Code) > 128 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.auth_code.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	if ad.ExpiresIn == 0 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.expires.app_error", nil, "", http.StatusBadRequest)
	}

	if ad.CreateAt <= 0 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.create_at.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	if len(ad.RedirectUri) == 0 || len(ad.RedirectUri) > 256 || !IsValidHttpUrl(ad.RedirectUri) {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.redirect_uri.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	if len(ad.State) > 128 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.state.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	if len(ad.Scope) > 128 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.scope.app_error", nil, "client_id="+ad.ClientId, http.StatusBadRequest)
	}

	return nil
}

// IsValid validates the AuthorizeRequest and returns an error if it isn't configured
// correctly.
func (ar *AuthorizeRequest) IsValid() *AppError {

	if len(ar.ClientId) != 26 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.client_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ar.ResponseType) == 0 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.response_type.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ar.RedirectUri) == 0 || len(ar.RedirectUri) > 256 || !IsValidHttpUrl(ar.RedirectUri) {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.redirect_uri.app_error", nil, "client_id="+ar.ClientId, http.StatusBadRequest)
	}

	if len(ar.State) > 128 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.state.app_error", nil, "client_id="+ar.ClientId, http.StatusBadRequest)
	}

	if len(ar.Scope) > 128 {
		return NewAppError("AuthData.IsValid", "model.authorize.is_valid.scope.app_error", nil, "client_id="+ar.ClientId, http.StatusBadRequest)
	}

	return nil
}

func (ad *AuthData) PreSave() {
	if ad.ExpiresIn == 0 {
		ad.ExpiresIn = AUTHCODE_EXPIRE_TIME
	}

	if ad.CreateAt == 0 {
		ad.CreateAt = GetMillis()
	}

	if len(ad.Scope) == 0 {
		ad.Scope = DEFAULT_SCOPE
	}
}

func (ad *AuthData) ToJson() string {
	b, err := json.Marshal(ad)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AuthDataFromJson(data io.Reader) *AuthData {
	decoder := json.NewDecoder(data)
	var ad AuthData
	err := decoder.Decode(&ad)
	if err == nil {
		return &ad
	} else {
		return nil
	}
}

func (ar *AuthorizeRequest) ToJson() string {
	b, err := json.Marshal(ar)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AuthorizeRequestFromJson(data io.Reader) *AuthorizeRequest {
	decoder := json.NewDecoder(data)
	var ar AuthorizeRequest
	err := decoder.Decode(&ar)
	if err == nil {
		return &ar
	} else {
		return nil
	}
}

func (ad *AuthData) IsExpired() bool {
	return GetMillis() > ad.CreateAt+int64(ad.ExpiresIn*1000)
}
