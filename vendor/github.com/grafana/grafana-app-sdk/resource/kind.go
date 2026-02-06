package resource

import (
	"encoding/json"
	"fmt"
	"io"
	"maps"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// KindEncoding is the wire encoding of the Kind objects.
type KindEncoding string

// KindEncoding constants which reflect the string used for a Content-Type header.
const (
	KindEncodingJSON    KindEncoding = "application/json"
	KindEncodingYAML    KindEncoding = "application/yaml"
	KindEncodingUnknown KindEncoding = ""
)

var _ Schema = &Kind{}

// Codec is an interface which describes any object which can read and write Object implementations to/from bytes.
// A codec is often specific to an encoding of the bytes in the reader/writer, and may also be specific to
// Object implementations.
type Codec interface {
	Read(in io.Reader, into Object) error
	Write(out io.Writer, obj Object) error
}

// Kind is a struct which encapsulates Schema information and Codecs for reading/writing Objects which are instances
// of the contained Schema. It implements Schema using the Schema field.
type Kind struct {
	Schema
	Codecs map[KindEncoding]Codec
}

// Codec is a nil-safe way of accessing the Codecs map in the Kind.
// It will return nil if the map key does not exist, or the key is explicitly set to nil.
func (k *Kind) Codec(encoding KindEncoding) Codec {
	if k.Codecs == nil {
		return nil
	}
	return k.Codecs[encoding]
}

// Read is a convenience wrapper for getting the Codec for a particular KindEncoding and reading into Schema.ZeroObject()
func (k *Kind) Read(in io.Reader, encoding KindEncoding) (Object, error) {
	codec := k.Codec(encoding)
	if codec == nil {
		return nil, fmt.Errorf("no codec for encoding '%s'", encoding)
	}
	into := k.ZeroValue()
	err := codec.Read(in, into)
	if err != nil {
		return nil, err
	}
	return into, nil
}

// Write is a convenience wrapper for getting the Codec for a particular KindEncoding and calling Codec.Write
func (k *Kind) Write(obj Object, out io.Writer, encoding KindEncoding) error {
	codec := k.Codec(encoding)
	if codec == nil {
		return fmt.Errorf("no codec for encoding '%s'", encoding)
	}
	return codec.Write(out, obj)
}

// GroupVersionKind is a convenience method that assembles a schema.GroupVersionKind from Group(), Version(), and Kind()
func (k Kind) GroupVersionKind() schema.GroupVersionKind {
	if k.Schema == nil {
		return schema.GroupVersionKind{}
	}
	return schema.GroupVersionKind{
		Group:   k.Group(),
		Version: k.Version(),
		Kind:    k.Kind(),
	}
}

// GroupVersionResource is a convenience method that assembles a schema.GroupVersionResource from Group(), Version(), and Plural()
func (k Kind) GroupVersionResource() schema.GroupVersionResource {
	if k.Schema == nil {
		return schema.GroupVersionResource{}
	}
	return schema.GroupVersionResource{
		Group:    k.Group(),
		Version:  k.Version(),
		Resource: k.Plural(),
	}
}

// NewJSONCodec returns a pointer to a new JSONCodec instance
func NewJSONCodec() *JSONCodec {
	return &JSONCodec{}
}

// JSONCodec is a Codec-implementing struct that reads and writes kubernetes-formatted JSON bytes.
type JSONCodec struct{}

// Read is a simple wrapper for the json package unmarshal into the object.
// TODO: expect kubernetes-formatted bytes on input?
func (*JSONCodec) Read(in io.Reader, out Object) error {
	// TODO: make this work similar to Write, where the shape of the golang object shouldn't have to match the kubernetes JSON
	return json.NewDecoder(in).Decode(&out)
}

// Write marshals the provided Object into kubernetes-formatted JSON bytes.
func (*JSONCodec) Write(out io.Writer, in Object) error {
	m := make(map[string]any)
	m["apiVersion"], m["kind"] = in.GetObjectKind().GroupVersionKind().ToAPIVersionAndKind()
	m["metadata"] = metav1.ObjectMeta{
		Name:                       in.GetName(),
		GenerateName:               in.GetGenerateName(),
		Namespace:                  in.GetNamespace(),
		SelfLink:                   in.GetSelfLink(),
		UID:                        in.GetUID(),
		ResourceVersion:            in.GetResourceVersion(),
		Generation:                 in.GetGeneration(),
		CreationTimestamp:          in.GetCreationTimestamp(),
		DeletionTimestamp:          in.GetDeletionTimestamp(),
		DeletionGracePeriodSeconds: in.GetDeletionGracePeriodSeconds(),
		Labels:                     in.GetLabels(),
		Annotations:                in.GetAnnotations(),
		OwnerReferences:            in.GetOwnerReferences(),
		Finalizers:                 in.GetFinalizers(),
		ManagedFields:              in.GetManagedFields(),
	}
	m["spec"] = in.GetSpec()
	maps.Copy(m, in.GetSubresources())
	return json.NewEncoder(out).Encode(m)
}

type TypedList[T Object] struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []T `json:"items"`
}

func (t *TypedList[T]) DeepCopyObject() runtime.Object {
	return t.Copy()
}

// Copy creates a copy of the list
// nolint:revive
func (t *TypedList[T]) Copy() ListObject {
	cpy := &TypedList[T]{
		TypeMeta: t.TypeMeta,
		Items:    make([]T, len(t.Items)),
	}
	t.DeepCopyInto(&cpy.ListMeta)
	for i := 0; i < len(t.Items); i++ {
		cpy.Items[i], _ = t.Items[i].Copy().(T)
	}
	return cpy
}

func (t *TypedList[T]) GetItems() []Object {
	// TODO: this should be a pointer copy without too much new allocation, but let's double-check
	tmp := make([]Object, len(t.Items))
	for i := 0; i < len(t.Items); i++ {
		tmp[i] = t.Items[i]
	}
	return tmp
}

func (t *TypedList[T]) SetItems(items []Object) {
	t.Items = make([]T, len(items))
	for i := 0; i < len(t.Items); i++ {
		cast, ok := items[i].(T)
		if !ok {
			// Not compatible, skip the item
			continue
		}
		t.Items[i] = cast
	}
}
