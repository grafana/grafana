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

	"github.com/blevesearch/bleve/v2/analysis"
)

func RegisterCharFilter(name string, constructor CharFilterConstructor) error {
	_, exists := charFilters[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate char filter named '%s'", name)
	}
	charFilters[name] = constructor
	return nil
}

type CharFilterConstructor func(config map[string]interface{}, cache *Cache) (analysis.CharFilter, error)
type CharFilterRegistry map[string]CharFilterConstructor

type CharFilterCache struct {
	*ConcurrentCache
}

func NewCharFilterCache() *CharFilterCache {
	return &CharFilterCache{
		NewConcurrentCache(),
	}
}

func CharFilterBuild(name string, config map[string]interface{}, cache *Cache) (interface{}, error) {
	cons, registered := charFilters[name]
	if !registered {
		return nil, fmt.Errorf("no char filter with name or type '%s' registered", name)
	}
	charFilter, err := cons(config, cache)
	if err != nil {
		return nil, fmt.Errorf("error building char filter: %v", err)
	}
	return charFilter, nil
}

func (c *CharFilterCache) CharFilterNamed(name string, cache *Cache) (analysis.CharFilter, error) {
	item, err := c.ItemNamed(name, cache, CharFilterBuild)
	if err != nil {
		return nil, err
	}
	return item.(analysis.CharFilter), nil
}

func (c *CharFilterCache) DefineCharFilter(name string, typ string, config map[string]interface{}, cache *Cache) (analysis.CharFilter, error) {
	item, err := c.DefineItem(name, typ, config, cache, CharFilterBuild)
	if err != nil {
		if err == ErrAlreadyDefined {
			return nil, fmt.Errorf("char filter named '%s' already defined", name)
		}
		return nil, err
	}
	return item.(analysis.CharFilter), nil
}

func CharFilterTypesAndInstances() ([]string, []string) {
	emptyConfig := map[string]interface{}{}
	emptyCache := NewCache()
	var types []string
	var instances []string
	for name, cons := range charFilters {
		_, err := cons(emptyConfig, emptyCache)
		if err == nil {
			instances = append(instances, name)
		} else {
			types = append(types, name)
		}
	}
	return types, instances
}
