// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package json // import "go.opentelemetry.io/collector/pdata/internal/json"

import (
	jsoniter "github.com/json-iterator/go"

	otlpcommon "go.opentelemetry.io/collector/pdata/internal/data/protogen/common/v1"
)

func ReadScope(iter *jsoniter.Iterator, scope *otlpcommon.InstrumentationScope) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "name":
			scope.Name = iter.ReadString()
		case "version":
			scope.Version = iter.ReadString()
		case "attributes":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				scope.Attributes = append(scope.Attributes, ReadAttribute(iter))
				return true
			})
		case "droppedAttributesCount", "dropped_attributes_count":
			scope.DroppedAttributesCount = ReadUint32(iter)
		default:
			iter.Skip()
		}
		return true
	})
}
