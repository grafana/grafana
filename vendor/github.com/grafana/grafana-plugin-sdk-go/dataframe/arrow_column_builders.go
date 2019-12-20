package dataframe

import (
	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/array"
	"github.com/apache/arrow/go/arrow/memory"
)

func buildStringColumn(pool memory.Allocator, field arrow.Field, vec *stringVector) *array.Column {
	builder := array.NewStringBuilder(pool)
	defer builder.Release()

	for _, v := range *vec {
		builder.Append(v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildNullableStringColumn(pool memory.Allocator, field arrow.Field, vec *nullableStringVector) *array.Column {
	builder := array.NewStringBuilder(pool)
	defer builder.Release()

	for _, v := range *vec {
		if v == nil {
			builder.AppendNull()
			continue
		}
		builder.Append(*v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildIntColumn(pool memory.Allocator, field arrow.Field, vec *intVector) *array.Column {
	builder := array.NewInt64Builder(pool)
	defer builder.Release()

	for _, v := range *vec {
		builder.Append(v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildNullableIntColumn(pool memory.Allocator, field arrow.Field, vec *nullableIntVector) *array.Column {
	builder := array.NewInt64Builder(pool)
	defer builder.Release()

	for _, v := range *vec {
		if v == nil {
			builder.AppendNull()
			continue
		}
		builder.Append(*v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildUIntColumn(pool memory.Allocator, field arrow.Field, vec *uintVector) *array.Column {
	builder := array.NewUint64Builder(pool)
	defer builder.Release()

	for _, v := range *vec {
		builder.Append(v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildNullableUIntColumn(pool memory.Allocator, field arrow.Field, vec *nullableUintVector) *array.Column {
	builder := array.NewUint64Builder(pool)
	defer builder.Release()

	for _, v := range *vec {
		if v == nil {
			builder.AppendNull()
			continue
		}
		builder.Append(*v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildFloatColumn(pool memory.Allocator, field arrow.Field, vec *floatVector) *array.Column {
	builder := array.NewFloat64Builder(pool)
	defer builder.Release()

	for _, v := range *vec {
		builder.Append(v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildNullableFloatColumn(pool memory.Allocator, field arrow.Field, vec *nullableFloatVector) *array.Column {
	builder := array.NewFloat64Builder(pool)
	defer builder.Release()

	for _, v := range *vec {
		if v == nil {
			builder.AppendNull()
			continue
		}
		builder.Append(*v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildBoolColumn(pool memory.Allocator, field arrow.Field, vec *boolVector) *array.Column {
	builder := array.NewBooleanBuilder(pool)
	defer builder.Release()

	for _, v := range *vec {
		builder.Append(v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildNullableBoolColumn(pool memory.Allocator, field arrow.Field, vec *nullableBoolVector) *array.Column {
	builder := array.NewBooleanBuilder(pool)
	defer builder.Release()

	for _, v := range *vec {
		if v == nil {
			builder.AppendNull()
			continue
		}
		builder.Append(*v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildTimeColumn(pool memory.Allocator, field arrow.Field, vec *timeVector) *array.Column {
	builder := array.NewTimestampBuilder(pool, &arrow.TimestampType{
		Unit: arrow.Nanosecond,
	})
	defer builder.Release()

	for _, v := range *vec {
		builder.Append(arrow.Timestamp((v).UnixNano()))
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildNullableTimeColumn(pool memory.Allocator, field arrow.Field, vec *nullableTimeVector) *array.Column {
	builder := array.NewTimestampBuilder(pool, &arrow.TimestampType{
		Unit: arrow.Nanosecond,
	})
	defer builder.Release()

	for _, v := range *vec {
		if v == nil {
			builder.AppendNull()
			continue
		}
		builder.Append(arrow.Timestamp((*v).UnixNano()))
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}
