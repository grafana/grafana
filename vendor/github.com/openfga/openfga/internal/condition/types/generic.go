package types

import (
	"fmt"

	"github.com/google/cel-go/cel"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func mapTypeConverterFunc(genericTypes []ParameterType) ParameterType {
	return ParameterType{
		name:         openfgav1.ConditionParamTypeRef_TYPE_NAME_MAP,
		celType:      cel.MapType(cel.StringType, genericTypes[0].celType),
		genericTypes: genericTypes,
		typedParamConverter: func(value any) (any, error) {
			v, ok := value.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("map requires a map, found: %T", value)
			}

			converted := make(map[string]any, len(v))
			for key, item := range v {
				convertedItem, err := genericTypes[0].ConvertValue(item)
				if err != nil {
					return nil, fmt.Errorf("found an invalid value for key '%s': %w", key, err)
				}

				converted[key] = convertedItem
			}

			return converted, nil
		},
	}
}

func listTypeConverterFunc(genericTypes []ParameterType) ParameterType {
	return ParameterType{
		name:         openfgav1.ConditionParamTypeRef_TYPE_NAME_LIST,
		celType:      cel.ListType(genericTypes[0].celType),
		genericTypes: genericTypes,
		typedParamConverter: func(value any) (any, error) {
			v, ok := value.([]any)
			if !ok {
				return nil, fmt.Errorf("list requires a list, found: %T", value)
			}

			converted := make([]any, len(v))
			for index, item := range v {
				convertedItem, err := genericTypes[0].ConvertValue(item)
				if err != nil {
					return nil, fmt.Errorf("found an invalid list item at index `%d`: %w", index, err)
				}

				converted[index] = convertedItem
			}

			return converted, nil
		},
	}
}
