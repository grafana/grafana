// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package baggage

const (
	defaultMaxValueLength = 2048
)

// Restriction determines whether a baggage key is allowed and contains any restrictions on the baggage value.
type Restriction struct {
	keyAllowed     bool
	maxValueLength int
}

// NewRestriction returns a new Restriction.
func NewRestriction(keyAllowed bool, maxValueLength int) *Restriction {
	return &Restriction{
		keyAllowed:     keyAllowed,
		maxValueLength: maxValueLength,
	}
}

// KeyAllowed returns whether the baggage key for this restriction is allowed.
func (r *Restriction) KeyAllowed() bool {
	return r.keyAllowed
}

// MaxValueLength returns the max length for the baggage value.
func (r *Restriction) MaxValueLength() int {
	return r.maxValueLength
}

// RestrictionManager keeps track of valid baggage keys and their restrictions. The manager
// will return a Restriction for a specific baggage key which will determine whether the baggage
// key is allowed for the current service and any other applicable restrictions on the baggage
// value.
type RestrictionManager interface {
	GetRestriction(service, key string) *Restriction
}

// DefaultRestrictionManager allows any baggage key.
type DefaultRestrictionManager struct {
	defaultRestriction *Restriction
}

// NewDefaultRestrictionManager returns a DefaultRestrictionManager.
func NewDefaultRestrictionManager(maxValueLength int) *DefaultRestrictionManager {
	if maxValueLength == 0 {
		maxValueLength = defaultMaxValueLength
	}
	return &DefaultRestrictionManager{
		defaultRestriction: &Restriction{keyAllowed: true, maxValueLength: maxValueLength},
	}
}

// GetRestriction implements RestrictionManager#GetRestriction.
func (m *DefaultRestrictionManager) GetRestriction(service, key string) *Restriction {
	return m.defaultRestriction
}
