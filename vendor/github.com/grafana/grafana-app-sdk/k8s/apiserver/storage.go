package apiserver

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"
	"sigs.k8s.io/structured-merge-diff/v4/fieldpath"

	"github.com/grafana/grafana-app-sdk/resource"
)

func newGenericStoreForKind(scheme *runtime.Scheme, kind resource.Kind, optsGetter generic.RESTOptionsGetter) (*genericregistry.Store, error) {
	strategy := newStrategy(scheme, kind)

	store := &genericregistry.Store{
		NewFunc: func() runtime.Object {
			return kind.ZeroValue()
		},
		NewListFunc: func() runtime.Object {
			return kind.ZeroListValue()
		},
		PredicateFunc:             matchKind,
		DefaultQualifiedResource:  kind.GroupVersionResource().GroupResource(),
		SingularQualifiedResource: kind.GroupVersionResource().GroupResource(),

		CreateStrategy: strategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,
		TableConvertor: rest.NewDefaultTableConvertor(kind.GroupVersionResource().GroupResource()),
	}

	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: getAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, fmt.Errorf("failed completing storage options for %s: %w", kind.Kind(), err)
	}

	return store, nil
}

func getAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	resourceObj, ok := obj.(resource.Object)
	if !ok {
		return nil, nil, fmt.Errorf("object (%T) is not a resource.Object", obj)
	}
	m := metav1.ObjectMeta{
		Name:                       resourceObj.GetName(),
		Namespace:                  resourceObj.GetNamespace(),
		Labels:                     resourceObj.GetLabels(),
		Annotations:                resourceObj.GetAnnotations(),
		OwnerReferences:            resourceObj.GetOwnerReferences(),
		Finalizers:                 resourceObj.GetFinalizers(),
		ResourceVersion:            resourceObj.GetResourceVersion(),
		UID:                        resourceObj.GetUID(),
		Generation:                 resourceObj.GetGeneration(),
		CreationTimestamp:          resourceObj.GetCreationTimestamp(),
		DeletionTimestamp:          resourceObj.GetDeletionTimestamp(),
		DeletionGracePeriodSeconds: resourceObj.GetDeletionGracePeriodSeconds(),
		ManagedFields:              resourceObj.GetManagedFields(),
	}
	return labels.Set(m.Labels), generic.ObjectMetaFieldsSet(&m, true), nil
}

func matchKind(label labels.Selector, field fields.Selector) storage.SelectionPredicate {
	return storage.SelectionPredicate{
		Label:    label,
		Field:    field,
		GetAttrs: getAttrs,
	}
}

func newRegistryStatusStoreForKind(scheme *runtime.Scheme, kind resource.Kind, specStore *genericregistry.Store) *StatusREST {
	strategy := newStatusStrategy(scheme, kind.GroupVersionKind().GroupVersion())
	return newStatusREST(specStore, strategy)
}

// NewStatusREST makes a RESTStorage for status that has more limited options.
// It is based on the original REST so that we can share the same underlying store
func newStatusREST(store *genericregistry.Store, strategy rest.UpdateResetFieldsStrategy) *StatusREST {
	statusStore := *store
	statusStore.CreateStrategy = nil
	statusStore.DeleteStrategy = nil
	statusStore.UpdateStrategy = strategy
	statusStore.ResetFieldsStrategy = strategy
	return &StatusREST{Store: &statusStore}
}

// StatusREST implements the REST endpoint for changing the status of a resource.
type StatusREST struct {
	Store *genericregistry.Store
}

var (
	_ rest.Patcher = (*StatusREST)(nil)
	_ rest.Storage = (*StatusREST)(nil)
)

// New creates a new runtime.Object.
func (r *StatusREST) New() runtime.Object {
	return r.Store.NewFunc()
}

// Destroy cleans up resources on shutdown.
func (*StatusREST) Destroy() {
	// Given that underlying store is shared with REST,
	// we don't destroy it here explicitly.
}

// Get retrieves the object from the storage. It is required to support Patch.
func (r *StatusREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return r.Store.Get(ctx, name, options)
}

// Update alters the status subset of an object.
func (r *StatusREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	// We are explicitly setting forceAllowCreate to false in the call to the underlying storage because
	// subresources should never allow create on update.
	return r.Store.Update(ctx, name, objInfo, createValidation, updateValidation, false, options)
}

// GetResetFields implements rest.ResetFieldsStrategy
func (r *StatusREST) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return r.Store.GetResetFields()
}
