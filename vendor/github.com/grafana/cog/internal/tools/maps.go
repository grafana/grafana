package tools

func Keys[K comparable, V any](inputMap map[K]V) []K {
	keys := make([]K, 0, len(inputMap))

	for k := range inputMap {
		keys = append(keys, k)
	}

	return keys
}
