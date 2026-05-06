package v4

import (
	sdkstrings "github.com/aws/aws-sdk-go-v2/internal/strings"
)

// Rules houses a set of Rule needed for validation of a
// string value
type Rules []Rule

// Rule interface allows for more flexible rules and just simply
// checks whether or not a value adheres to that Rule
type Rule interface {
	IsValid(value string) bool
}

// IsValid will iterate through all rules and see if any rules
// apply to the value and supports nested rules
func (r Rules) IsValid(value string) bool {
	for _, rule := range r {
		if rule.IsValid(value) {
			return true
		}
	}
	return false
}

// MapRule generic Rule for maps
type MapRule map[string]struct{}

// IsValid for the map Rule satisfies whether it exists in the map
func (m MapRule) IsValid(value string) bool {
	_, ok := m[value]
	return ok
}

// AllowList is a generic Rule for include listing
type AllowList struct {
	Rule
}

// IsValid for AllowList checks if the value is within the AllowList
func (w AllowList) IsValid(value string) bool {
	return w.Rule.IsValid(value)
}

// ExcludeList is a generic Rule for exclude listing
type ExcludeList struct {
	Rule
}

// IsValid for AllowList checks if the value is within the AllowList
func (b ExcludeList) IsValid(value string) bool {
	return !b.Rule.IsValid(value)
}

// Patterns is a list of strings to match against
type Patterns []string

// IsValid for Patterns checks each pattern and returns if a match has
// been found
func (p Patterns) IsValid(value string) bool {
	for _, pattern := range p {
		if sdkstrings.HasPrefixFold(value, pattern) {
			return true
		}
	}
	return false
}

// InclusiveRules rules allow for rules to depend on one another
type InclusiveRules []Rule

// IsValid will return true if all rules are true
func (r InclusiveRules) IsValid(value string) bool {
	for _, rule := range r {
		if !rule.IsValid(value) {
			return false
		}
	}
	return true
}
