package util

import (
	"fmt"
	"strings"
)

func TabOut(s fmt.Stringer) string {
	return strings.Replace(s.String(), "\n", "\n\t", -1)
}
