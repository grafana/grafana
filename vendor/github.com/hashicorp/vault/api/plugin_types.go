// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

// NOTE: this file was copied from
// https://github.com/hashicorp/vault/blob/main/sdk/helper/consts/plugin_types.go
// Any changes made should be made to both files at the same time.

import (
	"encoding/json"
	"fmt"
)

var PluginTypes = []PluginType{
	PluginTypeUnknown,
	PluginTypeCredential,
	PluginTypeDatabase,
	PluginTypeSecrets,
}

type PluginType uint32

// This is a list of PluginTypes used by Vault.
// If we need to add any in the future, it would
// be best to add them to the _end_ of the list below
// because they resolve to incrementing numbers,
// which may be saved in state somewhere. Thus if
// the name for one of those numbers changed because
// a value were added to the middle, that could cause
// the wrong plugin types to be read from storage
// for a given underlying number. Example of the problem
// here: https://play.golang.org/p/YAaPw5ww3er
const (
	PluginTypeUnknown PluginType = iota
	PluginTypeCredential
	PluginTypeDatabase
	PluginTypeSecrets
)

func (p PluginType) String() string {
	switch p {
	case PluginTypeUnknown:
		return "unknown"
	case PluginTypeCredential:
		return "auth"
	case PluginTypeDatabase:
		return "database"
	case PluginTypeSecrets:
		return "secret"
	default:
		return "unsupported"
	}
}

func ParsePluginType(pluginType string) (PluginType, error) {
	switch pluginType {
	case "unknown":
		return PluginTypeUnknown, nil
	case "auth":
		return PluginTypeCredential, nil
	case "database":
		return PluginTypeDatabase, nil
	case "secret":
		return PluginTypeSecrets, nil
	default:
		return PluginTypeUnknown, fmt.Errorf("%q is not a supported plugin type", pluginType)
	}
}

// UnmarshalJSON implements json.Unmarshaler. It supports unmarshaling either a
// string or a uint32. All new serialization will be as a string, but we
// previously serialized as a uint32 so we need to support that for backwards
// compatibility.
func (p *PluginType) UnmarshalJSON(data []byte) error {
	var asString string
	err := json.Unmarshal(data, &asString)
	if err == nil {
		*p, err = ParsePluginType(asString)
		return err
	}

	var asUint32 uint32
	err = json.Unmarshal(data, &asUint32)
	if err != nil {
		return err
	}
	*p = PluginType(asUint32)
	switch *p {
	case PluginTypeUnknown, PluginTypeCredential, PluginTypeDatabase, PluginTypeSecrets:
		return nil
	default:
		return fmt.Errorf("%d is not a supported plugin type", asUint32)
	}
}

// MarshalJSON implements json.Marshaler.
func (p PluginType) MarshalJSON() ([]byte, error) {
	return json.Marshal(p.String())
}
