package json

import (
	"strings"
	"sync"
)

var Path = NewPathMap()
var Query = NewQueryMap()

type PathMap struct {
	m   *sync.Map
	mtx *sync.Mutex
}

func NewPathMap() PathMap {
	return PathMap{
		m:   &sync.Map{},
		mtx: &sync.Mutex{},
	}
}

func (pmap PathMap) store(key string, value PathExpression) {
	pmap.m.Store(key, value)
}

func (pmap PathMap) load(key string) (PathExpression, bool) {
	v, ok := pmap.m.Load(key)
	if ok && v != nil {
		return v.(PathExpression), ok
	}
	return nil, ok
}

func (pmap PathMap) Parse(s string) (PathExpression, error) {
	s = strings.TrimSpace(s)

	if e, ok := pmap.load(s); ok {
		return e, nil
	}

	pmap.mtx.Lock()
	defer pmap.mtx.Unlock()

	if e, ok := pmap.load(s); ok {
		return e, nil
	}

	e, err := ParsePath(s)
	if err != nil || e == nil {
		return nil, err
	}
	pmap.store(s, e)
	return e, nil
}

type QueryMap struct {
	m   *sync.Map
	mtx *sync.Mutex
}

func NewQueryMap() QueryMap {
	return QueryMap{
		m:   &sync.Map{},
		mtx: &sync.Mutex{},
	}
}

func (qmap QueryMap) store(key string, value QueryExpression) {
	qmap.m.Store(key, value)
}

func (qmap QueryMap) load(key string) (QueryExpression, bool) {
	v, ok := qmap.m.Load(key)
	if ok && v != nil {
		return v.(QueryExpression), ok
	}
	return nil, ok
}
func (qmap QueryMap) Parse(s string) (QueryExpression, error) {
	s = strings.TrimSpace(s)
	if len(s) < 1 {
		return nil, nil
	}

	if e, ok := qmap.load(s); ok {
		return e, nil
	}

	qmap.mtx.Lock()
	defer qmap.mtx.Unlock()

	if e, ok := qmap.load(s); ok {
		return e, nil
	}

	e, err := ParseQuery(s)
	if err != nil || e == nil {
		return nil, err
	}
	qmap.store(s, e)
	return e, nil
}
