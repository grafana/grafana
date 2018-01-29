// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"net/http"
	"unicode/utf8"
)

const (
	KEY_VALUE_PLUGIN_ID_MAX_RUNES = 190
	KEY_VALUE_KEY_MAX_RUNES       = 50
)

type PluginKeyValue struct {
	PluginId string `json:"plugin_id"`
	Key      string `json:"key" db:"PKey"`
	Value    []byte `json:"value" db:"PValue"`
}

func (kv *PluginKeyValue) IsValid() *AppError {
	if len(kv.PluginId) == 0 || utf8.RuneCountInString(kv.PluginId) > KEY_VALUE_PLUGIN_ID_MAX_RUNES {
		return NewAppError("PluginKeyValue.IsValid", "model.plugin_key_value.is_valid.plugin_id.app_error", map[string]interface{}{"Max": KEY_VALUE_KEY_MAX_RUNES, "Min": 0}, "key="+kv.Key, http.StatusBadRequest)
	}

	if len(kv.Key) == 0 || utf8.RuneCountInString(kv.Key) > KEY_VALUE_KEY_MAX_RUNES {
		return NewAppError("PluginKeyValue.IsValid", "model.plugin_key_value.is_valid.key.app_error", map[string]interface{}{"Max": KEY_VALUE_KEY_MAX_RUNES, "Min": 0}, "key="+kv.Key, http.StatusBadRequest)
	}

	return nil
}
