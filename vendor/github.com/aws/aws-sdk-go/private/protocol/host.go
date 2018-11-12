package protocol

// ValidHostLabel returns if the label is a valid RFC 1123 Section 2.1 domain
// host label name.
func ValidHostLabel(label string) bool {
	if l := len(label); l == 0 || l > 63 {
		return false
	}
	for _, r := range label {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'A' && r <= 'Z':
		case r >= 'a' && r <= 'z':
		case r == '-':
		default:
			return false
		}
	}

	return true
}
