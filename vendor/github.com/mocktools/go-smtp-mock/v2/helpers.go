package smtpmock

import (
	"fmt"
	"regexp"
)

// Regex builder
func newRegex(regexPattern string) (*regexp.Regexp, error) {
	return regexp.Compile(regexPattern)
}

// Matches string to regex pattern
func matchRegex(strContext, regexPattern string) bool {
	regex, err := newRegex(regexPattern)
	if err != nil {
		return false
	}

	return regex.MatchString(strContext)
}

// Returns string by regex pattern capture group index. For cases when regex not matched or
// capture group not found returns empty string
func regexCaptureGroup(str string, regexPattern string, captureGroup int) (capturedString string) {
	var regex *regexp.Regexp
	defer func() { _ = recover() }()
	regex, _ = newRegex(regexPattern)
	capturedString = regex.FindStringSubmatch(str)[captureGroup]
	return capturedString
}

// Returns true if the given string is present in slice, otherwise returns false
func isIncluded(slice []string, target string) bool {
	if len(slice) > 0 {
		for _, item := range slice {
			if item == target {
				return true
			}
		}
	}

	return false
}

// Returns server with port number follows {server}:{portNumber} pattern
func serverWithPortNumber(server string, portNumber int) string {
	return fmt.Sprintf("%s:%d", server, portNumber)
}
