package apiserver

import (
	"context"
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana-app-sdk/logging"
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
		PredicateFunc:            matchKindFunc(kind),
		DefaultQualifiedResource: kind.GroupVersionResource().GroupResource(),
		SingularQualifiedResource: schema.GroupResource{
			Group:    kind.Group(),
			Resource: strings.ToLower(kind.Kind()),
		},

		CreateStrategy: strategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,
		TableConvertor: rest.NewDefaultTableConvertor(kind.GroupVersionResource().GroupResource()),
	}

	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: getAttrsFunc(kind)}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, fmt.Errorf("failed completing storage options for %s: %w", kind.Kind(), err)
	}

	return store, nil
}

func getAttrsFunc(kind resource.Kind) func(obj runtime.Object) (labels.Set, fields.Set, error) {
	return func(obj runtime.Object) (labels.Set, fields.Set, error) {
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

		flds := generic.ObjectMetaFieldsSet(&m, kind.Scope() != resource.ClusterScope)
		for _, selectableField := range kind.SelectableFields() {
			val, err := selectableField.FieldValueFunc(resourceObj)
			if err != nil {
				// TODO: better warning than using the default logger?
				logging.DefaultLogger.Warn("failed to retrieve field value", "error", err, "group", kind.Group(), "version", kind.Version(), "kind", kind.Kind(), "field", selectableField.FieldSelector)
				// Set the value to an empty string
				val = ""
			}
			flds[strings.TrimPrefix(selectableField.FieldSelector, ".")] = val
		}

		return labels.Set(m.Labels), flds, nil
	}
}

func matchKindFunc(kind resource.Kind) func(label labels.Selector, field fields.Selector) storage.SelectionPredicate {
	return func(label labels.Selector, field fields.Selector) storage.SelectionPredicate {
		return storage.SelectionPredicate{
			Label:    label,
			Field:    field,
			GetAttrs: getAttrsFunc(kind),
		}
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

func newSubresourceREST(store *genericregistry.Store, scheme *runtime.Scheme, kind resource.Kind, subresource string) *SubresourceREST {
	resetFields := make([]string, 0)
	resetFields = append(resetFields, "spec")
	for k := range kind.ZeroValue().GetSubresources() {
		if k == subresource {
			continue
		}
		resetFields = append(resetFields, k)
	}
	return newSubresourceRESTWithResetFields(store, scheme, kind.GroupVersionKind().GroupVersion(), subresource, resetFields, kind.Scope() != resource.ClusterScope)
}

func newSubresourceRESTWithResetFields(store *genericregistry.Store, typer runtime.ObjectTyper, gv schema.GroupVersion, subresource string, resetFields []string, namespaced bool) *SubresourceREST {
	return newSubresourceRESTWithStrategy(store, newSubresourceStrategy(typer, gv, subresource, resetFields, namespaced))
}

func newSubresourceRESTWithStrategy(store *genericregistry.Store, strategy rest.UpdateResetFieldsStrategy) *SubresourceREST {
	subresourceStore := *store
	subresourceStore.CreateStrategy = nil
	subresourceStore.DeleteStrategy = nil
	subresourceStore.UpdateStrategy = strategy
	subresourceStore.ResetFieldsStrategy = strategy
	return &SubresourceREST{Store: &subresourceStore}
}

// SubresourceREST implements the REST endpoint for changing the status of a resource.
type SubresourceREST struct {
	Store *genericregistry.Store
}

var (
	_ rest.Patcher = (*SubresourceREST)(nil)
	_ rest.Storage = (*SubresourceREST)(nil)
)

// New creates a new runtime.Object.
func (r *SubresourceREST) New() runtime.Object {
	return r.Store.NewFunc()
}

// Destroy cleans up resources on shutdown.
func (*SubresourceREST) Destroy() {
	// Given that underlying store is shared with REST,
	// we don't destroy it here explicitly.
}

// Get retrieves the object from the storage. It is required to support Patch.
func (r *SubresourceREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return r.Store.Get(ctx, name, options)
}

// Update alters the status subset of an object.
func (r *SubresourceREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	// We are explicitly setting forceAllowCreate to false in the call to the underlying storage because
	// subresources should never allow create on update.
	return r.Store.Update(ctx, name, objInfo, createValidation, updateValidation, false, options)
}

// GetResetFields implements rest.ResetFieldsStrategy
func (r *SubresourceREST) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return r.Store.GetResetFields()
}
