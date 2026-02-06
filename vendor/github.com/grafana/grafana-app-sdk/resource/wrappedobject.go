package resource

import (
	"encoding/json"
	"errors"
	"io"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// PassthroughJSONCodec just passes through Read/Write operations to json.Unmarshal/json.Marshal without any other handling.
// This differs from JSONCodec in that it does not try to format the provided object into any particular shape.
// It should be used for objects which do not adhere to having their contents in `spec`, as it does not force that shape
// like JSONCodec does.
type PassthroughJSONCodec struct{}

// NewPassthroughJSONCodec returns a pointer to a new instance of PassthroughJSONCodec
func NewPassthroughJSONCodec() *PassthroughJSONCodec {
	return &PassthroughJSONCodec{}
}

func (PassthroughJSONCodec) Read(in io.Reader, into Object) error {
	return json.NewDecoder(in).Decode(into)
}

func (PassthroughJSONCodec) Write(out io.Writer, obj Object) error {
	return json.NewEncoder(out).Encode(obj)
}

type WrappedObjectType interface {
	runtime.Object
	schema.ObjectKind
	metav1.Object
}

// Compile-time interface compliance checks
var (
	_ Codec  = NewPassthroughJSONCodec()
	_ Object = NewWrappedObject(&UntypedObject{})
)

// WrappedObject wraps a kubernetes object which can't be easily represented with TypedObject (for example, kubernetes
// resources which do not have a `spec`) in an Object-implementing wrapper.
// WrappedObject instances should use PassthroughJSONCodec instead of JSONCodec when used in a Kind.
type WrappedObject[T WrappedObjectType] struct {
	Object T `json:",inline"`
}

// NewWrappedObject is a convenience method for creating an instance of WrappedObject with Object set to underlying.
func NewWrappedObject[T WrappedObjectType](underlying T) *WrappedObject[T] {
	return &WrappedObject[T]{
		Object: underlying,
	}
}

func (o *WrappedObject[T]) MarshalJSON() ([]byte, error) {
	return json.Marshal(o.Object)
}

func (o *WrappedObject[T]) UnmarshalJSON(data []byte) error {
	return json.Unmarshal(data, &o.Object)
}

func (o *WrappedObject[T]) GetObjectKind() schema.ObjectKind {
	return o.Object.GetObjectKind()
}

func (o *WrappedObject[T]) DeepCopyObject() runtime.Object {
	return o.Object.DeepCopyObject()
}

func (o *WrappedObject[T]) SetGroupVersionKind(kind schema.GroupVersionKind) {
	o.Object.SetGroupVersionKind(kind)
}

func (o *WrappedObject[T]) GroupVersionKind() schema.GroupVersionKind {
	return o.Object.GroupVersionKind()
}

func (o *WrappedObject[T]) GetNamespace() string {
	return o.Object.GetNamespace()
}

func (o *WrappedObject[T]) SetNamespace(namespace string) {
	o.Object.SetNamespace(namespace)
}

func (o *WrappedObject[T]) GetName() string {
	return o.Object.GetName()
}

func (o *WrappedObject[T]) SetName(name string) {
	o.Object.SetName(name)
}

func (o *WrappedObject[T]) GetGenerateName() string {
	return o.Object.GetGenerateName()
}

func (o *WrappedObject[T]) SetGenerateName(name string) {
	o.Object.SetGenerateName(name)
}

func (o *WrappedObject[T]) GetUID() types.UID {
	return o.Object.GetUID()
}

func (o *WrappedObject[T]) SetUID(uid types.UID) {
	o.Object.SetUID(uid)
}

func (o *WrappedObject[T]) GetResourceVersion() string {
	return o.Object.GetResourceVersion()
}

func (o *WrappedObject[T]) SetResourceVersion(version string) {
	o.Object.SetResourceVersion(version)
}

func (o *WrappedObject[T]) GetGeneration() int64 {
	return o.Object.GetGeneration()
}

func (o *WrappedObject[T]) SetGeneration(generation int64) {
	o.Object.SetGeneration(generation)
}

func (o *WrappedObject[T]) GetSelfLink() string {
	return o.Object.GetSelfLink()
}

func (o *WrappedObject[T]) SetSelfLink(selfLink string) {
	o.Object.SetSelfLink(selfLink)
}

func (o *WrappedObject[T]) GetCreationTimestamp() metav1.Time {
	return o.Object.GetCreationTimestamp()
}

func (o *WrappedObject[T]) SetCreationTimestamp(timestamp metav1.Time) {
	o.Object.SetCreationTimestamp(timestamp)
}

func (o *WrappedObject[T]) GetDeletionTimestamp() *metav1.Time {
	return o.Object.GetDeletionTimestamp()
}

func (o *WrappedObject[T]) SetDeletionTimestamp(timestamp *metav1.Time) {
	o.Object.SetDeletionTimestamp(timestamp)
}

func (o *WrappedObject[T]) GetDeletionGracePeriodSeconds() *int64 {
	return o.Object.GetDeletionGracePeriodSeconds()
}

func (o *WrappedObject[T]) SetDeletionGracePeriodSeconds(i *int64) {
	o.Object.SetDeletionGracePeriodSeconds(i)
}

func (o *WrappedObject[T]) GetLabels() map[string]string {
	return o.Object.GetLabels()
}

func (o *WrappedObject[T]) SetLabels(labels map[string]string) {
	o.Object.SetLabels(labels)
}

func (o *WrappedObject[T]) GetAnnotations() map[string]string {
	return o.Object.GetAnnotations()
}

func (o *WrappedObject[T]) SetAnnotations(annotations map[string]string) {
	o.Object.SetAnnotations(annotations)
}

func (o *WrappedObject[T]) GetFinalizers() []string {
	return o.Object.GetFinalizers()
}

func (o *WrappedObject[T]) SetFinalizers(finalizers []string) {
	o.Object.SetFinalizers(finalizers)
}

func (o *WrappedObject[T]) GetOwnerReferences() []metav1.OwnerReference {
	return o.Object.GetOwnerReferences()
}

func (o *WrappedObject[T]) SetOwnerReferences(references []metav1.OwnerReference) {
	o.Object.SetOwnerReferences(references)
}

func (o *WrappedObject[T]) GetManagedFields() []metav1.ManagedFieldsEntry {
	return o.Object.GetManagedFields()
}

func (o *WrappedObject[T]) SetManagedFields(managedFields []metav1.ManagedFieldsEntry) {
	o.Object.SetManagedFields(managedFields)
}

func (*WrappedObject[T]) GetSpec() any {
	return nil
}

func (*WrappedObject[T]) SetSpec(_ any) error {
	return errors.New("no spec to set in wrapped object")
}

func (*WrappedObject[T]) GetSubresources() map[string]any {
	return map[string]any{}
}

func (*WrappedObject[T]) GetSubresource(_ string) (any, bool) {
	return nil, false
}

func (*WrappedObject[T]) SetSubresource(_ string, _ any) error {
	return errors.New("cannot set subresource in wrapped object")
}

func (o *WrappedObject[T]) GetStaticMetadata() StaticMetadata {
	return StaticMetadata{
		Name:      o.Object.GetName(),
		Namespace: o.Object.GetNamespace(),
		Group:     o.Object.GroupVersionKind().Group,
		Version:   o.Object.GroupVersionKind().Version,
		Kind:      o.Object.GroupVersionKind().Kind,
	}
}

func (o *WrappedObject[T]) SetStaticMetadata(metadata StaticMetadata) {
	o.Object.SetName(metadata.Name)
	o.Object.SetNamespace(metadata.Namespace)
	o.Object.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   metadata.Group,
		Version: metadata.Version,
		Kind:    metadata.Kind,
	})
}

//nolint:revive,staticcheck
func (o *WrappedObject[T]) GetCommonMetadata() CommonMetadata {
	var err error
	dt := o.Object.GetDeletionTimestamp()
	var deletionTimestamp *time.Time
	if dt != nil {
		deletionTimestamp = &dt.Time
	}
	updt := time.Time{}
	createdBy := ""
	updatedBy := ""
	annotations := o.Object.GetAnnotations()
	if annotations != nil {
		strUpdt, ok := annotations[AnnotationUpdateTimestamp]
		if ok {
			updt, err = time.Parse(time.RFC3339, strUpdt)
			if err != nil {
				// HMMMM
			}
		}
		createdBy = annotations[AnnotationCreatedBy]
		updatedBy = annotations[AnnotationUpdatedBy]
	}
	return CommonMetadata{
		UID:               string(o.Object.GetUID()),
		ResourceVersion:   o.Object.GetResourceVersion(),
		Generation:        o.Object.GetGeneration(),
		Labels:            o.Object.GetLabels(),
		CreationTimestamp: o.Object.GetCreationTimestamp().Time,
		DeletionTimestamp: deletionTimestamp,
		Finalizers:        o.Object.GetFinalizers(),
		UpdateTimestamp:   updt,
		CreatedBy:         createdBy,
		UpdatedBy:         updatedBy,
	}
}

func (o *WrappedObject[T]) SetCommonMetadata(metadata CommonMetadata) {
	o.Object.SetUID(types.UID(metadata.UID))
	o.Object.SetResourceVersion(metadata.ResourceVersion)
	o.Object.SetGeneration(metadata.Generation)
	o.Object.SetLabels(metadata.Labels)
	o.Object.SetCreationTimestamp(metav1.NewTime(metadata.CreationTimestamp))
	if metadata.DeletionTimestamp != nil {
		dt := metav1.NewTime(*metadata.DeletionTimestamp)
		o.Object.SetDeletionTimestamp(&dt)
	} else {
		o.Object.SetDeletionTimestamp(nil)
	}
	o.Object.SetFinalizers(metadata.Finalizers)
	annotations := o.Object.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	if !metadata.UpdateTimestamp.IsZero() {
		annotations[AnnotationUpdateTimestamp] = metadata.UpdateTimestamp.Format(time.RFC3339)
	}
	if metadata.CreatedBy != "" {
		annotations[AnnotationCreatedBy] = metadata.CreatedBy
	}
	if metadata.UpdatedBy != "" {
		annotations[AnnotationUpdatedBy] = metadata.UpdatedBy
	}
	o.Object.SetAnnotations(annotations)
}

func (o *WrappedObject[T]) Copy() Object {
	cpy := o.Object.DeepCopyObject()
	cast, ok := cpy.(T)
	if !ok {
		return &WrappedObject[T]{}
	}
	return &WrappedObject[T]{
		Object: cast,
	}
}
