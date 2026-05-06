package resource

import (
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

var _ Object = &UnstructuredWrapper{}

// UnstructuredWrapper wraps unstructured.Unstructured so that it implements resource.Object
type UnstructuredWrapper struct {
	*unstructured.Unstructured `json:",inline"`
}

// NewUnstructuredWrapper creates a new UnstructuredWrapper wrapping the provided unstructured.Unstructured resource
func NewUnstructuredWrapper(obj *unstructured.Unstructured) *UnstructuredWrapper {
	return &UnstructuredWrapper{obj}
}

func (u *UnstructuredWrapper) GetSpec() any {
	return u.Object["spec"]
}

func (u *UnstructuredWrapper) SetSpec(a any) error {
	u.Object["spec"] = a
	return nil
}

func (u *UnstructuredWrapper) GetSubresources() map[string]any {
	subresources := make(map[string]any)
	for k, v := range u.Object {
		if k == "metadata" || k == "apiVersion" || k == "kind" || k == "spec" {
			continue
		}
		subresources[k] = v
	}
	return subresources
}

func (u *UnstructuredWrapper) GetSubresource(s string) (any, bool) {
	sr, ok := u.Object[s]
	return sr, ok
}

func (u *UnstructuredWrapper) SetSubresource(key string, val any) error {
	u.Object[key] = val
	return nil
}

func (u *UnstructuredWrapper) GetStaticMetadata() StaticMetadata {
	return StaticMetadata{
		Name:      u.GetName(),
		Namespace: u.GetNamespace(),
		Group:     u.GroupVersionKind().Group,
		Version:   u.GroupVersionKind().Version,
		Kind:      u.GroupVersionKind().Kind,
	}
}

func (u *UnstructuredWrapper) SetStaticMetadata(metadata StaticMetadata) {
	u.SetName(metadata.Name)
	u.SetNamespace(metadata.Namespace)
	u.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   metadata.Group,
		Version: metadata.Version,
		Kind:    metadata.Kind,
	})
}

//nolint:revive,staticcheck
func (u *UnstructuredWrapper) GetCommonMetadata() CommonMetadata {
	var err error
	dt := u.GetDeletionTimestamp()
	var deletionTimestamp *time.Time
	if dt != nil {
		deletionTimestamp = &dt.Time
	}
	updt := time.Time{}
	createdBy := ""
	updatedBy := ""
	if annotations := u.GetAnnotations(); annotations != nil {
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
		UID:               string(u.GetUID()),
		ResourceVersion:   u.GetResourceVersion(),
		Generation:        u.GetGeneration(),
		Labels:            u.GetLabels(),
		CreationTimestamp: u.GetCreationTimestamp().Time,
		DeletionTimestamp: deletionTimestamp,
		Finalizers:        u.GetFinalizers(),
		UpdateTimestamp:   updt,
		CreatedBy:         createdBy,
		UpdatedBy:         updatedBy,
	}
}

func (u *UnstructuredWrapper) SetCommonMetadata(metadata CommonMetadata) {
	u.SetUID(types.UID(metadata.UID))
	u.SetResourceVersion(metadata.ResourceVersion)
	u.SetGeneration(metadata.Generation)
	u.SetLabels(metadata.Labels)
	u.SetCreationTimestamp(metav1.NewTime(metadata.CreationTimestamp))
	if metadata.DeletionTimestamp != nil {
		dt := metav1.NewTime(*metadata.DeletionTimestamp)
		u.SetDeletionTimestamp(&dt)
	} else {
		u.SetDeletionTimestamp(nil)
	}
	u.SetFinalizers(metadata.Finalizers)
	annotations := u.GetAnnotations()
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
	u.SetAnnotations(annotations)
}

func (u *UnstructuredWrapper) Copy() Object {
	uns := unstructured.Unstructured{}
	u.DeepCopyInto(&uns)
	return &UnstructuredWrapper{&uns}
}
