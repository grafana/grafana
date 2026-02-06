//  Copyright (c) 2014 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package registry

import (
	"fmt"

	store "github.com/blevesearch/upsidedown_store_api"
)

func RegisterKVStore(name string, constructor KVStoreConstructor) error {
	_, exists := stores[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate store named '%s'", name)
	}
	stores[name] = constructor
	return nil
}

// KVStoreConstructor is used to build a KVStore of a specific type when
// specified by the index configuration. In addition to meeting the
// store.KVStore interface, KVStores must also support this constructor.
// Note that currently the values of config must
// be able to be marshaled and unmarshaled using the encoding/json library (used
// when reading/writing the index metadata file).
type KVStoreConstructor func(mo store.MergeOperator, config map[string]interface{}) (store.KVStore, error)
type KVStoreRegistry map[string]KVStoreConstructor

func KVStoreConstructorByName(name string) KVStoreConstructor {
	return stores[name]
}

func KVStoreTypesAndInstances() ([]string, []string) {
	var types []string
	var instances []string
	for name := range stores {
		types = append(types, name)
	}
	return types, instances
}
