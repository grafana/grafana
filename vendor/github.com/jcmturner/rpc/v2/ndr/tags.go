package ndr

import (
	"fmt"
	"reflect"
	"strings"
)

const ndrNameSpace = "ndr"

type tags struct {
	Values []string
	Map    map[string]string
}

// parse the struct field tags and extract the ndr related ones.
// format of tag ndr:"value,key:value1,value2"
func parseTags(st reflect.StructTag) tags {
	s := st.Get(ndrNameSpace)
	t := tags{
		Values: []string{},
		Map:    make(map[string]string),
	}
	if s != "" {
		ndrTags := strings.Trim(s, `"`)
		for _, tag := range strings.Split(ndrTags, ",") {
			if strings.Contains(tag, ":") {
				m := strings.SplitN(tag, ":", 2)
				t.Map[m[0]] = m[1]
			} else {
				t.Values = append(t.Values, tag)
			}
		}
	}
	return t
}

func appendTag(t reflect.StructTag, s string) reflect.StructTag {
	ts := t.Get(ndrNameSpace)
	ts = fmt.Sprintf(`%s"%s,%s"`, ndrNameSpace, ts, s)
	return reflect.StructTag(ts)
}

func (t *tags) StructTag() reflect.StructTag {
	mv := t.Values
	for key, val := range t.Map {
		mv = append(mv, key+":"+val)
	}
	s := ndrNameSpace + ":" + `"` + strings.Join(mv, ",") + `"`
	return reflect.StructTag(s)
}

func (t *tags) delete(s string) {
	for i, x := range t.Values {
		if x == s {
			t.Values = append(t.Values[:i], t.Values[i+1:]...)
		}
	}
	delete(t.Map, s)
}

func (t *tags) HasValue(s string) bool {
	for _, v := range t.Values {
		if v == s {
			return true
		}
	}
	return false
}
