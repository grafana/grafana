// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package json // import "go.opentelemetry.io/collector/pdata/internal/json"

import (
	jsoniter "github.com/json-iterator/go"

	otlpresource "go.opentelemetry.io/collector/pdata/internal/data/protogen/resource/v1"
)

func ReadResource(iter *jsoniter.Iterator, resource *otlpresource.Resource) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "attributes":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				resource.Attributes = append(resource.Attributes, ReadAttribute(iter))
				return true
			})
		case "droppedAttributesCount", "dropped_attributes_count":
			resource.DroppedAttributesCount = ReadUint32(iter)
		default:
			iter.Skip()
		}
		return true
	})
}
