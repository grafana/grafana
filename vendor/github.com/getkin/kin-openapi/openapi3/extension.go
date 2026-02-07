package openapi3

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func validateExtensions(ctx context.Context, extensions map[string]any) error { // FIXME: newtype + Validate(...)
	allowed := getValidationOptions(ctx).extraSiblingFieldsAllowed

	var unknowns []string
	for k := range extensions {
		if strings.HasPrefix(k, "x-") {
			continue
		}
		if allowed != nil {
			if _, ok := allowed[k]; ok {
				continue
			}
		}
		unknowns = append(unknowns, k)
	}

	if len(unknowns) != 0 {
		sort.Strings(unknowns)
		return fmt.Errorf("extra sibling fields: %+v", unknowns)
	}

	return nil
}
