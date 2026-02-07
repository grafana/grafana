package binding

import "fmt"

// Bindings stores let expression bindings by name.
type Bindings interface {
	// Get returns the value bound for a given name.
	Get(string) (interface{}, error)
	// Register registers a value associated with a given name, it returns a new binding
	Register(string, interface{}) Bindings
}

type bindings struct {
	values map[string]interface{}
}

func NewBindings() Bindings {
	return bindings{}
}

func (b bindings) Get(name string) (interface{}, error) {
	if value, ok := b.values[name]; ok {
		return value, nil
	}
	return nil, fmt.Errorf("variable not defined: %s", name)
}

func (b bindings) Register(name string, value interface{}) Bindings {
	values := map[string]interface{}{}
	for k, v := range b.values {
		values[k] = v
	}
	values[name] = value
	return bindings{
		values: values,
	}
}
