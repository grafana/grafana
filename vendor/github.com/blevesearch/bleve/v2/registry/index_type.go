//  Copyright (c) 2015 Couchbase, Inc.
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

	index "github.com/blevesearch/bleve_index_api"
)

func RegisterIndexType(name string, constructor IndexTypeConstructor) error {
	_, exists := indexTypes[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate index encoding named '%s'", name)
	}
	indexTypes[name] = constructor
	return nil
}

type IndexTypeConstructor func(storeName string, storeConfig map[string]interface{}, analysisQueue *index.AnalysisQueue) (index.Index, error)
type IndexTypeRegistry map[string]IndexTypeConstructor

func IndexTypeConstructorByName(name string) IndexTypeConstructor {
	return indexTypes[name]
}

func IndexTypesAndInstances() ([]string, []string) {
	var types []string
	var instances []string
	for name := range indexTypes {
		types = append(types, name)
	}
	return types, instances
}
