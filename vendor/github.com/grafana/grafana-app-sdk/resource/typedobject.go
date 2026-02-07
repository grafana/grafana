//nolint:dupl
package resource

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

var (
	_ Object = &TypedObject[any, any]{}
	_ Object = &TypedSpecObject[any]{}
	_ Object = &TypedSpecStatusObject[any, any]{}
)

// TypedSpecObject is an implementation of Object which has a typed Spec,
// and arbitrary untyped subresources, similar to UntypedObject.
// TODO: should this instead have _no_ subresources, rather than untyped ones?
type TypedSpecObject[T any] struct {
	metav1.TypeMeta   `  json:",inline"`
	metav1.ObjectMeta `  json:"metadata"`
	Spec              T `json:"spec"`
}

func (t *TypedSpecObject[T]) GetStaticMetadata() StaticMetadata {
	return StaticMetadata{
		Name:      t.Name,
		Namespace: t.Namespace,
		Group:     t.GroupVersionKind().Group,
		Version:   t.GroupVersionKind().Version,
		Kind:      t.GroupVersionKind().Kind,
	}
}

func (t *TypedSpecObject[T]) SetStaticMetadata(metadata StaticMetadata) {
	t.Name = metadata.Name
	t.Namespace = metadata.Namespace
	t.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   metadata.Group,
		Version: metadata.Version,
		Kind:    metadata.Kind,
	})
}

// GetCommonMetadata returns CommonMetadata for the object
// nolint:revive,staticcheck
func (t *TypedSpecObject[T]) GetCommonMetadata() CommonMetadata {
	var err error
	dt := t.DeletionTimestamp
	var deletionTimestamp *time.Time
	if dt != nil {
		deletionTimestamp = &dt.Time
	}
	updt := time.Time{}
	createdBy := ""
	updatedBy := ""
	if t.Annotations != nil {
		strUpdt, ok := t.Annotations[AnnotationUpdateTimestamp]
		if ok {
			updt, err = time.Parse(time.RFC3339, strUpdt)
			if err != nil {
				// HMMMM
			}
		}
		createdBy = t.Annotations[AnnotationCreatedBy]
		updatedBy = t.Annotations[AnnotationUpdatedBy]
	}
	return CommonMetadata{
		UID:               string(t.UID),
		ResourceVersion:   t.ResourceVersion,
		Generation:        t.Generation,
		Labels:            t.Labels,
		CreationTimestamp: t.CreationTimestamp.Time,
		DeletionTimestamp: deletionTimestamp,
		Finalizers:        t.Finalizers,
		UpdateTimestamp:   updt,
		CreatedBy:         createdBy,
		UpdatedBy:         updatedBy,
		// TODO: populate ExtraFields in UntypedObject?
	}
}

// SetCommonMetadata sets metadata in the TypedSpecObject based on the contents of the provided CommonMetadata
// nolint:dupl
func (t *TypedSpecObject[T]) SetCommonMetadata(metadata CommonMetadata) {
	t.UID = types.UID(metadata.UID)
	t.ResourceVersion = metadata.ResourceVersion
	t.Generation = metadata.Generation
	t.Labels = metadata.Labels
	t.CreationTimestamp = metav1.NewTime(metadata.CreationTimestamp)
	if metadata.DeletionTimestamp != nil {
		dt := metav1.NewTime(*metadata.DeletionTimestamp)
		t.DeletionTimestamp = &dt
	} else {
		t.DeletionTimestamp = nil
	}
	t.Finalizers = metadata.Finalizers
	if t.Annotations == nil {
		t.Annotations = make(map[string]string)
	}
	if !metadata.UpdateTimestamp.IsZero() {
		t.Annotations[AnnotationUpdateTimestamp] = metadata.UpdateTimestamp.Format(time.RFC3339)
	}
	if metadata.CreatedBy != "" {
		t.Annotations[AnnotationCreatedBy] = metadata.CreatedBy
	}
	if metadata.UpdatedBy != "" {
		t.Annotations[AnnotationUpdatedBy] = metadata.UpdatedBy
	}
}

func (t *TypedSpecObject[T]) GetSpec() any {
	return t.Spec
}

func (t *TypedSpecObject[T]) SetSpec(spec any) error {
	cast, ok := spec.(T)
	if !ok {
		return errors.New("spec must be of type map[string]any")
	}
	t.Spec = cast
	return nil
}

func (*TypedSpecObject[T]) GetSubresources() map[string]any {
	return map[string]any{}
}

func (*TypedSpecObject[T]) GetSubresource(_ string) (any, bool) {
	return nil, false
}

func (*TypedSpecObject[T]) SetSubresource(_ string, _ any) error {
	return errors.New("TypedSpecObject does not allow subresources")
}

func (t *TypedSpecObject[T]) DeepCopyObject() runtime.Object {
	return t.Copy()
}

// Copy creates a copy of the object. It uses JSON marshaling for copying the spec data.
// nolint:revive,staticcheck
func (t *TypedSpecObject[T]) Copy() Object {
	cpy := &TypedSpecObject[T]{}
	cpy.APIVersion = t.APIVersion
	cpy.Kind = t.Kind
	cpy.ObjectMeta = *t.ObjectMeta.DeepCopy()
	// Copying spec is just json marshal/unmarshal--it's a bit slower, but less complicated for now
	// Efficient implementations of Copy()/DeepCopyObject() should be bespoke in implementations of Object
	specBytes, err := json.Marshal(t.Spec)
	if err != nil {
		// We really shouldn't end up here, but we don't want to panic. So we actually do nothing
	} else if err := json.Unmarshal(specBytes, &cpy.Spec); err != nil {
		// Again, we shouldn't be hitting here with normal data, but we don't want to panic
	}
	return cpy
}

// TypedSpecStatusObject is an implementation of Object which has a typed Spec and Status subresource.
// Other subresources are not encapsulated by this object implementation.
type TypedSpecStatusObject[Spec, Status any] struct {
	metav1.TypeMeta   `       json:",inline"`
	metav1.ObjectMeta `       json:"metadata"`
	Spec              Spec   `json:"spec"`
	Status            Status `json:"status"`
}

func (t *TypedSpecStatusObject[T, S]) GetStaticMetadata() StaticMetadata {
	return StaticMetadata{
		Name:      t.Name,
		Namespace: t.Namespace,
		Group:     t.GroupVersionKind().Group,
		Version:   t.GroupVersionKind().Version,
		Kind:      t.GroupVersionKind().Kind,
	}
}

func (t *TypedSpecStatusObject[T, S]) SetStaticMetadata(metadata StaticMetadata) {
	t.Name = metadata.Name
	t.Namespace = metadata.Namespace
	t.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   metadata.Group,
		Version: metadata.Version,
		Kind:    metadata.Kind,
	})
}

// GetCommonMetadata returns CommonMetadata for the object
// nolint:revive,staticcheck
func (t *TypedSpecStatusObject[T, S]) GetCommonMetadata() CommonMetadata {
	var err error
	dt := t.DeletionTimestamp
	var deletionTimestamp *time.Time
	if dt != nil {
		deletionTimestamp = &dt.Time
	}
	updt := time.Time{}
	createdBy := ""
	updatedBy := ""
	if t.Annotations != nil {
		strUpdt, ok := t.Annotations[AnnotationUpdateTimestamp]
		if ok {
			updt, err = time.Parse(time.RFC3339, strUpdt)
			if err != nil {
				// HMMMM
			}
		}
		createdBy = t.Annotations[AnnotationCreatedBy]
		updatedBy = t.Annotations[AnnotationUpdatedBy]
	}
	return CommonMetadata{
		UID:               string(t.UID),
		ResourceVersion:   t.ResourceVersion,
		Generation:        t.Generation,
		Labels:            t.Labels,
		CreationTimestamp: t.CreationTimestamp.Time,
		DeletionTimestamp: deletionTimestamp,
		Finalizers:        t.Finalizers,
		UpdateTimestamp:   updt,
		CreatedBy:         createdBy,
		UpdatedBy:         updatedBy,
		// TODO: populate ExtraFields in UntypedObject?
	}
}

// SetCommonMetadata sets metadata in the TypedSpecStatusObject based on the contents of the provided CommonMetadata
// nolint:dupl
func (t *TypedSpecStatusObject[T, S]) SetCommonMetadata(metadata CommonMetadata) {
	t.UID = types.UID(metadata.UID)
	t.ResourceVersion = metadata.ResourceVersion
	t.Generation = metadata.Generation
	t.Labels = metadata.Labels
	t.CreationTimestamp = metav1.NewTime(metadata.CreationTimestamp)
	if metadata.DeletionTimestamp != nil {
		dt := metav1.NewTime(*metadata.DeletionTimestamp)
		t.DeletionTimestamp = &dt
	} else {
		t.DeletionTimestamp = nil
	}
	t.Finalizers = metadata.Finalizers
	if t.Annotations == nil {
		t.Annotations = make(map[string]string)
	}
	if !metadata.UpdateTimestamp.IsZero() {
		t.Annotations[AnnotationUpdateTimestamp] = metadata.UpdateTimestamp.Format(time.RFC3339)
	}
	if metadata.CreatedBy != "" {
		t.Annotations[AnnotationCreatedBy] = metadata.CreatedBy
	}
	if metadata.UpdatedBy != "" {
		t.Annotations[AnnotationUpdatedBy] = metadata.UpdatedBy
	}
}

func (t *TypedSpecStatusObject[T, S]) GetSpec() any {
	return t.Spec
}

func (t *TypedSpecStatusObject[T, S]) SetSpec(spec any) error {
	cast, ok := spec.(T)
	if !ok {
		return errors.New("spec must be of type map[string]any")
	}
	t.Spec = cast
	return nil
}

func (t *TypedSpecStatusObject[T, S]) GetSubresources() map[string]any {
	return map[string]any{string(SubresourceStatus): t.Status}
}

func (t *TypedSpecStatusObject[T, S]) GetSubresource(key string) (any, bool) {
	if key == string(SubresourceStatus) {
		return t.Status, true
	}
	return nil, false
}

func (t *TypedSpecStatusObject[T, S]) SetSubresource(key string, val any) error {
	if key != string(SubresourceStatus) {
		return fmt.Errorf("subresource '%s' is not valid", key)
	}
	cast, ok := val.(S)
	if !ok {
		return errors.New("status value is not of the correct type")
	}
	t.Status = cast
	return nil
}

func (t *TypedSpecStatusObject[T, S]) DeepCopyObject() runtime.Object {
	return t.Copy()
}

// Copy creates a copy of the object, using JSON marshaling to copy the spec and status objects.
// nolint:revive,staticcheck
func (t *TypedSpecStatusObject[T, S]) Copy() Object {
	cpy := &TypedSpecStatusObject[T, S]{}
	cpy.APIVersion = t.APIVersion
	cpy.Kind = t.Kind
	cpy.ObjectMeta = *t.ObjectMeta.DeepCopy()
	// Copying spec is just json marshal/unmarshal--it's a bit slower, but less complicated for now
	// Efficient implementations of Copy()/DeepCopyObject() should be bespoke in implementations of Object
	specBytes, err := json.Marshal(t.Spec)
	if err != nil {
		// We really shouldn't end up here, but we don't want to panic. So we actually do nothing
	} else if err := json.Unmarshal(specBytes, &cpy.Spec); err != nil {
		// Again, we shouldn't be hitting here with normal data, but we don't want to panic
	}
	statusBytes, err := json.Marshal(t.Status)
	if err != nil {
		// We really shouldn't end up here, but we don't want to panic. So we actually do nothing
	} else if err := json.Unmarshal(statusBytes, &cpy.Status); err != nil {
		// Again, we shouldn't be hitting here with normal data, but we don't want to panic
	}
	return cpy
}

// TypedObject is an implementation of Object which has a typed Spec, and an arbitrary set of typed subresources
// governed by top-level exported fields of the SubresourceCatalog type.
// It is generally more efficient to use a bespoke Object implementation, or TypedSpecObject or TypedSpecStatusObject,
// as this type requires the use of more complex generic logic for JSON marshal/unmarshal and the Subresource methods
// used in Object.
type TypedObject[Spec, SubresourceCatalog any] struct {
	metav1.TypeMeta   `                   json:",inline"`
	metav1.ObjectMeta `                   json:"metadata"`
	Spec              Spec               `json:"spec"`
	Subresources      SubresourceCatalog `json:"-"`
}

func (t *TypedObject[Spec, Sub]) GetStaticMetadata() StaticMetadata {
	return StaticMetadata{
		Name:      t.Name,
		Namespace: t.Namespace,
		Group:     t.GroupVersionKind().Group,
		Version:   t.GroupVersionKind().Version,
		Kind:      t.GroupVersionKind().Kind,
	}
}

func (t *TypedObject[Spec, Sub]) SetStaticMetadata(metadata StaticMetadata) {
	t.Name = metadata.Name
	t.Namespace = metadata.Namespace
	t.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   metadata.Group,
		Version: metadata.Version,
		Kind:    metadata.Kind,
	})
}

// GetCommonMetadata returns CommonMetadata for the object
// nolint:revive,staticcheck
func (t *TypedObject[Spec, Sub]) GetCommonMetadata() CommonMetadata {
	var err error
	dt := t.DeletionTimestamp
	var deletionTimestamp *time.Time
	if dt != nil {
		deletionTimestamp = &dt.Time
	}
	updt := time.Time{}
	createdBy := ""
	updatedBy := ""
	if t.Annotations != nil {
		strUpdt, ok := t.Annotations[AnnotationUpdateTimestamp]
		if ok {
			updt, err = time.Parse(time.RFC3339, strUpdt)
			if err != nil {
				// HMMMM
			}
		}
		createdBy = t.Annotations[AnnotationCreatedBy]
		updatedBy = t.Annotations[AnnotationUpdatedBy]
	}
	return CommonMetadata{
		UID:               string(t.UID),
		ResourceVersion:   t.ResourceVersion,
		Generation:        t.Generation,
		Labels:            t.Labels,
		CreationTimestamp: t.CreationTimestamp.Time,
		DeletionTimestamp: deletionTimestamp,
		Finalizers:        t.Finalizers,
		UpdateTimestamp:   updt,
		CreatedBy:         createdBy,
		UpdatedBy:         updatedBy,
		// TODO: populate ExtraFields in UntypedObject?
	}
}

// SetCommonMetadata sets metadata in the TypedObject based on the contents of the provided CommonMetadata
// nolint:dupl
func (t *TypedObject[Spec, Sub]) SetCommonMetadata(metadata CommonMetadata) {
	t.UID = types.UID(metadata.UID)
	t.ResourceVersion = metadata.ResourceVersion
	t.Generation = metadata.Generation
	t.Labels = metadata.Labels
	t.CreationTimestamp = metav1.NewTime(metadata.CreationTimestamp)
	if metadata.DeletionTimestamp != nil {
		dt := metav1.NewTime(*metadata.DeletionTimestamp)
		t.DeletionTimestamp = &dt
	} else {
		t.DeletionTimestamp = nil
	}
	t.Finalizers = metadata.Finalizers
	if t.Annotations == nil {
		t.Annotations = make(map[string]string)
	}
	if !metadata.UpdateTimestamp.IsZero() {
		t.Annotations[AnnotationUpdateTimestamp] = metadata.UpdateTimestamp.Format(time.RFC3339)
	}
	if metadata.CreatedBy != "" {
		t.Annotations[AnnotationCreatedBy] = metadata.CreatedBy
	}
	if metadata.UpdatedBy != "" {
		t.Annotations[AnnotationUpdatedBy] = metadata.UpdatedBy
	}
}

func (t *TypedObject[Spec, Sub]) GetSpec() any {
	return t.Spec
}

func (t *TypedObject[Spec, Sub]) SetSpec(spec any) error {
	cast, ok := spec.(Spec)
	if !ok {
		return errors.New("provided spec not convertible to Spec type")
	}
	t.Spec = cast
	return nil
}

func (t *TypedObject[Spec, Sub]) GetSubresources() map[string]any {
	sr := make(map[string]any)
	// TODO: better way than reflection?
	val := reflect.ValueOf(t.Subresources)

	switch val.Kind() {
	case reflect.Struct:
		typ := reflect.TypeOf(t.Subresources)
		for i := 0; i < val.NumField(); i++ {
			sr[getFieldName(typ.Field(i))] = val.Field(i).Interface()
		}
	case reflect.Map:
		for _, key := range val.MapKeys() {
			sr[key.String()] = val.MapIndex(key).Interface()
		}
	default:
		return nil
	}
	return sr
}

func (t *TypedObject[Spec, Sub]) GetSubresource(key string) (any, bool) {
	val := reflect.ValueOf(t.Subresources)

	switch val.Kind() {
	case reflect.Struct:
		typ := reflect.TypeOf(t.Subresources)
		for i := 0; i < val.NumField(); i++ {
			if getFieldName(typ.Field(i)) == key {
				return val.Field(i).Interface(), true
			}
		}
	case reflect.Map:
		for _, k := range val.MapKeys() {
			if k.String() == key {
				return val.MapIndex(k).Interface(), true
			}
		}
	default:
		return nil, false
	}
	return nil, false
}

func (t *TypedObject[Spec, Sub]) SetSubresource(key string, value any) error {
	typ := reflect.TypeOf(t.Subresources)
	val := reflect.ValueOf(t.Subresources)

	switch val.Kind() {
	case reflect.Struct:
		for i := 0; i < val.NumField(); i++ {
			if getFieldName(typ.Field(i)) == key {
				if typ.Field(i).Type != reflect.TypeOf(value) {
					return fmt.Errorf(
						"cannot assign value of type %s to subresource '%s' of type %s",
						reflect.TypeOf(value).String(),
						key,
						typ.Field(i).Type.String(),
					)
				}
				field := reflect.ValueOf(&t.Subresources).Elem().Field(i)
				if !field.CanSet() {
					return errors.New("cannot set value")
				}
				field.Set(reflect.ValueOf(value))
				return nil
			}
		}
	case reflect.Map:
		if val.IsNil() {
			ok := false
			t.Subresources, ok = reflect.MakeMap(reflect.MapOf(typ.Key(), typ.Elem())).Interface().(Sub)
			if !ok {
				return errors.New("subresource catalog is a nil map which could not be instantiated")
			}
		}
		if !reflect.TypeOf(key).AssignableTo(typ.Key()) {
			return fmt.Errorf("subresource map has an unassignable key type of '%s'", typ.Key().String())
		}
		if !reflect.TypeOf(value).AssignableTo(typ.Elem()) {
			return fmt.Errorf(
				"subresource map requires a value of type '%s', provided value '%s' is not assignable",
				typ.Elem().String(),
				reflect.TypeOf(value),
			)
		}
		val.SetMapIndex(reflect.ValueOf(key), reflect.ValueOf(value))
		return nil
	default:
	}

	return fmt.Errorf("subresource '%s' does not exist", key)
}

func (t *TypedObject[Spec, Sub]) DeepCopyObject() runtime.Object {
	return t.Copy()
}

// Copy creates a copy of the object, using JSON marshaling to copy the spec and status objects.
// nolint:revive,staticcheck
func (t *TypedObject[Spec, Sub]) Copy() Object {
	cpy := &TypedObject[Spec, Sub]{}
	cpy.APIVersion = t.APIVersion
	cpy.Kind = t.Kind
	cpy.ObjectMeta = *t.ObjectMeta.DeepCopy()
	// Copying spec is just json marshal/unmarshal--it's a bit slower, but less complicated for now
	// Efficient implementations of Copy()/DeepCopyObject() should be bespoke in implementations of Object
	specBytes, err := json.Marshal(t.Spec)
	if err != nil {
		// We really shouldn't end up here, but we don't want to panic. So we actually do nothing
	} else if err := json.Unmarshal(specBytes, &cpy.Spec); err != nil {
		// Again, we shouldn't be hitting here with normal data, but we don't want to panic
	}
	srBytes, err := json.Marshal(t.Spec)
	if err != nil {
		// We really shouldn't end up here, but we don't want to panic. So we actually do nothing
	} else if err := json.Unmarshal(srBytes, &cpy.Subresources); err != nil {
		// Again, we shouldn't be hitting here with normal data, but we don't want to panic
	}
	return cpy
}

func (t *TypedObject[Spec, Sub]) MarshalJSON() ([]byte, error) {
	m := make(map[string]any)
	m["kind"] = t.Kind
	m["apiVersion"] = t.APIVersion
	m["metadata"] = t.ObjectMeta
	m["spec"] = t.Spec
	v := reflect.ValueOf(t.Subresources)
	for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		v = v.Elem()
	}
	typ := v.Type()
	for i := 0; i < v.NumField(); i++ {
		fn := typ.Field(i).Name
		js := typ.Field(i).Tag.Get("json")
		if js != "" {
			jsv := strings.Split(js, ",")
			fn = jsv[0]
			if len(jsv) > 0 && jsv[1] == "omitempty" {
				continue
			}
		}
		marshaled, err := json.Marshal(v.Field(i).Interface())
		m[fn] = json.RawMessage(marshaled)
		if err != nil {
			return nil, err
		}
	}
	return json.Marshal(m)
}

func (t *TypedObject[Spec, Sub]) UnmarshalJSON(data []byte) error {
	m := make(map[string]json.RawMessage)
	err := json.Unmarshal(data, &m)
	if err != nil {
		return err
	}
	if err = json.Unmarshal(m["apiVersion"], &t.APIVersion); err != nil {
		return fmt.Errorf("error reading apiVersion: %w", err)
	}
	if err = json.Unmarshal(m["kind"], &t.Kind); err != nil {
		return fmt.Errorf("error reading kind: %w", err)
	}
	if err = json.Unmarshal(m["metadata"], &t.ObjectMeta); err != nil {
		return fmt.Errorf("error reading metadata: %w", err)
	}
	if err = json.Unmarshal(m["spec"], &t.Spec); err != nil {
		return fmt.Errorf("error reading spec: %w", err)
	}
	return json.Unmarshal(data, &t.Subresources)
}

func getFieldName(field reflect.StructField) string {
	name := field.Name
	if tag, ok := field.Tag.Lookup("json"); ok {
		split := strings.Split(tag, ",")
		name = split[0]
	}
	return name
}
