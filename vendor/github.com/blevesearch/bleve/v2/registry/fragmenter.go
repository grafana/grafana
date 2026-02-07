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

	"github.com/blevesearch/bleve/v2/search/highlight"
)

func RegisterFragmenter(name string, constructor FragmenterConstructor) error {
	_, exists := fragmenters[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate fragmenter named '%s'", name)
	}
	fragmenters[name] = constructor
	return nil
}

type FragmenterConstructor func(config map[string]interface{}, cache *Cache) (highlight.Fragmenter, error)
type FragmenterRegistry map[string]FragmenterConstructor

type FragmenterCache struct {
	*ConcurrentCache
}

func NewFragmenterCache() *FragmenterCache {
	return &FragmenterCache{
		NewConcurrentCache(),
	}
}

func FragmenterBuild(name string, config map[string]interface{}, cache *Cache) (interface{}, error) {
	cons, registered := fragmenters[name]
	if !registered {
		return nil, fmt.Errorf("no fragmenter with name or type '%s' registered", name)
	}
	fragmenter, err := cons(config, cache)
	if err != nil {
		return nil, fmt.Errorf("error building fragmenter: %v", err)
	}
	return fragmenter, nil
}

func (c *FragmenterCache) FragmenterNamed(name string, cache *Cache) (highlight.Fragmenter, error) {
	item, err := c.ItemNamed(name, cache, FragmenterBuild)
	if err != nil {
		return nil, err
	}
	return item.(highlight.Fragmenter), nil
}

func (c *FragmenterCache) DefineFragmenter(name string, typ string, config map[string]interface{}, cache *Cache) (highlight.Fragmenter, error) {
	item, err := c.DefineItem(name, typ, config, cache, FragmenterBuild)
	if err != nil {
		if err == ErrAlreadyDefined {
			return nil, fmt.Errorf("fragmenter named '%s' already defined", name)
		}
		return nil, err
	}
	return item.(highlight.Fragmenter), nil
}

func FragmenterTypesAndInstances() ([]string, []string) {
	emptyConfig := map[string]interface{}{}
	emptyCache := NewCache()
	var types []string
	var instances []string
	for name, cons := range fragmenters {
		_, err := cons(emptyConfig, emptyCache)
		if err == nil {
			instances = append(instances, name)
		} else {
			types = append(types, name)
		}
	}
	return types, instances
}
