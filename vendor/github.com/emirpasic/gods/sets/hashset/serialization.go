// Copyright (c) 2015, Emir Pasic. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package hashset

import (
	"encoding/json"
	"github.com/emirpasic/gods/containers"
)

// Assert Serialization implementation
var _ containers.JSONSerializer = (*Set)(nil)
var _ containers.JSONDeserializer = (*Set)(nil)

// ToJSON outputs the JSON representation of the set.
func (set *Set) ToJSON() ([]byte, error) {
	return json.Marshal(set.Values())
}

// FromJSON populates the set from the input JSON representation.
func (set *Set) FromJSON(data []byte) error {
	elements := []interface{}{}
	err := json.Unmarshal(data, &elements)
	if err == nil {
		set.Clear()
		set.Add(elements...)
	}
	return err
}

// UnmarshalJSON @implements json.Unmarshaler
func (set *Set) UnmarshalJSON(bytes []byte) error {
	return set.FromJSON(bytes)
}

// MarshalJSON @implements json.Marshaler
func (set *Set) MarshalJSON() ([]byte, error) {
	return set.ToJSON()
}
