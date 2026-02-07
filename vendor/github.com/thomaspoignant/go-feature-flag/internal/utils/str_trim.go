package utils

import "strings"

func StrTrim(s string) string {
	trimmed := strings.Split(s, "\n")
	for index, item := range trimmed {
		trimmed[index] = strings.TrimLeft(item, " ")
	}
	return strings.Join(trimmed, "")
}
