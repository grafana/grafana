//  Copyright (c) 2016 Couchbase, Inc.
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
	"sync"
)

var ErrAlreadyDefined = fmt.Errorf("item already defined")

type CacheBuild func(name string, config map[string]interface{}, cache *Cache) (interface{}, error)

type ConcurrentCache struct {
	mutex sync.RWMutex
	data  map[string]interface{}
}

func NewConcurrentCache() *ConcurrentCache {
	return &ConcurrentCache{
		data: make(map[string]interface{}),
	}
}

func (c *ConcurrentCache) ItemNamed(name string, cache *Cache, build CacheBuild) (interface{}, error) {
	c.mutex.RLock()
	item, cached := c.data[name]
	if cached {
		c.mutex.RUnlock()
		return item, nil
	}
	// give up read lock
	c.mutex.RUnlock()
	// try to build it
	newItem, err := build(name, nil, cache)
	if err != nil {
		return nil, err
	}
	// acquire write lock
	c.mutex.Lock()
	defer c.mutex.Unlock()
	// check again because it could have been created while trading locks
	item, cached = c.data[name]
	if cached {
		return item, nil
	}
	c.data[name] = newItem
	return newItem, nil
}

func (c *ConcurrentCache) DefineItem(name string, typ string, config map[string]interface{}, cache *Cache, build CacheBuild) (interface{}, error) {
	c.mutex.RLock()
	_, cached := c.data[name]
	if cached {
		c.mutex.RUnlock()
		return nil, ErrAlreadyDefined
	}
	// give up read lock so others lookups can proceed
	c.mutex.RUnlock()
	// really not there, try to build it
	newItem, err := build(typ, config, cache)
	if err != nil {
		return nil, err
	}
	// now we've built it, acquire lock
	c.mutex.Lock()
	defer c.mutex.Unlock()
	// check again because it could have been created while trading locks
	_, cached = c.data[name]
	if cached {
		return nil, ErrAlreadyDefined
	}
	c.data[name] = newItem
	return newItem, nil
}
