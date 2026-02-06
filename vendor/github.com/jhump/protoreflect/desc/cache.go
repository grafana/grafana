package desc

import (
	"sync"

	"google.golang.org/protobuf/reflect/protoreflect"
)

type descriptorCache interface {
	get(protoreflect.Descriptor) Descriptor
	put(protoreflect.Descriptor, Descriptor)
}

type lockingCache struct {
	cacheMu sync.RWMutex
	cache   mapCache
}

func (c *lockingCache) get(d protoreflect.Descriptor) Descriptor {
	c.cacheMu.RLock()
	defer c.cacheMu.RUnlock()
	return c.cache.get(d)
}

func (c *lockingCache) put(key protoreflect.Descriptor, val Descriptor) {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	c.cache.put(key, val)
}

func (c *lockingCache) withLock(fn func(descriptorCache)) {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	// Pass the underlying mapCache. We don't want fn to use
	// c.get or c.put sine we already have the lock. So those
	// methods would try to re-acquire and then deadlock!
	fn(c.cache)
}

type mapCache map[protoreflect.Descriptor]Descriptor

func (c mapCache) get(d protoreflect.Descriptor) Descriptor {
	return c[d]
}

func (c mapCache) put(key protoreflect.Descriptor, val Descriptor) {
	c[key] = val
}
