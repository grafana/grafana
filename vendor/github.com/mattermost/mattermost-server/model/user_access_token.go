// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

type UserAccessToken struct {
	Id          string `json:"id"`
	Token       string `json:"token,omitempty"`
	UserId      string `json:"user_id"`
	Description string `json:"description"`
	IsActive    bool   `json:"is_active"`
}

func (t *UserAccessToken) IsValid() *AppError {
	if len(t.Id) != 26 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(t.Token) != 26 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.token.app_error", nil, "", http.StatusBadRequest)
	}

	if len(t.UserId) != 26 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(t.Description) > 255 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.description.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (t *UserAccessToken) PreSave() {
	t.Id = NewId()
	t.IsActive = true
}

func (t *UserAccessToken) ToJson() string {
	b, err := json.Marshal(t)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UserAccessTokenFromJson(data io.Reader) *UserAccessToken {
	decoder := json.NewDecoder(data)
	var t UserAccessToken
	err := decoder.Decode(&t)
	if err == nil {
		return &t
	} else {
		return nil
	}
}

func UserAccessTokenListToJson(t []*UserAccessToken) string {
	b, err := json.Marshal(t)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UserAccessTokenListFromJson(data io.Reader) []*UserAccessToken {
	decoder := json.NewDecoder(data)
	var t []*UserAccessToken
	err := decoder.Decode(&t)
	if err == nil {
		return t
	} else {
		return nil
	}
}
