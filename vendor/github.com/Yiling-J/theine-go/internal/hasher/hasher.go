//go:build !go1.24
// +build !go1.24

package hasher

import (
	"unsafe"

	"github.com/zeebo/xxh3"
)

type Hasher[K comparable] struct {
	ksize int
	kstr  bool
	kfunc func(K) string
}

func NewHasher[K comparable](stringKeyFunc func(K) string) *Hasher[K] {
	h := &Hasher[K]{kfunc: stringKeyFunc}
	var k K
	switch ((interface{})(k)).(type) {
	case string:
		h.kstr = true
	default:
		h.ksize = int(unsafe.Sizeof(k))
	}
	return h
}

func (h *Hasher[K]) Hash(key K) uint64 {
	var strKey string
	if h.kfunc != nil {
		strKey = h.kfunc(key)
	} else if h.kstr {
		strKey = *(*string)(unsafe.Pointer(&key))
	} else {
		strKey = *(*string)(unsafe.Pointer(&struct {
			data unsafe.Pointer
			len  int
		}{unsafe.Pointer(&key), h.ksize}))
	}
	return xxh3.HashString(strKey)
}
