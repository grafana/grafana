package util

// CopyMap makes a copy of the given map
func CopyMap(m map[string]string) map[string]string {
	var newMap = make(map[string]string, len(m))

	if m == nil {
		return nil
	}

	for k, v := range m {
		newMap[k] = v
	}

	return newMap
}

// MergeMaps merges the overlay map onto the base map, with overlay taking precedence
// NOTE: this treats the given base and overlay maps as immutable, and returns a copy
func MergeMaps(base map[string]string, overlay map[string]string) map[string]string {
	if base == nil {
		return CopyMap(overlay)
	}

	newMap := CopyMap(base)
	if overlay == nil {
		return newMap
	}

	for k, v := range overlay {
		newMap[k] = v
	}

	return newMap
}
