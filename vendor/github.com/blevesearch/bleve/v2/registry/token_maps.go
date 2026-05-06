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

func RegisterTokenMap(name string, constructor TokenMapConstructor) error {
	_, exists := tokenMaps[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate token map named '%s'", name)
	}
	tokenMaps[name] = constructor
	return nil
}

type TokenMapConstructor func(config map[string]interface{}, cache *Cache) (analysis.TokenMap, error)
type TokenMapRegistry map[string]TokenMapConstructor

type TokenMapCache struct {
	*ConcurrentCache
}

func NewTokenMapCache() *TokenMapCache {
	return &TokenMapCache{
		NewConcurrentCache(),
	}
}

func TokenMapBuild(name string, config map[string]interface{}, cache *Cache) (interface{}, error) {
	cons, registered := tokenMaps[name]
	if !registered {
		return nil, fmt.Errorf("no token map with name or type '%s' registered", name)
	}
	tokenMap, err := cons(config, cache)
	if err != nil {
		return nil, fmt.Errorf("error building token map: %v", err)
	}
	return tokenMap, nil
}

func (c *TokenMapCache) TokenMapNamed(name string, cache *Cache) (analysis.TokenMap, error) {
	item, err := c.ItemNamed(name, cache, TokenMapBuild)
	if err != nil {
		return nil, err
	}
	return item.(analysis.TokenMap), nil
}

func (c *TokenMapCache) DefineTokenMap(name string, typ string, config map[string]interface{}, cache *Cache) (analysis.TokenMap, error) {
	item, err := c.DefineItem(name, typ, config, cache, TokenMapBuild)
	if err != nil {
		if err == ErrAlreadyDefined {
			return nil, fmt.Errorf("token map named '%s' already defined", name)
		}
		return nil, err
	}
	return item.(analysis.TokenMap), nil
}

func TokenMapTypesAndInstances() ([]string, []string) {
	emptyConfig := map[string]interface{}{}
	emptyCache := NewCache()
	var types []string
	var instances []string
	for name, cons := range tokenMaps {
		_, err := cons(emptyConfig, emptyCache)
		if err == nil {
			instances = append(instances, name)
		} else {
			types = append(types, name)
		}
	}
	return types, instances
}
