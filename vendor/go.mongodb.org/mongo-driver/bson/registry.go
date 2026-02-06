// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bson

import (
	"go.mongodb.org/mongo-driver/bson/bsoncodec"
)

// DefaultRegistry is the default bsoncodec.Registry. It contains the default
// codecs and the primitive codecs.
//
// Deprecated: Use [NewRegistry] to construct a new default registry. To use a
// custom registry when marshaling or unmarshaling, use the "SetRegistry" method
// on an [Encoder] or [Decoder] instead:
//
//	dec, err := bson.NewDecoder(bsonrw.NewBSONDocumentReader(data))
//	if err != nil {
//	    panic(err)
//	}
//	dec.SetRegistry(reg)
//
// See [Encoder] and [Decoder] for more examples.
var DefaultRegistry = NewRegistry()

// NewRegistryBuilder creates a new RegistryBuilder configured with the default encoders and
// decoders from the bsoncodec.DefaultValueEncoders and bsoncodec.DefaultValueDecoders types and the
// PrimitiveCodecs type in this package.
//
// Deprecated: Use [NewRegistry] instead.
func NewRegistryBuilder() *bsoncodec.RegistryBuilder {
	rb := bsoncodec.NewRegistryBuilder()
	bsoncodec.DefaultValueEncoders{}.RegisterDefaultEncoders(rb)
	bsoncodec.DefaultValueDecoders{}.RegisterDefaultDecoders(rb)
	primitiveCodecs.RegisterPrimitiveCodecs(rb)
	return rb
}

// NewRegistry creates a new Registry configured with the default encoders and decoders from the
// bsoncodec.DefaultValueEncoders and bsoncodec.DefaultValueDecoders types and the PrimitiveCodecs
// type in this package.
func NewRegistry() *bsoncodec.Registry {
	return NewRegistryBuilder().Build()
}
