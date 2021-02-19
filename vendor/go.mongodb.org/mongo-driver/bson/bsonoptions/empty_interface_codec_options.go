// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// EmptyInterfaceCodecOptions represents all possible options for interface{} encoding and decoding.
type EmptyInterfaceCodecOptions struct {
	DecodeBinaryAsSlice *bool // Specifies if Old and Generic type binarys should default to []slice instead of primitive.Binary. Defaults to false.
}

// EmptyInterfaceCodec creates a new *EmptyInterfaceCodecOptions
func EmptyInterfaceCodec() *EmptyInterfaceCodecOptions {
	return &EmptyInterfaceCodecOptions{}
}

// SetDecodeBinaryAsSlice specifies if Old and Generic type binarys should default to []slice instead of primitive.Binary. Defaults to false.
func (e *EmptyInterfaceCodecOptions) SetDecodeBinaryAsSlice(b bool) *EmptyInterfaceCodecOptions {
	e.DecodeBinaryAsSlice = &b
	return e
}

// MergeEmptyInterfaceCodecOptions combines the given *EmptyInterfaceCodecOptions into a single *EmptyInterfaceCodecOptions in a last one wins fashion.
func MergeEmptyInterfaceCodecOptions(opts ...*EmptyInterfaceCodecOptions) *EmptyInterfaceCodecOptions {
	e := EmptyInterfaceCodec()
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		if opt.DecodeBinaryAsSlice != nil {
			e.DecodeBinaryAsSlice = opt.DecodeBinaryAsSlice
		}
	}

	return e
}
