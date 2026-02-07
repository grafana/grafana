// Copyright 2018 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"encoding/json"
)

// Event represents a GitHub event.
type Event struct {
	Type       *string          `json:"type,omitempty"`
	Public     *bool            `json:"public,omitempty"`
	RawPayload *json.RawMessage `json:"payload,omitempty"`
	Repo       *Repository      `json:"repo,omitempty"`
	Actor      *User            `json:"actor,omitempty"`
	Org        *Organization    `json:"org,omitempty"`
	CreatedAt  *Timestamp       `json:"created_at,omitempty"`
	ID         *string          `json:"id,omitempty"`
}

func (e Event) String() string {
	return Stringify(e)
}

// ParsePayload parses the event payload. For recognized event types,
// a value of the corresponding struct type will be returned.
func (e *Event) ParsePayload() (any, error) {
	// It would be nice if e.Type were the snake_case name of the event,
	// but the existing interface uses the struct name instead.
	payload := EventForType(typeToMessageMapping[e.GetType()])

	if err := json.Unmarshal(e.GetRawPayload(), &payload); err != nil {
		return nil, err
	}

	return payload, nil
}

// Payload returns the parsed event payload. For recognized event types,
// a value of the corresponding struct type will be returned.
//
// Deprecated: Use ParsePayload instead, which returns an error
// rather than panics if JSON unmarshaling raw payload fails.
func (e *Event) Payload() (payload any) {
	var err error
	payload, err = e.ParsePayload()
	if err != nil {
		panic(err)
	}
	return payload
}
