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
var ErrNilType = errors.New("cannot perform a decoder lookup on <nil>")

// ErrNotPointer is returned when a non-pointer type is provided to LookupDecoder.
var ErrNotPointer = errors.New("non-pointer provided to LookupDecoder")

// ErrNoEncoder is returned when there wasn't an encoder available for a type.
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
type ErrNoDecoder struct {
	Type reflect.Type
}

func (end ErrNoDecoder) Error() string {
	return "no decoder found for " + end.Type.String()
}

// ErrNoTypeMapEntry is returned when there wasn't a type available for the provided BSON type.
type ErrNoTypeMapEntry struct {
	Type bsontype.Type
}

func (entme ErrNoTypeMapEntry) Error() string {
	return "no type map entry found for " + entme.Type.String()
}

// ErrNotInterface is returned when the provided type is not an interface.
var ErrNotInterface = errors.New("The provided type is not an interface")

var defaultRegistry *Registry

func init() {
	defaultRegistry = buildDefaultRegistry()
}

// A RegistryBuilder is used to build a Registry. This type is not goroutine
// safe.
type RegistryBuilder struct {
	typeEncoders      map[reflect.Type]ValueEncoder
	interfaceEncoders []interfaceValueEncoder
	kindEncoders      map[reflect.Kind]ValueEncoder

	typeDecoders      map[reflect.Type]ValueDecoder
	interfaceDecoders []interfaceValueDecoder
	kindDecoders      map[reflect.Kind]ValueDecoder

	typeMap map[bsontype.Type]reflect.Type
}

// A Registry is used to store and retrieve codecs for types and interfaces. This type is the main
// typed passed around and Encoders and Decoders are constructed from it.
type Registry struct {
	typeEncoders map[reflect.Type]ValueEncoder
	typeDecoders map[reflect.Type]ValueDecoder

	interfaceEncoders []interfaceValueEncoder
	interfaceDecoders []interfaceValueDecoder

	kindEncoders map[reflect.Kind]ValueEncoder
	kindDecoders map[reflect.Kind]ValueDecoder

	typeMap map[bsontype.Type]reflect.Type

	mu sync.RWMutex
}

// NewRegistryBuilder creates a new empty RegistryBuilder.
func NewRegistryBuilder() *RegistryBuilder {
	return &RegistryBuilder{
		typeEncoders: make(map[reflect.Type]ValueEncoder),
		typeDecoders: make(map[reflect.Type]ValueDecoder),

		interfaceEncoders: make([]interfaceValueEncoder, 0),
		interfaceDecoders: make([]interfaceValueDecoder, 0),

		kindEncoders: make(map[reflect.Kind]ValueEncoder),
		kindDecoders: make(map[reflect.Kind]ValueDecoder),

		typeMap: make(map[bsontype.Type]reflect.Type),
	}
}

func buildDefaultRegistry() *Registry {
	rb := NewRegistryBuilder()
	defaultValueEncoders.RegisterDefaultEncoders(rb)
	defaultValueDecoders.RegisterDefaultDecoders(rb)
	return rb.Build()
}

// RegisterCodec will register the provided ValueCodec for the provided type.
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
// If the given type is an interface, the encoder will be called when marshalling a type that is that interface. It
// will not be called when marshalling a non-interface type that implements the interface.
func (rb *RegistryBuilder) RegisterTypeEncoder(t reflect.Type, enc ValueEncoder) *RegistryBuilder {
	rb.typeEncoders[t] = enc
	return rb
}

// RegisterHookEncoder will register an encoder for the provided interface type t. This encoder will be called when
// marshalling a type if the type implements t or a pointer to the type implements t. If the provided type is not
// an interface (i.e. t.Kind() != reflect.Interface), this method will panic.
func (rb *RegistryBuilder) RegisterHookEncoder(t reflect.Type, enc ValueEncoder) *RegistryBuilder {
	if t.Kind() != reflect.Interface {
		panicStr := fmt.Sprintf("RegisterHookEncoder expects a type with kind reflect.Interface, "+
			"got type %s with kind %s", t, t.Kind())
		panic(panicStr)
	}

	for idx, encoder := range rb.interfaceEncoders {
		if encoder.i == t {
			rb.interfaceEncoders[idx].ve = enc
			return rb
		}
	}

	rb.interfaceEncoders = append(rb.interfaceEncoders, interfaceValueEncoder{i: t, ve: enc})
	return rb
}

// RegisterTypeDecoder will register the provided ValueDecoder for the provided type.
//
// The type will be used directly, so a decoder can be registered for a type and a different decoder can be registered
// for a pointer to that type.
//
// If the given type is an interface, the decoder will be called when unmarshalling into a type that is that interface.
// It will not be called when unmarshalling into a non-interface type that implements the interface.
func (rb *RegistryBuilder) RegisterTypeDecoder(t reflect.Type, dec ValueDecoder) *RegistryBuilder {
	rb.typeDecoders[t] = dec
	return rb
}

// RegisterHookDecoder will register an decoder for the provided interface type t. This decoder will be called when
// unmarshalling into a type if the type implements t or a pointer to the type implements t. If the provided type is not
// an interface (i.e. t.Kind() != reflect.Interface), this method will panic.
func (rb *RegistryBuilder) RegisterHookDecoder(t reflect.Type, dec ValueDecoder) *RegistryBuilder {
	if t.Kind() != reflect.Interface {
		panicStr := fmt.Sprintf("RegisterHookDecoder expects a type with kind reflect.Interface, "+
			"got type %s with kind %s", t, t.Kind())
		panic(panicStr)
	}

	for idx, decoder := range rb.interfaceDecoders {
		if decoder.i == t {
			rb.interfaceDecoders[idx].vd = dec
			return rb
		}
	}

	rb.interfaceDecoders = append(rb.interfaceDecoders, interfaceValueDecoder{i: t, vd: dec})
	return rb
}

// RegisterEncoder has been deprecated and will be removed in a future major version release. Use RegisterTypeEncoder
// or RegisterHookEncoder instead.
func (rb *RegistryBuilder) RegisterEncoder(t reflect.Type, enc ValueEncoder) *RegistryBuilder {
	if t == tEmpty {
		rb.typeEncoders[t] = enc
		return rb
	}
	switch t.Kind() {
	case reflect.Interface:
		for idx, ir := range rb.interfaceEncoders {
			if ir.i == t {
				rb.interfaceEncoders[idx].ve = enc
				return rb
			}
		}

		rb.interfaceEncoders = append(rb.interfaceEncoders, interfaceValueEncoder{i: t, ve: enc})
	default:
		rb.typeEncoders[t] = enc
	}
	return rb
}

// RegisterDecoder has been deprecated and will be removed in a future major version release. Use RegisterTypeDecoder
// or RegisterHookDecoder instead.
func (rb *RegistryBuilder) RegisterDecoder(t reflect.Type, dec ValueDecoder) *RegistryBuilder {
	if t == nil {
		rb.typeDecoders[nil] = dec
		return rb
	}
	if t == tEmpty {
		rb.typeDecoders[t] = dec
		return rb
	}
	switch t.Kind() {
	case reflect.Interface:
		for idx, ir := range rb.interfaceDecoders {
			if ir.i == t {
				rb.interfaceDecoders[idx].vd = dec
				return rb
			}
		}

		rb.interfaceDecoders = append(rb.interfaceDecoders, interfaceValueDecoder{i: t, vd: dec})
	default:
		rb.typeDecoders[t] = dec
	}
	return rb
}

// RegisterDefaultEncoder will registr the provided ValueEncoder to the provided
// kind.
func (rb *RegistryBuilder) RegisterDefaultEncoder(kind reflect.Kind, enc ValueEncoder) *RegistryBuilder {
	rb.kindEncoders[kind] = enc
	return rb
}

// RegisterDefaultDecoder will register the provided ValueDecoder to the
// provided kind.
func (rb *RegistryBuilder) RegisterDefaultDecoder(kind reflect.Kind, dec ValueDecoder) *RegistryBuilder {
	rb.kindDecoders[kind] = dec
	return rb
}

// RegisterTypeMapEntry will register the provided type to the BSON type. The primary usage for this
// mapping is decoding situations where an empty interface is used and a default type needs to be
// created and decoded into.
//
// By default, BSON documents will decode into interface{} values as bson.D. To change the default type for BSON
// documents, a type map entry for bsontype.EmbeddedDocument should be registered. For example, to force BSON documents
// to decode to bson.Raw, use the following code:
//	rb.RegisterTypeMapEntry(bsontype.EmbeddedDocument, reflect.TypeOf(bson.Raw{}))
func (rb *RegistryBuilder) RegisterTypeMapEntry(bt bsontype.Type, rt reflect.Type) *RegistryBuilder {
	rb.typeMap[bt] = rt
	return rb
}

// Build creates a Registry from the current state of this RegistryBuilder.
func (rb *RegistryBuilder) Build() *Registry {
	registry := new(Registry)

	registry.typeEncoders = make(map[reflect.Type]ValueEncoder)
	for t, enc := range rb.typeEncoders {
		registry.typeEncoders[t] = enc
	}

	registry.typeDecoders = make(map[reflect.Type]ValueDecoder)
	for t, dec := range rb.typeDecoders {
		registry.typeDecoders[t] = dec
	}

	registry.interfaceEncoders = make([]interfaceValueEncoder, len(rb.interfaceEncoders))
	copy(registry.interfaceEncoders, rb.interfaceEncoders)

	registry.interfaceDecoders = make([]interfaceValueDecoder, len(rb.interfaceDecoders))
	copy(registry.interfaceDecoders, rb.interfaceDecoders)

	registry.kindEncoders = make(map[reflect.Kind]ValueEncoder)
	for kind, enc := range rb.kindEncoders {
		registry.kindEncoders[kind] = enc
	}

	registry.kindDecoders = make(map[reflect.Kind]ValueDecoder)
	for kind, dec := range rb.kindDecoders {
		registry.kindDecoders[kind] = dec
	}

	registry.typeMap = make(map[bsontype.Type]reflect.Type)
	for bt, rt := range rb.typeMap {
		registry.typeMap[bt] = rt
	}

	return registry
}

// LookupEncoder inspects the registry for an encoder for the given type. The lookup precendence works as follows:
//
// 1. An encoder registered for the exact type. If the given type represents an interface, an encoder registered using
// RegisterTypeEncoder for the interface will be selected.
//
// 2. An encoder registered using RegisterHookEncoder for an interface implemented by the type or by a pointer to the
// type.
//
// 3. An encoder registered for the reflect.Kind of the value.
//
// If no encoder is found, an error of type ErrNoEncoder is returned.
func (r *Registry) LookupEncoder(t reflect.Type) (ValueEncoder, error) {
	encodererr := ErrNoEncoder{Type: t}
	r.mu.RLock()
	enc, found := r.lookupTypeEncoder(t)
	r.mu.RUnlock()
	if found {
		if enc == nil {
			return nil, ErrNoEncoder{Type: t}
		}
		return enc, nil
	}

	enc, found = r.lookupInterfaceEncoder(t)
	if found {
		r.mu.Lock()
		r.typeEncoders[t] = enc
		r.mu.Unlock()
		return enc, nil
	}

	if t == nil {
		r.mu.Lock()
		r.typeEncoders[t] = nil
		r.mu.Unlock()
		return nil, encodererr
	}

	enc, found = r.kindEncoders[t.Kind()]
	if !found {
		r.mu.Lock()
		r.typeEncoders[t] = nil
		r.mu.Unlock()
		return nil, encodererr
	}

	r.mu.Lock()
	r.typeEncoders[t] = enc
	r.mu.Unlock()
	return enc, nil
}

func (r *Registry) lookupTypeEncoder(t reflect.Type) (ValueEncoder, bool) {
	enc, found := r.typeEncoders[t]
	return enc, found
}

func (r *Registry) lookupInterfaceEncoder(t reflect.Type) (ValueEncoder, bool) {
	if t == nil {
		return nil, false
	}
	for _, ienc := range r.interfaceEncoders {
		if t.Implements(ienc.i) || reflect.PtrTo(t).Implements(ienc.i) {
			return ienc.ve, true
		}
	}
	return nil, false
}

// LookupDecoder inspects the registry for an decoder for the given type. The lookup precendence works as follows:
//
// 1. A decoder registered for the exact type. If the given type represents an interface, a decoder registered using
// RegisterTypeDecoder for the interface will be selected.
//
// 2. A decoder registered using RegisterHookDecoder for an interface implemented by the type or by a pointer to the
// type.
//
// 3. A decoder registered for the reflect.Kind of the value.
//
// If no decoder is found, an error of type ErrNoDecoder is returned.
func (r *Registry) LookupDecoder(t reflect.Type) (ValueDecoder, error) {
	if t == nil {
		return nil, ErrNilType
	}
	decodererr := ErrNoDecoder{Type: t}
	r.mu.RLock()
	dec, found := r.lookupTypeDecoder(t)
	r.mu.RUnlock()
	if found {
		if dec == nil {
			return nil, ErrNoDecoder{Type: t}
		}
		return dec, nil
	}

	dec, found = r.lookupInterfaceDecoder(t)
	if found {
		r.mu.Lock()
		r.typeDecoders[t] = dec
		r.mu.Unlock()
		return dec, nil
	}

	dec, found = r.kindDecoders[t.Kind()]
	if !found {
		r.mu.Lock()
		r.typeDecoders[t] = nil
		r.mu.Unlock()
		return nil, decodererr
	}

	r.mu.Lock()
	r.typeDecoders[t] = dec
	r.mu.Unlock()
	return dec, nil
}

func (r *Registry) lookupTypeDecoder(t reflect.Type) (ValueDecoder, bool) {
	dec, found := r.typeDecoders[t]
	return dec, found
}

func (r *Registry) lookupInterfaceDecoder(t reflect.Type) (ValueDecoder, bool) {
	for _, idec := range r.interfaceDecoders {
		if !t.Implements(idec.i) && !reflect.PtrTo(t).Implements(idec.i) {
			continue
		}

		return idec.vd, true
	}
	return nil, false
}

// LookupTypeMapEntry inspects the registry's type map for a Go type for the corresponding BSON
// type. If no type is found, ErrNoTypeMapEntry is returned.
func (r *Registry) LookupTypeMapEntry(bt bsontype.Type) (reflect.Type, error) {
	t, ok := r.typeMap[bt]
	if !ok || t == nil {
		return nil, ErrNoTypeMapEntry{Type: bt}
	}
	return t, nil
}

type interfaceValueEncoder struct {
	i  reflect.Type
	ve ValueEncoder
}

type interfaceValueDecoder struct {
	i  reflect.Type
	vd ValueDecoder
}
