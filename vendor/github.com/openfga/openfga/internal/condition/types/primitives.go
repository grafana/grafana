package types

import (
	"github.com/google/cel-go/cel"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

const startingGenericTypeCount = 1

var (
	AnyParamType = registerParamType(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_ANY,
		cel.AnyType,
		anyTypeConverterFunc,
	)
	BoolParamType = registerParamType(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_BOOL,
		cel.BoolType,
		primitiveTypeConverterFunc[bool],
	)
	StringParamType = registerParamType(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_STRING,
		cel.StringType,
		primitiveTypeConverterFunc[string],
	)
	IntParamType = registerParamType(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_INT,
		cel.IntType,
		numericTypeConverterFunc[int64],
	)
	UIntParamType = registerParamType(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_UINT,
		cel.UintType,
		numericTypeConverterFunc[uint64],
	)
	DoubleParamType = registerParamType(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_DOUBLE,
		cel.DoubleType,
		numericTypeConverterFunc[float64],
	)
	DurationParamType = registerParamType(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_DURATION,
		cel.DurationType,
		durationTypeConverterFunc,
	)
	TimestampParamType = registerParamType(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_TIMESTAMP,
		cel.TimestampType,
		timestampTypeConverterFunc,
	)
	MapParamType = registerParamTypeWithGenerics(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_MAP,
		startingGenericTypeCount,
		mapTypeConverterFunc,
	)
	ListParamType = registerParamTypeWithGenerics(
		openfgav1.ConditionParamTypeRef_TYPE_NAME_LIST,
		startingGenericTypeCount,
		listTypeConverterFunc,
	)
)
