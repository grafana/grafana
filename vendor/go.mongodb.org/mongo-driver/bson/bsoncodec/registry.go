// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"errors"
	"fmt"
	"reflect"
	"sync"

	"go.mongodb.org/mongo-driver/bson/bsontype"
)

// ErrNilType is returned when nil is passed to either LookupEncoder or LookupDecoder.
//
// Deprecated: ErrNilType will not be supported in Go Driver 2.0.
var ErrNilType = errors.New("cannot perform a decoder lookup on <nil>")

// ErrNotPointer is returned when a non-pointer type is provided to LookupDecoder.
//
// Deprecated: ErrNotPointer will not be supported in Go Driver 2.0.
var ErrNotPointer = errors.New("non-pointer provided to LookupDecoder")

// ErrNoEncoder is returned when there wasn't an encoder available for a type.
//
// Deprecated: ErrNoEncoder will not be supported in Go Driver 2.0.
type ErrNoEncoder struct {
	Type reflect.Type
}

func (ene ErrNoEncoder) Error() string {
	if ene.Type == nil {
		return "no encoder found for <nil>"
	}
	return "no encoder found for " + ene.Type.String()
}

// ErrNoDecoder is returned when there wasn't a decoder available for a type.
//
// Deprecated: ErrNoDecoder will not be supported in Go Driver 2.0.
type ErrNoDecoder struct {
	Type reflect.Type
}

func (end ErrNoDecoder) Error() string {
	return "no decoder found for " + end.Type.String()
}

// ErrNoTypeMapEntry is returned when there wasn't a type available for the provided BSON type.
//
// Deprecated: ErrNoTypeMapEntry will not be supported in Go Driver 2.0.
type ErrNoTypeMapEntry struct {
	Type bsontype.Type
}

func (entme ErrNoTypeMapEntry) Error() string {
	return "no type map entry found for " + entme.Type.String()
}

// ErrNotInterface is returned when the provided type is not an interface.
//
// Deprecated: ErrNotInterface will not be supported in Go Driver 2.0.
var ErrNotInterface = errors.New("The provided type is not an interface")

// A RegistryBuilder is used to build a Registry. This type is not goroutine
// safe.
//
// Deprecated: Use Registry instead.
type RegistryBuilder struct {
	registry *Registry
}

// NewRegistryBuilder creates a new empty RegistryBuilder.
//
// Deprecated: Use NewRegistry instead.
func NewRegistryBuilder() *RegistryBuilder {
	return &RegistryBuilder{
		registry: NewRegistry(),
	}
}

// RegisterCodec will register the provided ValueCodec for the provided type.
//
// Deprecated: Use Registry.RegisterTypeEncoder and Registry.RegisterTypeDecoder instead.
func (rb *RegistryBuilder) RegisterCodec(t reflect.Type, codec ValueCodec) *RegistryBuilder {
	rb.RegisterTypeEncoder(t, codec)
	rb.RegisterTypeDecoder(t, codec)
	return rb
}

// RegisterTypeEncoder will register the provided ValueEncoder for the provided type.
//
// The type will be used directly, so an encoder can be registered for a type and a different encoder can be registered
// for a pointer to that type.
//
// If the given type is an interface, the encoder will be called when marshaling a type that is that interface. It
// will not be called when marshaling a non-interface type that implements the interface.
//
// Deprecated: Use Registry.RegisterTypeEncoder instead.
func (rb *RegistryBuilder) RegisterTypeEncoder(t reflect.Type, enc ValueEncoder) *RegistryBuilder {
	rb.registry.RegisterTypeEncoder(t, enc)
	return rb
}

// RegisterHookEncoder will register an encoder for the provided interface type t. This encoder will be called when
// marshaling a type if the type implements t or a pointer to the type implements t. If the provided type is not
// an interface (i.e. t.Kind() != reflect.Interface), this method will panic.
//
// Deprecated: Use Registry.RegisterInterfaceEncoder instead.
func (rb *RegistryBuilder) RegisterHookEncoder(t reflect.Type, enc ValueEncoder) *RegistryBuilder {
	rb.registry.RegisterInterfaceEncoder(t, enc)
	return rb
}

// RegisterTypeDecoder will register the provided ValueDecoder for the provided type.
//
// The type will be used directly, so a decoder can be registered for a type and a different decoder can be registered
// for a pointer to that type.
//
// If the given type is an interface, the decoder will be called when unmarshaling into a type that is that interface.
// It will not be called when unmarshaling into a non-interface type that implements the interface.
//
// Deprecated: Use Registry.RegisterTypeDecoder instead.
func (rb *RegistryBuilder) RegisterTypeDecoder(t reflect.Type, dec ValueDecoder) *RegistryBuilder {
	rb.registry.RegisterTypeDecoder(t, dec)
	return rb
}

// RegisterHookDecoder will register an decoder for the provided interface type t. This decoder will be called when
// unmarshaling into a type if the type implements t or a pointer to the type implements t. If the provided type is not
// an interface (i.e. t.Kind() != reflect.Interface), this method will panic.
//
// Deprecated: Use Registry.RegisterInterfaceDecoder instead.
func (rb *RegistryBuilder) RegisterHookDecoder(t reflect.Type, dec ValueDecoder) *RegistryBuilder {
	rb.registry.RegisterInterfaceDecoder(t, dec)
	return rb
}

// RegisterEncoder registers the provided type and encoder pair.
//
// Deprecated: Use Registry.RegisterTypeEncoder or Registry.RegisterInterfaceEncoder instead.
func (rb *RegistryBuilder) RegisterEncoder(t reflect.Type, enc ValueEncoder) *RegistryBuilder {
	if t == tEmpty {
		rb.registry.RegisterTypeEncoder(t, enc)
		return rb
	}
	switch t.Kind() {
	case reflect.Interface:
		rb.registry.RegisterInterfaceEncoder(t, enc)
	default:
		rb.registry.RegisterTypeEncoder(t, enc)
	}
	return rb
}

// RegisterDecoder registers the provided type and decoder pair.
//
// Deprecated: Use Registry.RegisterTypeDecoder or Registry.RegisterInterfaceDecoder instead.
func (rb *RegistryBuilder) RegisterDecoder(t reflect.Type, dec ValueDecoder) *RegistryBuilder {
	if t == nil {
		rb.registry.RegisterTypeDecoder(t, dec)
		return rb
	}
	if t == tEmpty {
		rb.registry.RegisterTypeDecoder(t, dec)
		return rb
	}
	switch t.Kind() {
	case reflect.Interface:
		rb.registry.RegisterInterfaceDecoder(t, dec)
	default:
		rb.registry.RegisterTypeDecoder(t, dec)
	}
	return rb
}

// RegisterDefaultEncoder will register the provided ValueEncoder to the provided
// kind.
//
// Deprecated: Use Registry.RegisterKindEncoder instead.
func (rb *RegistryBuilder) RegisterDefaultEncoder(kind reflect.Kind, enc ValueEncoder) *RegistryBuilder {
	rb.registry.RegisterKindEncoder(kind, enc)
	return rb
}

// RegisterDefaultDecoder will register the provided ValueDecoder to the
// provided kind.
//
// Deprecated: Use Registry.RegisterKindDecoder instead.
func (rb *RegistryBuilder) RegisterDefaultDecoder(kind reflect.Kind, dec ValueDecoder) *RegistryBuilder {
	rb.registry.RegisterKindDecoder(kind, dec)
	return rb
}

// RegisterTypeMapEntry will register the provided type to the BSON type. The primary usage for this
// mapping is decoding situations where an empty interface is used and a default type needs to be
// created and decoded into.
//
// By default, BSON documents will decode into interface{} values as bson.D. To change the default type for BSON
// documents, a type map entry for bsontype.EmbeddedDocument should be registered. For example, to force BSON documents
// to decode to bson.Raw, use the following code:
//
//	rb.RegisterTypeMapEntry(bsontype.EmbeddedDocument, reflect.TypeOf(bson.Raw{}))
//
// Deprecated: Use Registry.RegisterTypeMapEntry instead.
func (rb *RegistryBuilder) RegisterTypeMapEntry(bt bsontype.Type, rt reflect.Type) *RegistryBuilder {
	rb.registry.RegisterTypeMapEntry(bt, rt)
	return rb
}

// Build creates a Registry from the current state of this RegistryBuilder.
//
// Deprecated: Use NewRegistry instead.
func (rb *RegistryBuilder) Build() *Registry {
	r := &Registry{
		interfaceEncoders: append([]interfaceValueEncoder(nil), rb.registry.interfaceEncoders...),
		interfaceDecoders: append([]interfaceValueDecoder(nil), rb.registry.interfaceDecoders...),
		typeEncoders:      rb.registry.typeEncoders.Clone(),
		typeDecoders:      rb.registry.typeDecoders.Clone(),
		kindEncoders:      rb.registry.kindEncoders.Clone(),
		kindDecoders:      rb.registry.kindDecoders.Clone(),
	}
	rb.registry.typeMap.Range(func(k, v interface{}) bool {
		if k != nil && v != nil {
			r.typeMap.Store(k, v)
		}
		return true
	})
	return r
}

// A Registry is used to store and retrieve codecs for types and interfaces. This type is the main
// typed passed around and Encoders and Decoders are constructed from it.
type Registry struct {
	interfaceEncoders []interfaceValueEncoder
	interfaceDecoders []interfaceValueDecoder
	typeEncoders      *typeEncoderCache
	typeDecoders      *typeDecoderCache
	kindEncoders      *kindEncoderCache
	kindDecoders      *kindDecoderCache
	typeMap           sync.Map // map[bsontype.Type]reflect.Type
}

// NewRegistry creates a new empty Registry.
func NewRegistry() *Registry {
	return &Registry{
		typeEncoders: new(typeEncoderCache),
		typeDecoders: new(typeDecoderCache),
		kindEncoders: new(kindEncoderCache),
		kindDecoders: new(kindDecoderCache),
	}
}

// RegisterTypeEncoder registers the provided ValueEncoder for the provided type.
//
// The type will be used as provided, so an encoder can be registered for a type and a different
// encoder can be registered for a pointer to that type.
//
// If the given type is an interface, the encoder will be called when marshaling a type that is
// that interface. It will not be called when marshaling a non-interface type that implements the
// interface. To get the latter behavior, call RegisterHookEncoder instead.
//
// RegisterTypeEncoder should not be called concurrently with any other Registry method.
func (r *Registry) RegisterTypeEncoder(valueType reflect.Type, enc ValueEncoder) {
	r.typeEncoders.Store(valueType, enc)
}

// RegisterTypeDecoder registers the provided ValueDecoder for the provided type.
//
// The type will be used as provided, so a decoder can be registered for a type and a different
// decoder can be registered for a pointer to that type.
//
// If the given type is an interface, the decoder will be called when unmarshaling into a type that
// is that interface. It will not be called when unmarshaling into a non-interface type that
// implements the interface. To get the latter behavior, call RegisterHookDecoder instead.
//
// RegisterTypeDecoder should not be called concurrently with any other Registry method.
func (r *Registry) RegisterTypeDecoder(valueType reflect.Type, dec ValueDecoder) {
	r.typeDecoders.Store(valueType, dec)
}

// RegisterKindEncoder registers the provided ValueEncoder for the provided kind.
//
// Use RegisterKindEncoder to register an encoder for any type with the same underlying kind. For
// example, consider the type MyInt defined as
//
//	type MyInt int32
//
// To define an encoder for MyInt and int32, use RegisterKindEncoder like
//
//	reg.RegisterKindEncoder(reflect.Int32, myEncoder)
//
// RegisterKindEncoder should not be called concurrently with any other Registry method.
func (r *Registry) RegisterKindEncoder(kind reflect.Kind, enc ValueEncoder) {
	r.kindEncoders.Store(kind, enc)
}

// RegisterKindDecoder registers the provided ValueDecoder for the provided kind.
//
// Use RegisterKindDecoder to register a decoder for any type with the same underlying kind. For
// example, consider the type MyInt defined as
//
//	type MyInt int32
//
// To define an decoder for MyInt and int32, use RegisterKindDecoder like
//
//	reg.RegisterKindDecoder(reflect.Int32, myDecoder)
//
// RegisterKindDecoder should not be called concurrently with any other Registry method.
func (r *Registry) RegisterKindDecoder(kind reflect.Kind, dec ValueDecoder) {
	r.kindDecoders.Store(kind, dec)
}

// RegisterInterfaceEncoder registers an encoder for the provided interface type iface. This encoder will
// be called when marshaling a type if the type implements iface or a pointer to the type
// implements iface. If the provided type is not an interface
// (i.e. iface.Kind() != reflect.Interface), this method will panic.
//
// RegisterInterfaceEncoder should not be called concurrently with any other Registry method.
func (r *Registry) RegisterInterfaceEncoder(iface reflect.Type, enc ValueEncoder) {
	if iface.Kind() != reflect.Interface {
		panicStr := fmt.Errorf("RegisterInterfaceEncoder expects a type with kind reflect.Interface, "+
			"got type %s with kind %s", iface, iface.Kind())
		panic(panicStr)
	}

	for idx, encoder := range r.interfaceEncoders {
		if encoder.i == iface {
			r.interfaceEncoders[idx].ve = enc
			return
		}
	}

	r.interfaceEncoders = append(r.interfaceEncoders, interfaceValueEncoder{i: iface, ve: enc})
}

// RegisterInterfaceDecoder registers an decoder for the provided interface type iface. This decoder will
// be called when unmarshaling into a type if the type implements iface or a pointer to the type
// implements iface. If the provided type is not an interface (i.e. iface.Kind() != reflect.Interface),
// this method will panic.
//
// RegisterInterfaceDecoder should not be called concurrently with any other Registry method.
func (r *Registry) RegisterInterfaceDecoder(iface reflect.Type, dec ValueDecoder) {
	if iface.Kind() != reflect.Interface {
		panicStr := fmt.Errorf("RegisterInterfaceDecoder expects a type with kind reflect.Interface, "+
			"got type %s with kind %s", iface, iface.Kind())
		panic(panicStr)
	}

	for idx, decoder := range r.interfaceDecoders {
		if decoder.i == iface {
			r.interfaceDecoders[idx].vd = dec
			return
		}
	}

	r.interfaceDecoders = append(r.interfaceDecoders, interfaceValueDecoder{i: iface, vd: dec})
}

// RegisterTypeMapEntry will register the provided type to the BSON type. The primary usage for this
// mapping is decoding situations where an empty interface is used and a default type needs to be
// created and decoded into.
//
// By default, BSON documents will decode into interface{} values as bson.D. To change the default type for BSON
// documents, a type map entry for bsontype.EmbeddedDocument should be registered. For example, to force BSON documents
// to decode to bson.Raw, use the following code:
//
//	reg.RegisterTypeMapEntry(bsontype.EmbeddedDocument, reflect.TypeOf(bson.Raw{}))
func (r *Registry) RegisterTypeMapEntry(bt bsontype.Type, rt reflect.Type) {
	r.typeMap.Store(bt, rt)
}

// LookupEncoder returns the first matching encoder in the Registry. It uses the following lookup
// order:
//
// 1. An encoder registered for the exact type. If the given type is an interface, an encoder
// registered using RegisterTypeEncoder for that interface will be selected.
//
// 2. An encoder registered using RegisterInterfaceEncoder for an interface implemented by the type
// or by a pointer to the type.
//
// 3. An encoder registered using RegisterKindEncoder for the kind of value.
//
// If no encoder is found, an error of type ErrNoEncoder is returned. LookupEncoder is safe for
// concurrent use by multiple goroutines after all codecs and encoders are registered.
func (r *Registry) LookupEncoder(valueType reflect.Type) (ValueEncoder, error) {
	if valueType == nil {
		return nil, ErrNoEncoder{Type: valueType}
	}
	enc, found := r.lookupTypeEncoder(valueType)
	if found {
		if enc == nil {
			return nil, ErrNoEncoder{Type: valueType}
		}
		return enc, nil
	}

	enc, found = r.lookupInterfaceEncoder(valueType, true)
	if found {
		return r.typeEncoders.LoadOrStore(valueType, enc), nil
	}

	if v, ok := r.kindEncoders.Load(valueType.Kind()); ok {
		return r.storeTypeEncoder(valueType, v), nil
	}
	return nil, ErrNoEncoder{Type: valueType}
}

func (r *Registry) storeTypeEncoder(rt reflect.Type, enc ValueEncoder) ValueEncoder {
	return r.typeEncoders.LoadOrStore(rt, enc)
}

func (r *Registry) lookupTypeEncoder(rt reflect.Type) (ValueEncoder, bool) {
	return r.typeEncoders.Load(rt)
}

func (r *Registry) lookupInterfaceEncoder(valueType reflect.Type, allowAddr bool) (ValueEncoder, bool) {
	if valueType == nil {
		return nil, false
	}
	for _, ienc := range r.interfaceEncoders {
		if valueType.Implements(ienc.i) {
			return ienc.ve, true
		}
		if allowAddr && valueType.Kind() != reflect.Ptr && reflect.PtrTo(valueType).Implements(ienc.i) {
			// if *t implements an interface, this will catch if t implements an interface further
			// ahead in interfaceEncoders
			defaultEnc, found := r.lookupInterfaceEncoder(valueType, false)
			if !found {
				defaultEnc, _ = r.kindEncoders.Load(valueType.Kind())
			}
			return newCondAddrEncoder(ienc.ve, defaultEnc), true
		}
	}
	return nil, false
}

// LookupDecoder returns the first matching decoder in the Registry. It uses the following lookup
// order:
//
// 1. A decoder registered for the exact type. If the given type is an interface, a decoder
// registered using RegisterTypeDecoder for that interface will be selected.
//
// 2. A decoder registered using RegisterInterfaceDecoder for an interface implemented by the type or by
// a pointer to the type.
//
// 3. A decoder registered using RegisterKindDecoder for the kind of value.
//
// If no decoder is found, an error of type ErrNoDecoder is returned. LookupDecoder is safe for
// concurrent use by multiple goroutines after all codecs and decoders are registered.
func (r *Registry) LookupDecoder(valueType reflect.Type) (ValueDecoder, error) {
	if valueType == nil {
		return nil, ErrNilType
	}
	dec, found := r.lookupTypeDecoder(valueType)
	if found {
		if dec == nil {
			return nil, ErrNoDecoder{Type: valueType}
		}
		return dec, nil
	}

	dec, found = r.lookupInterfaceDecoder(valueType, true)
	if found {
		return r.storeTypeDecoder(valueType, dec), nil
	}

	if v, ok := r.kindDecoders.Load(valueType.Kind()); ok {
		return r.storeTypeDecoder(valueType, v), nil
	}
	return nil, ErrNoDecoder{Type: valueType}
}

func (r *Registry) lookupTypeDecoder(valueType reflect.Type) (ValueDecoder, bool) {
	return r.typeDecoders.Load(valueType)
}

func (r *Registry) storeTypeDecoder(typ reflect.Type, dec ValueDecoder) ValueDecoder {
	return r.typeDecoders.LoadOrStore(typ, dec)
}

func (r *Registry) lookupInterfaceDecoder(valueType reflect.Type, allowAddr bool) (ValueDecoder, bool) {
	for _, idec := range r.interfaceDecoders {
		if valueType.Implements(idec.i) {
			return idec.vd, true
		}
		if allowAddr && valueType.Kind() != reflect.Ptr && reflect.PtrTo(valueType).Implements(idec.i) {
			// if *t implements an interface, this will catch if t implements an interface further
			// ahead in interfaceDecoders
			defaultDec, found := r.lookupInterfaceDecoder(valueType, false)
			if !found {
				defaultDec, _ = r.kindDecoders.Load(valueType.Kind())
			}
			return newCondAddrDecoder(idec.vd, defaultDec), true
		}
	}
	return nil, false
}

// LookupTypeMapEntry inspects the registry's type map for a Go type for the corresponding BSON
// type. If no type is found, ErrNoTypeMapEntry is returned.
//
// LookupTypeMapEntry should not be called concurrently with any other Registry method.
func (r *Registry) LookupTypeMapEntry(bt bsontype.Type) (reflect.Type, error) {
	v, ok := r.typeMap.Load(bt)
	if v == nil || !ok {
		return nil, ErrNoTypeMapEntry{Type: bt}
	}
	return v.(reflect.Type), nil
}

type interfaceValueEncoder struct {
	i  reflect.Type
	ve ValueEncoder
}

type interfaceValueDecoder struct {
	i  reflect.Type
	vd ValueDecoder
}
