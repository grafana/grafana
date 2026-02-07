package awsrulesfn

import (
	"strings"
)

// ARN provides AWS ARN components broken out into a data structure.
type ARN struct {
	Partition  string
	Service    string
	Region     string
	AccountId  string
	ResourceId OptionalStringSlice
}

const (
	arnDelimiters      = ":"
	resourceDelimiters = "/:"
	arnSections        = 6
	arnPrefix          = "arn:"

	// zero-indexed
	sectionPartition = 1
	sectionService   = 2
	sectionRegion    = 3
	sectionAccountID = 4
	sectionResource  = 5
)

// ParseARN returns an [ARN] value parsed from the input string provided. If
// the ARN cannot be parsed nil will be returned, and error added to
// [ErrorCollector].
func ParseARN(input string) *ARN {
	if !strings.HasPrefix(input, arnPrefix) {
		return nil
	}

	sections := strings.SplitN(input, arnDelimiters, arnSections)
	if numSections := len(sections); numSections != arnSections {
		return nil
	}

	if sections[sectionPartition] == "" {
		return nil
	}
	if sections[sectionService] == "" {
		return nil
	}
	if sections[sectionResource] == "" {
		return nil
	}

	return &ARN{
		Partition:  sections[sectionPartition],
		Service:    sections[sectionService],
		Region:     sections[sectionRegion],
		AccountId:  sections[sectionAccountID],
		ResourceId: splitResource(sections[sectionResource]),
	}
}

// splitResource splits the resource components by the ARN resource delimiters.
func splitResource(v string) []string {
	var parts []string
	var offset int

	for offset <= len(v) {
		idx := strings.IndexAny(v[offset:], "/:")
		if idx < 0 {
			parts = append(parts, v[offset:])
			break
		}
		parts = append(parts, v[offset:idx+offset])
		offset += idx + 1
	}

	return parts
}

// OptionalStringSlice provides a helper to safely get the index of a string
// slice that may be out of bounds. Returns pointer to string if index is
// valid. Otherwise returns nil.
type OptionalStringSlice []string

// Get returns a string pointer of the string at index i if the index is valid.
// Otherwise returns nil.
func (s OptionalStringSlice) Get(i int) *string {
	if i < 0 || i >= len(s) {
		return nil
	}

	v := s[i]
	return &v
}
