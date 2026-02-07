package types

import (
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func DecodeParameterType(conditionParamType *openfgav1.ConditionParamTypeRef) (*ParameterType, error) {
	paramTypedef, ok := paramTypeDefinitions[conditionParamType.GetTypeName()]
	if !ok {
		return nil, fmt.Errorf("unknown condition parameter type `%s`", conditionParamType.GetTypeName())
	}

	if len(conditionParamType.GetGenericTypes()) != int(paramTypedef.genericTypeCount) {
		return nil, fmt.Errorf(
			"condition parameter type `%s` requires %d generic types; found %d",
			conditionParamType.GetTypeName(),
			len(conditionParamType.GetGenericTypes()),
			paramTypedef.genericTypeCount,
		)
	}

	genericTypes := make([]ParameterType, 0, paramTypedef.genericTypeCount)
	for _, encodedGenericType := range conditionParamType.GetGenericTypes() {
		genericType, err := DecodeParameterType(encodedGenericType)
		if err != nil {
			return nil, err
		}

		genericTypes = append(genericTypes, *genericType)
	}

	return paramTypedef.toParameterType(genericTypes)
}
