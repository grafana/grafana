package query

import (
	"fmt"
	"regexp"
)

var validFlagsRegExp = regexp.MustCompile("[imsU]+")

var RegExps = NewRegExpMap()

type RegExpMap struct {
	*SyncMap
}

func NewRegExpMap() RegExpMap {
	return RegExpMap{
		NewSyncMap(),
	}
}

func (rem RegExpMap) Store(key string, value *regexp.Regexp) {
	rem.store(key, value)
}

func (rem RegExpMap) Load(key string) (*regexp.Regexp, bool) {
	v, ok := rem.load(key)
	if ok {
		return v.(*regexp.Regexp), ok
	}
	return nil, ok
}

func (rem RegExpMap) Get(expr string) (*regexp.Regexp, error) {
	if v, ok := rem.Load(expr); ok {
		return v, nil
	}

	rem.lock()
	defer rem.unlock()

	if v, ok := rem.Load(expr); ok {
		return v, nil
	}

	re, err := regexp.Compile(expr)
	if err != nil {
		return nil, fmt.Errorf("failed to compile pattern %q", expr)
	}

	rem.Store(expr, re)
	return re, nil
}
