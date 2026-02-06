package errors

// Matcher matches a given error
type Matcher interface {
	// Is returns true if the err matches
	Is(err error) bool
}

// Is check if err matches all matchers
func Is(err error, matchers ...Matcher) bool {
	if len(matchers) == 0 {
		return false
	}

	for _, m := range matchers {
		if !m.Is(err) {
			return false
		}
	}

	return true
}

// Any checks if err matches any matchers
func Any(err error, matchers ...Matcher) bool {
	if len(matchers) == 0 {
		return false
	}

	for _, m := range matchers {
		if m.Is(err) {
			return true
		}
	}

	return false
}
