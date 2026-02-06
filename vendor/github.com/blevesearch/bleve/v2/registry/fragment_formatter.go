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

func RegisterFragmentFormatter(name string, constructor FragmentFormatterConstructor) error {
	_, exists := fragmentFormatters[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate fragment formatter named '%s'", name)
	}
	fragmentFormatters[name] = constructor
	return nil
}

type FragmentFormatterConstructor func(config map[string]interface{}, cache *Cache) (highlight.FragmentFormatter, error)
type FragmentFormatterRegistry map[string]FragmentFormatterConstructor

type FragmentFormatterCache struct {
	*ConcurrentCache
}

func NewFragmentFormatterCache() *FragmentFormatterCache {
	return &FragmentFormatterCache{
		NewConcurrentCache(),
	}
}

func FragmentFormatterBuild(name string, config map[string]interface{}, cache *Cache) (interface{}, error) {
	cons, registered := fragmentFormatters[name]
	if !registered {
		return nil, fmt.Errorf("no fragment formatter with name or type '%s' registered", name)
	}
	fragmentFormatter, err := cons(config, cache)
	if err != nil {
		return nil, fmt.Errorf("error building fragment formatter: %v", err)
	}
	return fragmentFormatter, nil
}

func (c *FragmentFormatterCache) FragmentFormatterNamed(name string, cache *Cache) (highlight.FragmentFormatter, error) {
	item, err := c.ItemNamed(name, cache, FragmentFormatterBuild)
	if err != nil {
		return nil, err
	}
	return item.(highlight.FragmentFormatter), nil
}

func (c *FragmentFormatterCache) DefineFragmentFormatter(name string, typ string, config map[string]interface{}, cache *Cache) (highlight.FragmentFormatter, error) {
	item, err := c.DefineItem(name, typ, config, cache, FragmentFormatterBuild)
	if err != nil {
		if err == ErrAlreadyDefined {
			return nil, fmt.Errorf("fragment formatter named '%s' already defined", name)
		}
		return nil, err
	}
	return item.(highlight.FragmentFormatter), nil
}

func FragmentFormatterTypesAndInstances() ([]string, []string) {
	emptyConfig := map[string]interface{}{}
	emptyCache := NewCache()
	var types []string
	var instances []string
	for name, cons := range fragmentFormatters {
		_, err := cons(emptyConfig, emptyCache)
		if err == nil {
			instances = append(instances, name)
		} else {
			types = append(types, name)
		}
	}
	return types, instances
}
