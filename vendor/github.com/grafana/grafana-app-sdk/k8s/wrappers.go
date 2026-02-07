package k8s

import (
	"bytes"
	"encoding/json"
	"reflect"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/resource"
)

// TypedObjectWrapper wraps a resource.Object in a runtime.Object interface, and exposes a ResourceObject() method
// to get the wrapped object.
type TypedObjectWrapper struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`
	object            resource.Object
}

// DeepCopyObject copies the object
func (o *TypedObjectWrapper) DeepCopyObject() runtime.Object {
	val := reflect.ValueOf(o).Elem()

	cpy := reflect.New(val.Type())
	cpy.Elem().Set(val)

	// Using the <obj>, <ok> for the type conversion ensures that it doesn't panic if it can't be converted
	if obj, ok := cpy.Interface().(runtime.Object); ok {
		return obj
	}

	// TODO: better return than nil?
	return nil
}

// ResourceObject returns the wrapped resource.Object
func (o *TypedObjectWrapper) ResourceObject() resource.Object {
	return o.object
}

// UntypedObjectWrapper wraps bytes which can be marshaled into a resource.Object, but only if provided an example
// object to marshal into. It implements runtime.Object, and exposes Into() to marshal the bytes into a concrete type.
type UntypedObjectWrapper struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`
	object            json.RawMessage
}

// DeepCopyObject copies the object
func (o *UntypedObjectWrapper) DeepCopyObject() runtime.Object {
	val := reflect.ValueOf(o).Elem()

	cpy := reflect.New(val.Type())
	cpy.Elem().Set(val)

	// Using the <obj>, <ok> for the type conversion ensures that it doesn't panic if it can't be converted
	if obj, ok := cpy.Interface().(runtime.Object); ok {
		return obj
	}

	// TODO: better return than nil?
	return nil
}

// Into unmarshals the wrapped object bytes into the provided resource.Object, using the same unmarshal logic
// that Client and SchemalessClient use
func (o *UntypedObjectWrapper) Into(into resource.Object, codec resource.Codec) error {
	return codec.Read(bytes.NewReader(o.object), into)
}

// UntypedWatchObject implements runtime.Object, and keeps the Object part of a kubernetes watch event as bytes
// when unmarshaled, so that it can later be marshaled into a concrete type with Into().
type UntypedWatchObject struct {
	metav1.TypeMeta
	Type   string          `json:"type"`
	Object json.RawMessage `json:"object"`
}

// Into unmarshals the wrapped object bytes into the provided resource.Object, using the same unmarshal logic
// that Client and SchemalessClient use
func (w *UntypedWatchObject) Into(into resource.Object, codec resource.Codec) error {
	return codec.Read(bytes.NewReader(w.Object), into)
}

// DeepCopyObject copies the object
func (w *UntypedWatchObject) DeepCopyObject() runtime.Object {
	val := reflect.ValueOf(w).Elem()

	cpy := reflect.New(val.Type())
	cpy.Elem().Set(val)

	// Using the <obj>, <ok> for the type conversion ensures that it doesn't panic if it can't be converted
	if obj, ok := cpy.Interface().(runtime.Object); ok {
		return obj
	}

	// TODO: better return than nil?
	return nil
}

type intoObject interface {
	Into(object resource.Object, codec resource.Codec) error
}

type wrappedObject interface {
	ResourceObject() resource.Object
}
