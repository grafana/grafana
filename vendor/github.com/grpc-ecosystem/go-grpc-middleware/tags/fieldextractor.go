// Copyright 2017 Michal Witkowski. All Rights Reserved.
// See LICENSE for licensing terms.

package grpc_ctxtags

import (
	"reflect"
)

// RequestFieldExtractorFunc is a user-provided function that extracts field information from a gRPC request.
// It is called from tags middleware on arrival of unary request or a server-stream request.
// Keys and values will be added to the context tags of the request. If there are no fields, you should return a nil.
type RequestFieldExtractorFunc func(fullMethod string, req interface{}) map[string]interface{}

type requestFieldsExtractor interface {
	// ExtractRequestFields is a method declared on a Protobuf message that extracts fields from the interface.
	// The values from the extracted fields should be set in the appendToMap, in order to avoid allocations.
	ExtractRequestFields(appendToMap map[string]interface{})
}

// CodeGenRequestFieldExtractor is a function that relies on code-generated functions that export log fields from requests.
// These are usually coming from a protoc-plugin that generates additional information based on custom field options.
func CodeGenRequestFieldExtractor(fullMethod string, req interface{}) map[string]interface{} {
	if ext, ok := req.(requestFieldsExtractor); ok {
		retMap := make(map[string]interface{})
		ext.ExtractRequestFields(retMap)
		if len(retMap) == 0 {
			return nil
		}
		return retMap
	}
	return nil
}

// TagBasedRequestFieldExtractor is a function that relies on Go struct tags to export log fields from requests.
// These are usually coming from a protoc-plugin, such as Gogo protobuf.
//
//  message Metadata {
//     repeated string tags = 1 [ (gogoproto.moretags) = "log_field:\"meta_tags\"" ];
//  }
//
// The tagName is configurable using the tagName variable. Here it would be "log_field".
func TagBasedRequestFieldExtractor(tagName string) RequestFieldExtractorFunc {
	return func(fullMethod string, req interface{}) map[string]interface{} {
		retMap := make(map[string]interface{})
		reflectMessageTags(req, retMap, tagName)
		if len(retMap) == 0 {
			return nil
		}
		return retMap
	}
}

func reflectMessageTags(msg interface{}, existingMap map[string]interface{}, tagName string) {
	v := reflect.ValueOf(msg)
	// Only deal with pointers to structs.
	if v.Kind() != reflect.Ptr || v.Elem().Kind() != reflect.Struct {
		return
	}
	// Deref the pointer get to the struct.
	v = v.Elem()
	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		kind := field.Kind()
		// Only recurse down direct pointers, which should only be to nested structs.
		if (kind == reflect.Ptr || kind == reflect.Interface) && field.CanInterface() {
			reflectMessageTags(field.Interface(), existingMap, tagName)
		}
		// In case of arrays/slices (repeated fields) go down to the concrete type.
		if kind == reflect.Array || kind == reflect.Slice {
			if field.Len() == 0 {
				continue
			}
			kind = field.Index(0).Kind()
		}
		// Only be interested in
		if (kind >= reflect.Bool && kind <= reflect.Float64) || kind == reflect.String {
			if tag := t.Field(i).Tag.Get(tagName); tag != "" {
				existingMap[tag] = field.Interface()
			}
		}
	}
	return
}
