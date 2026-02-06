package kv

import (
	"context"
	"fmt"
	"strings"
)

type prefixedKVClient struct {
	prefix string
	client Client
}

// PrefixClient takes a KVClient and forces a prefix on all its operations.
func PrefixClient(client Client, prefix string) Client {
	return &prefixedKVClient{prefix, client}
}

// List returns a list of keys under a given prefix.
func (c *prefixedKVClient) List(ctx context.Context, prefix string) ([]string, error) {
	keys, err := c.client.List(ctx, c.prefix+prefix)
	if err != nil {
		return nil, err
	}

	// Remove the prefix from the returned key. The prefix attached to the
	// prefixed client is supposed to be transparent and the values returned
	// by List should be able to be immediately inserted into the Get
	// function, which means that our injected prefix needs to be removed.
	for i := range keys {
		keys[i] = strings.TrimPrefix(keys[i], c.prefix)
	}

	return keys, nil
}

// CAS atomically modifies a value in a callback. If the value doesn't exist,
// you'll get 'nil' as an argument to your callback.
func (c *prefixedKVClient) CAS(ctx context.Context, key string, f func(in interface{}) (out interface{}, retry bool, err error)) error {
	return c.client.CAS(ctx, c.prefix+key, f)
}

// WatchKey watches a key.
func (c *prefixedKVClient) WatchKey(ctx context.Context, key string, f func(interface{}) bool) {
	c.client.WatchKey(ctx, c.prefix+key, f)
}

// WatchPrefix watches a prefix. For a prefix client it appends the prefix argument to the clients prefix.
func (c *prefixedKVClient) WatchPrefix(ctx context.Context, prefix string, f func(string, interface{}) bool) {
	c.client.WatchPrefix(ctx, fmt.Sprintf("%s%s", c.prefix, prefix), func(k string, i interface{}) bool {
		return f(strings.TrimPrefix(k, c.prefix), i)
	})
}

// Get looks up a given object from its key.
func (c *prefixedKVClient) Get(ctx context.Context, key string) (interface{}, error) {
	return c.client.Get(ctx, c.prefix+key)
}

// Delete removes a given object from its key.
func (c *prefixedKVClient) Delete(ctx context.Context, key string) error {
	return c.client.Delete(ctx, c.prefix+key)
}
