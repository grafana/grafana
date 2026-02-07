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

func RegisterDateTimeParser(name string, constructor DateTimeParserConstructor) error {
	_, exists := dateTimeParsers[name]
	if exists {
		return fmt.Errorf("attempted to register duplicate date time parser named '%s'", name)
	}
	dateTimeParsers[name] = constructor
	return nil
}

type DateTimeParserConstructor func(config map[string]interface{}, cache *Cache) (analysis.DateTimeParser, error)
type DateTimeParserRegistry map[string]DateTimeParserConstructor

type DateTimeParserCache struct {
	*ConcurrentCache
}

func NewDateTimeParserCache() *DateTimeParserCache {
	return &DateTimeParserCache{
		NewConcurrentCache(),
	}
}

func DateTimeParserBuild(name string, config map[string]interface{}, cache *Cache) (interface{}, error) {
	cons, registered := dateTimeParsers[name]
	if !registered {
		return nil, fmt.Errorf("no date time parser with name or type '%s' registered", name)
	}
	dateTimeParser, err := cons(config, cache)
	if err != nil {
		return nil, fmt.Errorf("error building date time parser: %v", err)
	}
	return dateTimeParser, nil
}

func (c *DateTimeParserCache) DateTimeParserNamed(name string, cache *Cache) (analysis.DateTimeParser, error) {
	item, err := c.ItemNamed(name, cache, DateTimeParserBuild)
	if err != nil {
		return nil, err
	}
	return item.(analysis.DateTimeParser), nil
}

func (c *DateTimeParserCache) DefineDateTimeParser(name string, typ string, config map[string]interface{}, cache *Cache) (analysis.DateTimeParser, error) {
	item, err := c.DefineItem(name, typ, config, cache, DateTimeParserBuild)
	if err != nil {
		if err == ErrAlreadyDefined {
			return nil, fmt.Errorf("date time parser named '%s' already defined", name)
		}
		return nil, err
	}
	return item.(analysis.DateTimeParser), nil
}

func DateTimeParserTypesAndInstances() ([]string, []string) {
	emptyConfig := map[string]interface{}{}
	emptyCache := NewCache()
	var types []string
	var instances []string
	for name, cons := range dateTimeParsers {
		_, err := cons(emptyConfig, emptyCache)
		if err == nil {
			instances = append(instances, name)
		} else {
			types = append(types, name)
		}
	}
	return types, instances
}
