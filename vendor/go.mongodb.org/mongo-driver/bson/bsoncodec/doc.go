// Copyright (C) MongoDB, Inc. 2022-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

// Package bsoncodec provides a system for encoding values to BSON representations and decoding
// values from BSON representations. This package considers both binary BSON and ExtendedJSON as
// BSON representations. The types in this package enable a flexible system for handling this
// encoding and decoding.
//
// The codec system is composed of two parts:
//
// 1) ValueEncoders and ValueDecoders that handle encoding and decoding Go values to and from BSON
// representations.
//
// 2) A Registry that holds these ValueEncoders and ValueDecoders and provides methods for
// retrieving them.
//
// # ValueEncoders and ValueDecoders
//
// The ValueEncoder interface is implemented by types that can encode a provided Go type to BSON.
// The value to encode is provided as a reflect.Value and a bsonrw.ValueWriter is used within the
// EncodeValue method to actually create the BSON representation. For convenience, ValueEncoderFunc
// is provided to allow use of a function with the correct signature as a ValueEncoder. An
// EncodeContext instance is provided to allow implementations to lookup further ValueEncoders and
// to provide configuration information.
//
// The ValueDecoder interface is the inverse of the ValueEncoder. Implementations should ensure that
// the value they receive is settable. Similar to ValueEncoderFunc, ValueDecoderFunc is provided to
// allow the use of a function with the correct signature as a ValueDecoder. A DecodeContext
// instance is provided and serves similar functionality to the EncodeContext.
//
// # Registry
//
// A Registry is a store for ValueEncoders, ValueDecoders, and a type map. See the Registry type
// documentation for examples of registering various custom encoders and decoders. A Registry can
// have three main types of codecs:
//
// 1. Type encoders/decoders - These can be registered using the RegisterTypeEncoder and
// RegisterTypeDecoder methods. The registered codec will be invoked when encoding/decoding a value
// whose type matches the registered type exactly.
// If the registered type is an interface, the codec will be invoked when encoding or decoding
// values whose type is the interface, but not for values with concrete types that implement the
// interface.
//
// 2. Hook encoders/decoders - These can be registered using the RegisterHookEncoder and
// RegisterHookDecoder methods. These methods only accept interface types and the registered codecs
// will be invoked when encoding or decoding values whose types implement the interface. An example
// of a hook defined by the driver is bson.Marshaler. The driver will call the MarshalBSON method
// for any value whose type implements bson.Marshaler, regardless of the value's concrete type.
//
// 3. Type map entries - This can be used to associate a BSON type with a Go type. These type
// associations are used when decoding into a bson.D/bson.M or a struct field of type interface{}.
// For example, by default, BSON int32 and int64 values decode as Go int32 and int64 instances,
// respectively, when decoding into a bson.D. The following code would change the behavior so these
// values decode as Go int instances instead:
//
//	intType := reflect.TypeOf(int(0))
//	registry.RegisterTypeMapEntry(bsontype.Int32, intType).RegisterTypeMapEntry(bsontype.Int64, intType)
//
// 4. Kind encoder/decoders - These can be registered using the RegisterDefaultEncoder and
// RegisterDefaultDecoder methods. The registered codec will be invoked when encoding or decoding
// values whose reflect.Kind matches the registered reflect.Kind as long as the value's type doesn't
// match a registered type or hook encoder/decoder first. These methods should be used to change the
// behavior for all values for a specific kind.
//
// # Registry Lookup Procedure
//
// When looking up an encoder in a Registry, the precedence rules are as follows:
//
// 1. A type encoder registered for the exact type of the value.
//
// 2. A hook encoder registered for an interface that is implemented by the value or by a pointer to
// the value. If the value matches multiple hooks (e.g. the type implements bsoncodec.Marshaler and
// bsoncodec.ValueMarshaler), the first one registered will be selected. Note that registries
// constructed using bson.NewRegistry have driver-defined hooks registered for the
// bsoncodec.Marshaler, bsoncodec.ValueMarshaler, and bsoncodec.Proxy interfaces, so those will take
// precedence over any new hooks.
//
// 3. A kind encoder registered for the value's kind.
//
// If all of these lookups fail to find an encoder, an error of type ErrNoEncoder is returned. The
// same precedence rules apply for decoders, with the exception that an error of type ErrNoDecoder
// will be returned if no decoder is found.
//
// # DefaultValueEncoders and DefaultValueDecoders
//
// The DefaultValueEncoders and DefaultValueDecoders types provide a full set of ValueEncoders and
// ValueDecoders for handling a wide range of Go types, including all of the types within the
// primitive package. To make registering these codecs easier, a helper method on each type is
// provided. For the DefaultValueEncoders type the method is called RegisterDefaultEncoders and for
// the DefaultValueDecoders type the method is called RegisterDefaultDecoders, this method also
// handles registering type map entries for each BSON type.
package bsoncodec
