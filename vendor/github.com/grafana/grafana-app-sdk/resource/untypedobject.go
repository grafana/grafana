package resource

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// Annotation name constants which are used by the Typed and Untyped Objects for converting non-kubernetes metadata
// into CommonMetadata attributes. While it is not required for Object implementations to use these annotations
// for storing non-kubernetes CommonMetadata fields, it is encouraged for maximum compatibility.
const (
	AnnotationUpdateTimestamp = "grafana.com/updateTimestamp"
	AnnotationCreatedBy       = "grafana.com/createdBy"
	AnnotationUpdatedBy       = "grafana.com/updatedBy"
)

var (
	_ Object     = &UntypedObject{}
	_ ListObject = &UntypedList{}
)

// UntypedObject implements Object and represents a generic implementation of an instance of any kubernetes Kind.
type UntypedObject struct {
	metav1.TypeMeta
	metav1.ObjectMeta `json:"metadata"`
	// Spec is an untyped map representing the spec data
	Spec map[string]any `json:"spec"`
	// Subresources contains all subresources in raw JSON bytes
	Subresources map[string]json.RawMessage
}

func (u *UntypedObject) GetSpec() any {
	return u.Spec
}

func (u *UntypedObject) SetSpec(spec any) error {
	cast, ok := spec.(map[string]any)
	if !ok {
		return errors.New("spec must be of type map[string]any")
	}
	u.Spec = cast
	return nil
}

func (u *UntypedObject) GetSubresources() map[string]any {
	sr := make(map[string]any)
	for k, v := range u.Subresources {
		sr[k] = v
	}
	return sr
}

func (u *UntypedObject) GetSubresource(key string) (any, bool) {
	if sr, ok := u.Subresources[key]; ok {
		return sr, true
	}
	return nil, false
}

func (u *UntypedObject) SetSubresource(key string, val any) error {
	cast, ok := val.(json.RawMessage)
	if !ok {
		if check, ok := val.([]byte); ok {
			cast = check
		} else {
			var err error
			cast, err = json.Marshal(val)
			if err != nil {
				return err
			}
		}
	}
	if u.Subresources == nil {
		u.Subresources = make(map[string]json.RawMessage)
	}
	u.Subresources[key] = cast
	return nil
}

func (u *UntypedObject) DeepCopyObject() runtime.Object {
	return u.Copy()
}

func (u *UntypedObject) UnmarshalJSON(data []byte) error {
	m := make(map[string]json.RawMessage)
	err := json.Unmarshal(data, &m)
	if err != nil {
		return err
	}
	if err = json.Unmarshal(m["apiVersion"], &u.APIVersion); err != nil {
		return fmt.Errorf("error reading apiVersion: %w", err)
	}
	if err = json.Unmarshal(m["kind"], &u.Kind); err != nil {
		return fmt.Errorf("error reading kind: %w", err)
	}
	if err = json.Unmarshal(m["metadata"], &u.ObjectMeta); err != nil {
		return fmt.Errorf("error reading metadata: %w", err)
	}
	for k, v := range m {
		if k == "apiVersion" || k == "kind" || k == "metadata" {
			continue
		}
		if k == "spec" {
			u.Spec = make(map[string]any)
			if err = json.Unmarshal(v, &u.Spec); err != nil {
				return err
			}
			continue
		}
		if u.Subresources == nil {
			u.Subresources = make(map[string]json.RawMessage)
		}
		u.Subresources[k] = v
	}
	return nil
}

func (u *UntypedObject) MarshalJSON() ([]byte, error) {
	m := make(map[string]any)
	m["kind"] = u.Kind
	m["apiVersion"] = u.APIVersion
	m["metadata"] = u.ObjectMeta
	m["spec"] = u.Spec
	for k, v := range u.Subresources {
		m[k] = v
	}
	return json.Marshal(m)
}

func (u *UntypedObject) GetStaticMetadata() StaticMetadata {
	return StaticMetadata{
		Name:      u.Name,
		Namespace: u.Namespace,
		Group:     u.GroupVersionKind().Group,
		Version:   u.GroupVersionKind().Version,
		Kind:      u.GroupVersionKind().Kind,
	}
}

func (u *UntypedObject) SetStaticMetadata(metadata StaticMetadata) {
	u.Name = metadata.Name
	u.Namespace = metadata.Namespace
	u.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   metadata.Group,
		Version: metadata.Version,
		Kind:    metadata.Kind,
	})
}

// GetCommonMetadata returns CommonMetadata for the object
// nolint:revive,staticcheck
func (u *UntypedObject) GetCommonMetadata() CommonMetadata {
	var err error
	dt := u.DeletionTimestamp
	var deletionTimestamp *time.Time
	if dt != nil {
		deletionTimestamp = &dt.Time
	}
	updt := time.Time{}
	createdBy := ""
	updatedBy := ""
	if u.Annotations != nil {
		strUpdt, ok := u.Annotations[AnnotationUpdateTimestamp]
		if ok {
			updt, err = time.Parse(time.RFC3339, strUpdt)
			if err != nil {
				// HMMMM
			}
		}
		createdBy = u.Annotations[AnnotationCreatedBy]
		updatedBy = u.Annotations[AnnotationUpdatedBy]
	}
	return CommonMetadata{
		UID:               string(u.UID),
		ResourceVersion:   u.ResourceVersion,
		Generation:        u.Generation,
		Labels:            u.Labels,
		CreationTimestamp: u.CreationTimestamp.Time,
		DeletionTimestamp: deletionTimestamp,
		Finalizers:        u.Finalizers,
		UpdateTimestamp:   updt,
		CreatedBy:         createdBy,
		UpdatedBy:         updatedBy,
		// TODO: populate ExtraFields in UntypedObject?
	}
}

// SetCommonMetadata sets metadata in the UntypedObject based on the contents of the provided CommonMetadata
// nolint:dupl
func (u *UntypedObject) SetCommonMetadata(metadata CommonMetadata) {
	u.UID = types.UID(metadata.UID)
	u.ResourceVersion = metadata.ResourceVersion
	u.Generation = metadata.Generation
	u.Labels = metadata.Labels
	u.CreationTimestamp = metav1.NewTime(metadata.CreationTimestamp)
	if metadata.DeletionTimestamp != nil {
		dt := metav1.NewTime(*metadata.DeletionTimestamp)
		u.DeletionTimestamp = &dt
	} else {
		u.DeletionTimestamp = nil
	}
	u.Finalizers = metadata.Finalizers
	if u.Annotations == nil {
		u.Annotations = make(map[string]string)
	}
	if !metadata.UpdateTimestamp.IsZero() {
		u.Annotations[AnnotationUpdateTimestamp] = metadata.UpdateTimestamp.Format(time.RFC3339)
	}
	if metadata.CreatedBy != "" {
		u.Annotations[AnnotationCreatedBy] = metadata.CreatedBy
	}
	if metadata.UpdatedBy != "" {
		u.Annotations[AnnotationUpdatedBy] = metadata.UpdatedBy
	}
}

// Copy creates a copy of the object, using JSON marshaling to copy the spec,
// and slice copy for the subresource bytes
// nolint:revive,staticcheck
func (u *UntypedObject) Copy() Object {
	cpy := &UntypedObject{}
	cpy.APIVersion = u.APIVersion
	cpy.Kind = u.Kind
	cpy.ObjectMeta = *u.ObjectMeta.DeepCopy()
	cpy.Spec = make(map[string]any)
	// Copying spec is just json marshal/unmarshal--it's a bit slower, but less complicated for now
	// Efficient implementations of Copy()/DeepCopyObject() should be bespoke in implementations of Object2
	if len(u.Spec) > 0 {
		specBytes, err := json.Marshal(u.Spec)
		if err != nil {
			// We really shouldn't end up here, but we don't want to panic. So we actually do nothing
		} else if err := json.Unmarshal(specBytes, &cpy.Spec); err != nil {
			// Again, we shouldn't be hitting here with normal data, but we don't want to panic
		}
	}
	cpy.Subresources = make(map[string]json.RawMessage)
	for k, v := range u.Subresources {
		srCopy := make([]byte, len(v))
		copy(srCopy, v)
		cpy.Subresources[k] = srCopy
	}
	return cpy
}

type UntypedList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []Object `json:"items"`
}

func (u *UntypedList) DeepCopyObject() runtime.Object {
	return u.Copy()
}

func (u *UntypedList) Copy() ListObject {
	cpy := &UntypedList{
		TypeMeta: u.TypeMeta,
		Items:    make([]Object, len(u.Items)),
	}
	u.DeepCopyInto(&cpy.ListMeta)
	for i := 0; i < len(u.Items); i++ {
		cpy.Items[i] = u.Items[i].Copy()
	}
	return cpy
}

func (u *UntypedList) GetItems() []Object {
	return u.Items
}

func (u *UntypedList) SetItems(items []Object) {
	u.Items = items
}
