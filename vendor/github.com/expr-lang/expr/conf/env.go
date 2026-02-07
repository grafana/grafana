package conf

import (
	"fmt"
	"reflect"

	. "github.com/expr-lang/expr/checker/nature"
	"github.com/expr-lang/expr/internal/deref"
	"github.com/expr-lang/expr/types"
)

// Env returns the Nature of the given environment.
//
// Deprecated: use EnvWithCache instead.
func Env(env any) Nature {
	return EnvWithCache(new(Cache), env)
}

func EnvWithCache(c *Cache, env any) Nature {
	if env == nil {
		n := c.NatureOf(map[string]any{})
		n.Strict = true
		return n
	}

	switch env := env.(type) {
	case types.Map:
		nt := env.Nature()
		return nt
	}

	v := reflect.ValueOf(env)
	t := v.Type()

	switch deref.Value(v).Kind() {
	case reflect.Struct:
		n := c.FromType(t)
		n.Strict = true
		return n

	case reflect.Map:
		n := c.FromType(v.Type())
		if n.TypeData == nil {
			n.TypeData = new(TypeData)
		}
		n.Strict = true
		n.Fields = make(map[string]Nature, v.Len())

		for _, key := range v.MapKeys() {
			elem := v.MapIndex(key)
			if !elem.IsValid() || !elem.CanInterface() {
				panic(fmt.Sprintf("invalid map value: %s", key))
			}

			face := elem.Interface()

			switch face := face.(type) {
			case types.Map:
				nt := face.Nature()
				n.Fields[key.String()] = nt

			default:
				if face == nil {
					n.Fields[key.String()] = c.NatureOf(nil)
					continue
				}
				n.Fields[key.String()] = c.NatureOf(face)
			}

		}

		return n
	}

	panic(fmt.Sprintf("unknown type %T", env))
}
