package openapi3

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/go-openapi/jsonpointer"
)

// NewResponsesWithCapacity builds a responses object of the given capacity.
func NewResponsesWithCapacity(cap int) *Responses {
	if cap == 0 {
		return &Responses{m: make(map[string]*ResponseRef)}
	}
	return &Responses{m: make(map[string]*ResponseRef, cap)}
}

// Value returns the responses for key or nil
func (responses *Responses) Value(key string) *ResponseRef {
	if responses.Len() == 0 {
		return nil
	}
	return responses.m[key]
}

// Set adds or replaces key 'key' of 'responses' with 'value'.
// Note: 'responses' MUST be non-nil
func (responses *Responses) Set(key string, value *ResponseRef) {
	if responses.m == nil {
		responses.m = make(map[string]*ResponseRef)
	}
	responses.m[key] = value
}

// Len returns the amount of keys in responses excluding responses.Extensions.
func (responses *Responses) Len() int {
	if responses == nil || responses.m == nil {
		return 0
	}
	return len(responses.m)
}

// Delete removes the entry associated with key 'key' from 'responses'.
func (responses *Responses) Delete(key string) {
	if responses != nil && responses.m != nil {
		delete(responses.m, key)
	}
}

// Map returns responses as a 'map'.
// Note: iteration on Go maps is not ordered.
func (responses *Responses) Map() (m map[string]*ResponseRef) {
	if responses == nil || len(responses.m) == 0 {
		return make(map[string]*ResponseRef)
	}
	m = make(map[string]*ResponseRef, len(responses.m))
	for k, v := range responses.m {
		m[k] = v
	}
	return
}

var _ jsonpointer.JSONPointable = (*Responses)(nil)

// JSONLookup implements https://github.com/go-openapi/jsonpointer#JSONPointable
func (responses Responses) JSONLookup(token string) (any, error) {
	if v := responses.Value(token); v == nil {
		vv, _, err := jsonpointer.GetForToken(responses.Extensions, token)
		return vv, err
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

// MarshalYAML returns the YAML encoding of Responses.
func (responses *Responses) MarshalYAML() (any, error) {
	if responses == nil {
		return nil, nil
	}
	m := make(map[string]any, responses.Len()+len(responses.Extensions))
	for k, v := range responses.Extensions {
		m[k] = v
	}
	for k, v := range responses.Map() {
		m[k] = v
	}
	return m, nil
}

// MarshalJSON returns the JSON encoding of Responses.
func (responses *Responses) MarshalJSON() ([]byte, error) {
	responsesYaml, err := responses.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(responsesYaml)
}

// UnmarshalJSON sets Responses to a copy of data.
func (responses *Responses) UnmarshalJSON(data []byte) (err error) {
	var m map[string]any
	if err = json.Unmarshal(data, &m); err != nil {
		return
	}

	ks := make([]string, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	sort.Strings(ks)

	x := Responses{
		Extensions: make(map[string]any),
		m:          make(map[string]*ResponseRef, len(m)),
	}

	for _, k := range ks {
		v := m[k]
		if strings.HasPrefix(k, "x-") {
			x.Extensions[k] = v
			continue
		}

		if k == originKey {
			var data []byte
			if data, err = json.Marshal(v); err != nil {
				return
			}
			if err = json.Unmarshal(data, &x.Origin); err != nil {
				return
			}
			continue
		}

		var data []byte
		if data, err = json.Marshal(v); err != nil {
			return
		}
		var vv ResponseRef
		if err = vv.UnmarshalJSON(data); err != nil {
			return
		}
		x.m[k] = &vv
	}
	*responses = x
	return
}

// NewCallbackWithCapacity builds a callback object of the given capacity.
func NewCallbackWithCapacity(cap int) *Callback {
	if cap == 0 {
		return &Callback{m: make(map[string]*PathItem)}
	}
	return &Callback{m: make(map[string]*PathItem, cap)}
}

// Value returns the callback for key or nil
func (callback *Callback) Value(key string) *PathItem {
	if callback.Len() == 0 {
		return nil
	}
	return callback.m[key]
}

// Set adds or replaces key 'key' of 'callback' with 'value'.
// Note: 'callback' MUST be non-nil
func (callback *Callback) Set(key string, value *PathItem) {
	if callback.m == nil {
		callback.m = make(map[string]*PathItem)
	}
	callback.m[key] = value
}

// Len returns the amount of keys in callback excluding callback.Extensions.
func (callback *Callback) Len() int {
	if callback == nil || callback.m == nil {
		return 0
	}
	return len(callback.m)
}

// Delete removes the entry associated with key 'key' from 'callback'.
func (callback *Callback) Delete(key string) {
	if callback != nil && callback.m != nil {
		delete(callback.m, key)
	}
}

// Map returns callback as a 'map'.
// Note: iteration on Go maps is not ordered.
func (callback *Callback) Map() (m map[string]*PathItem) {
	if callback == nil || len(callback.m) == 0 {
		return make(map[string]*PathItem)
	}
	m = make(map[string]*PathItem, len(callback.m))
	for k, v := range callback.m {
		m[k] = v
	}
	return
}

var _ jsonpointer.JSONPointable = (*Callback)(nil)

// JSONLookup implements https://github.com/go-openapi/jsonpointer#JSONPointable
func (callback Callback) JSONLookup(token string) (any, error) {
	if v := callback.Value(token); v == nil {
		vv, _, err := jsonpointer.GetForToken(callback.Extensions, token)
		return vv, err
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v, nil
	}
}

// MarshalYAML returns the YAML encoding of Callback.
func (callback *Callback) MarshalYAML() (any, error) {
	if callback == nil {
		return nil, nil
	}
	m := make(map[string]any, callback.Len()+len(callback.Extensions))
	for k, v := range callback.Extensions {
		m[k] = v
	}
	for k, v := range callback.Map() {
		m[k] = v
	}
	return m, nil
}

// MarshalJSON returns the JSON encoding of Callback.
func (callback *Callback) MarshalJSON() ([]byte, error) {
	callbackYaml, err := callback.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(callbackYaml)
}

// UnmarshalJSON sets Callback to a copy of data.
func (callback *Callback) UnmarshalJSON(data []byte) (err error) {
	var m map[string]any
	if err = json.Unmarshal(data, &m); err != nil {
		return
	}

	ks := make([]string, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	sort.Strings(ks)

	x := Callback{
		Extensions: make(map[string]any),
		m:          make(map[string]*PathItem, len(m)),
	}

	for _, k := range ks {
		v := m[k]
		if strings.HasPrefix(k, "x-") {
			x.Extensions[k] = v
			continue
		}

		if k == originKey {
			var data []byte
			if data, err = json.Marshal(v); err != nil {
				return
			}
			if err = json.Unmarshal(data, &x.Origin); err != nil {
				return
			}
			continue
		}

		var data []byte
		if data, err = json.Marshal(v); err != nil {
			return
		}
		var vv PathItem
		if err = vv.UnmarshalJSON(data); err != nil {
			return
		}
		x.m[k] = &vv
	}
	*callback = x
	return
}

// NewPathsWithCapacity builds a paths object of the given capacity.
func NewPathsWithCapacity(cap int) *Paths {
	if cap == 0 {
		return &Paths{m: make(map[string]*PathItem)}
	}
	return &Paths{m: make(map[string]*PathItem, cap)}
}

// Value returns the paths for key or nil
func (paths *Paths) Value(key string) *PathItem {
	if paths.Len() == 0 {
		return nil
	}
	return paths.m[key]
}

// Set adds or replaces key 'key' of 'paths' with 'value'.
// Note: 'paths' MUST be non-nil
func (paths *Paths) Set(key string, value *PathItem) {
	if paths.m == nil {
		paths.m = make(map[string]*PathItem)
	}
	paths.m[key] = value
}

// Len returns the amount of keys in paths excluding paths.Extensions.
func (paths *Paths) Len() int {
	if paths == nil || paths.m == nil {
		return 0
	}
	return len(paths.m)
}

// Delete removes the entry associated with key 'key' from 'paths'.
func (paths *Paths) Delete(key string) {
	if paths != nil && paths.m != nil {
		delete(paths.m, key)
	}
}

// Map returns paths as a 'map'.
// Note: iteration on Go maps is not ordered.
func (paths *Paths) Map() (m map[string]*PathItem) {
	if paths == nil || len(paths.m) == 0 {
		return make(map[string]*PathItem)
	}
	m = make(map[string]*PathItem, len(paths.m))
	for k, v := range paths.m {
		m[k] = v
	}
	return
}

var _ jsonpointer.JSONPointable = (*Paths)(nil)

// JSONLookup implements https://github.com/go-openapi/jsonpointer#JSONPointable
func (paths Paths) JSONLookup(token string) (any, error) {
	if v := paths.Value(token); v == nil {
		vv, _, err := jsonpointer.GetForToken(paths.Extensions, token)
		return vv, err
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v, nil
	}
}

// MarshalYAML returns the YAML encoding of Paths.
func (paths *Paths) MarshalYAML() (any, error) {
	if paths == nil {
		return nil, nil
	}
	m := make(map[string]any, paths.Len()+len(paths.Extensions))
	for k, v := range paths.Extensions {
		m[k] = v
	}
	for k, v := range paths.Map() {
		m[k] = v
	}
	return m, nil
}

// MarshalJSON returns the JSON encoding of Paths.
func (paths *Paths) MarshalJSON() ([]byte, error) {
	pathsYaml, err := paths.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(pathsYaml)
}

// UnmarshalJSON sets Paths to a copy of data.
func (paths *Paths) UnmarshalJSON(data []byte) (err error) {
	var m map[string]any
	if err = json.Unmarshal(data, &m); err != nil {
		return
	}

	ks := make([]string, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	sort.Strings(ks)

	x := Paths{
		Extensions: make(map[string]any),
		m:          make(map[string]*PathItem, len(m)),
	}

	for _, k := range ks {
		v := m[k]
		if strings.HasPrefix(k, "x-") {
			x.Extensions[k] = v
			continue
		}

		if k == originKey {
			var data []byte
			if data, err = json.Marshal(v); err != nil {
				return
			}
			if err = json.Unmarshal(data, &x.Origin); err != nil {
				return
			}
			continue
		}

		var data []byte
		if data, err = json.Marshal(v); err != nil {
			return
		}
		var vv PathItem
		if err = vv.UnmarshalJSON(data); err != nil {
			return
		}
		x.m[k] = &vv
	}
	*paths = x
	return
}
