package tools

import (
	"strings"
)

func ItemInList[T comparable](needle T, haystack []T) bool {
	for _, item := range haystack {
		if item == needle {
			return true
		}
	}

	return false
}

func StringInListEqualFold(needle string, haystack []string) bool {
	for _, item := range haystack {
		if strings.EqualFold(item, needle) {
			return true
		}
	}

	return false
}

func Map[T any, O any](input []T, mapper func(T) O) []O {
	if input == nil {
		return nil
	}

	output := make([]O, len(input))

	for i := range input {
		output[i] = mapper(input[i])
	}

	return output
}

func Filter[T any](input []T, predicate func(T) bool) []T {
	if input == nil {
		return nil
	}

	output := make([]T, 0, len(input))

	for i := range input {
		if !predicate(input[i]) {
			continue
		}

		output = append(output, input[i])
	}

	return output
}
