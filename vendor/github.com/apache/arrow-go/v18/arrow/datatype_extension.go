// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package arrow

import (
	"fmt"
	"reflect"
	"sync"
)

var (
	// global extension type registry, initially left null to avoid paying
	// the cost if no extension types are used.
	// the choice to use a sync.Map here is because it's expected that most
	// use cases would be to register some number of types at initialization
	// or otherwise and leave them rather than a pattern of repeatedly registering
	// and unregistering types. As per the documentation for sync.Map
	// (https://pkg.go.dev/sync#Map), it is specialized for the case where an entry
	// is written once but read many times which fits our case here as we register
	// a type once and then have to read it many times when deserializing messages
	// with that type.
	extTypeRegistry *sync.Map
	// used for initializing the registry once and only once
	initReg sync.Once
)

// convenience function to ensure that the type registry is initialized once
// and only once in a goroutine-safe manner.
func getExtTypeRegistry() *sync.Map {
	initReg.Do(func() { extTypeRegistry = &sync.Map{} })
	return extTypeRegistry
}

// RegisterExtensionType registers the provided ExtensionType by calling ExtensionName
// to use as a Key for registering the type. If a type with the same name is already
// registered then this will return an error saying so, otherwise it will return nil
// if successful registering the type.
// This function is safe to call from multiple goroutines simultaneously.
func RegisterExtensionType(typ ExtensionType) error {
	name := typ.ExtensionName()
	registry := getExtTypeRegistry()
	if _, existed := registry.LoadOrStore(name, typ); existed {
		return fmt.Errorf("arrow: type extension with name %s already defined", name)
	}
	return nil
}

// UnregisterExtensionType removes the type with the given name from the registry
// causing any messages with that type which come in to be expressed with their
// metadata and underlying type instead of the extension type that isn't known.
// This function is safe to call from multiple goroutines simultaneously.
func UnregisterExtensionType(typName string) error {
	registry := getExtTypeRegistry()
	if _, loaded := registry.LoadAndDelete(typName); !loaded {
		return fmt.Errorf("arrow: no type extension with name %s found", typName)
	}
	return nil
}

// GetExtensionType retrieves and returns the extension type of the given name
// from the global extension type registry. If the type isn't found it will return
// nil. This function is safe to call from multiple goroutines concurrently.
func GetExtensionType(typName string) ExtensionType {
	registry := getExtTypeRegistry()
	if val, ok := registry.Load(typName); ok {
		return val.(ExtensionType)
	}
	return nil
}

// ExtensionType is an interface for handling user-defined types. They must be
// DataTypes and must embed arrow.ExtensionBase in them in order to work properly
// ensuring that they always have the expected base behavior.
//
// The arrow.ExtensionBase that needs to be embedded implements the DataType interface
// leaving the remaining functions having to be implemented by the actual user-defined
// type in order to be handled properly.
type ExtensionType interface {
	DataType
	// ArrayType should return the reflect.TypeOf(ExtensionArrayType{}) where the
	// ExtensionArrayType is a type that implements the array.ExtensionArray interface.
	// Such a type must also embed the array.ExtensionArrayBase in it. This will be used
	// when creating arrays of this ExtensionType by using reflect.New
	ArrayType() reflect.Type
	// ExtensionName is what will be used when registering / unregistering this extension
	// type. Multiple user-defined types can be defined with a parameterized ExtensionType
	// as long as the parameter is used in the ExtensionName to distinguish the instances
	// in the global Extension Type registry.
	// The return from this is also what will be placed in the metadata for IPC communication
	// under the key ARROW:extension:name
	ExtensionName() string
	// StorageType returns the underlying storage type which is used by this extension
	// type. It is already implemented by the ExtensionBase struct and thus does not need
	// to be re-implemented by a user-defined type.
	StorageType() DataType
	// ExtensionEquals is used to tell whether two ExtensionType instances are equal types.
	ExtensionEquals(ExtensionType) bool
	// Serialize should produce any extra metadata necessary for initializing an instance of
	// this user-defined type. Not all user-defined types require this and it is valid to return
	// nil from this function or an empty slice. This is used for the IPC format and will be
	// added to metadata for IPC communication under the key ARROW:extension:metadata
	// This should be implemented such that it is valid to be called by multiple goroutines
	// concurrently.
	Serialize() string
	// Deserialize is called when reading in extension arrays and types via the IPC format
	// in order to construct an instance of the appropriate extension type. The passed in data
	// is pulled from the ARROW:extension:metadata key and may be nil or an empty slice.
	// If the storage type is incorrect or something else is invalid with the data this should
	// return nil and an appropriate error.
	Deserialize(storageType DataType, data string) (ExtensionType, error)

	mustEmbedExtensionBase()
}

// ExtensionBase is the base struct for user-defined Extension Types which must be
// embedded in any user-defined types like so:
//
//	type UserDefinedType struct {
//	    arrow.ExtensionBase
//	    // any other data
//	}
type ExtensionBase struct {
	// Storage is the underlying storage type
	Storage DataType
}

// ID always returns arrow.EXTENSION and should not be overridden
func (*ExtensionBase) ID() Type { return EXTENSION }

// Name should always return "extension" and should not be overridden
func (*ExtensionBase) Name() string { return "extension" }

// String by default will return "extension_type<storage=storage_type>" by can be overridden
// to customize what is printed out when printing this extension type.
func (e *ExtensionBase) String() string { return fmt.Sprintf("extension_type<storage=%s>", e.Storage) }

// StorageType returns the underlying storage type and exists so that functions
// written against the ExtensionType interface can access the storage type.
func (e *ExtensionBase) StorageType() DataType { return e.Storage }

func (e *ExtensionBase) Fingerprint() string { return typeFingerprint(e) + e.Storage.Fingerprint() }

func (e *ExtensionBase) Fields() []Field {
	if nested, ok := e.Storage.(NestedType); ok {
		return nested.Fields()
	}
	return nil
}

func (e *ExtensionBase) NumFields() int {
	if nested, ok := e.Storage.(NestedType); ok {
		return nested.NumFields()
	}
	return 0
}

func (e *ExtensionBase) Layout() DataTypeLayout { return e.Storage.Layout() }

// this no-op exists to ensure that this type must be embedded in any user-defined extension type.
//
//lint:ignore U1000 this function is intentionally unused as it only exists to ensure embedding happens
func (ExtensionBase) mustEmbedExtensionBase() {}

var (
	_ DataType = (*ExtensionBase)(nil)
)
