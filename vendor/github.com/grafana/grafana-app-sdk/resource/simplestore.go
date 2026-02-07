package resource

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// SimpleStoreMetadata is a representation of the Metadata used in the TypedObject returned by SimpleStore,
// and is used for the ObjectMetadataOption argument.
type SimpleStoreMetadata interface {
	metav1.Object
}

// ObjectMetadataOption is a function which updates an ObjectMetadata
type ObjectMetadataOption func(o SimpleStoreMetadata)

type SimpleStoreObject[T any] TypedObject[T, map[string]any]

// WithLabels sets the labels of an ObjectMetadata
func WithLabels(labels map[string]string) ObjectMetadataOption {
	return func(o SimpleStoreMetadata) {
		o.SetLabels(labels)
	}
}

// WithLabel sets a specific key in the labels of an ObjectMetadata
func WithLabel(key, value string) ObjectMetadataOption {
	return func(o SimpleStoreMetadata) {
		labels := o.GetLabels()
		if labels == nil {
			labels = make(map[string]string)
		}
		labels[key] = value
		o.SetLabels(labels)
	}
}

// WithResourceVersion sets the ResourceVersion to the supplied resourceVersion.
// This allows you to ensure that an update will fail if the version in the store doesn't match the one you supplied.
func WithResourceVersion(resourceVersion string) ObjectMetadataOption {
	return func(o SimpleStoreMetadata) {
		o.SetResourceVersion(resourceVersion)
	}
}

// SimpleStore provides an easy key/value store interface for a specific Schema,
// allowing the user to work with the actual type in the Schema Object's spec,
// without casting in and out of the Object interface.
// It should be instantiated with NewSimpleStore.
// Deprecated: prefer using TypedStore instead
type SimpleStore[SpecType any] struct {
	client Client
}

// NewSimpleStore creates a new SimpleStore for the provided Schema.
// It will error if the type of the Schema.ZeroValue().SpecObject() does not match the provided SpecType.
// It will also error if a client cannot be created from the generator, as unlike Store, the client is generated once
// and reused for all subsequent calls.
// Deprecated: prefer using TypedStore instead
func NewSimpleStore[SpecType any](kind Kind, generator ClientGenerator) (*SimpleStore[SpecType], error) {
	if reflect.TypeOf(kind.Schema.ZeroValue().GetSpec()) != reflect.TypeOf(new(SpecType)).Elem() {
		return nil, fmt.Errorf(
			"SpecType '%s' does not match underlying schema.ZeroValue().SpecObject() type '%s'",
			reflect.TypeOf(new(SpecType)).Elem(),
			reflect.TypeOf(kind.ZeroValue().GetSpec()))
	}

	client, err := generator.ClientFor(kind)
	if err != nil {
		return nil, fmt.Errorf("error getting client from generator: %w", err)
	}

	return &SimpleStore[SpecType]{
		client: client,
	}, nil
}

// List returns a list of all resources of the Schema type in the provided namespace,
// without labels or field selectors.
func (s *SimpleStore[T]) List(ctx context.Context, namespace string) (
	[]TypedObject[T, MapSubresourceCatalog], error) {
	return s.ListWithFiltersAndSelectors(ctx, namespace, nil, nil)
}

// List returns a list of all resources of the Schema type in the provided namespace,
// optionally matching the provided filters.
func (s *SimpleStore[T]) ListWithFiltersAndSelectors(ctx context.Context, namespace string, filters []string, fieldSelectors []string) (
	[]TypedObject[T, MapSubresourceCatalog], error) {
	listObj, err := s.client.List(ctx, namespace, ListOptions{
		LabelFilters:   filters,
		FieldSelectors: fieldSelectors,
	})
	if err != nil {
		return nil, err
	}
	items := listObj.GetItems()
	list := make([]TypedObject[T, MapSubresourceCatalog], len(items))
	for idx, item := range items {
		converted, err := s.cast(item)
		if err != nil {
			return nil, err
		}
		list[idx] = *converted
	}
	return list, nil
}

// Get gets an object with the provided identifier
func (s *SimpleStore[T]) Get(ctx context.Context, identifier Identifier) (*TypedObject[T, MapSubresourceCatalog], error) {
	obj, err := s.client.Get(ctx, identifier)
	if err != nil {
		return nil, err
	}
	return s.cast(obj)
}

// Add creates a new object
func (s *SimpleStore[T]) Add(ctx context.Context, identifier Identifier, obj T, opts ...ObjectMetadataOption) (
	*TypedObject[T, MapSubresourceCatalog], error) {
	object := TypedObject[T, MapSubresourceCatalog]{
		Spec: obj,
	}
	for _, opt := range opts {
		opt(&object.ObjectMeta)
	}
	ret, err := s.client.Create(ctx, identifier, &object, CreateOptions{})
	if err != nil {
		return nil, err
	}
	return s.cast(ret)
}

// Update updates the object with the provided identifier.
// If the WithResourceVersion option is used, the update will fail if the object's ResourceVersion in the store
// doesn't match the one provided in WithResourceVersion.
func (s *SimpleStore[T]) Update(ctx context.Context, identifier Identifier, obj T, opts ...ObjectMetadataOption) (
	*TypedObject[T, MapSubresourceCatalog], error) {
	object := TypedObject[T, MapSubresourceCatalog]{
		Spec: obj,
	}
	// Before we can run the opts on the metadata, we need the current metadata
	// TODO: should this whole thing instead be serialized to a patch?
	// It could affect expected behavior, though, as WithResourceVersion makes sure it matches the RV you supply
	current, err := s.Get(ctx, identifier)
	if err != nil {
		return nil, err
	}
	object.TypeMeta = current.TypeMeta
	object.ObjectMeta = current.ObjectMeta
	for _, opt := range opts {
		opt(&object.ObjectMeta)
	}
	updateOptions := UpdateOptions{}
	if object.GetResourceVersion() != "" {
		updateOptions.ResourceVersion = object.GetResourceVersion()
	}
	cmd := object.GetCommonMetadata()
	cmd.UpdateTimestamp = time.Now().UTC()
	object.SetCommonMetadata(cmd)
	ret, err := s.client.Update(ctx, identifier, &object, updateOptions)
	if err != nil {
		return nil, err
	}
	return s.cast(ret)
}

// UpdateSubresource updates a named subresource. Type compatibility is not checked for subresources.
// If the WithResourceVersion option is used, the update will fail if the object's ResourceVersion in the store
// doesn't match the one provided in WithResourceVersion.
func (s *SimpleStore[T]) UpdateSubresource(ctx context.Context, identifier Identifier, subresource SubresourceName,
	obj any) (*TypedObject[T, MapSubresourceCatalog], error) {
	if subresource == "" {
		return nil, errors.New("subresource may not be empty")
	}
	object := TypedObject[T, MapSubresourceCatalog]{
		Subresources: MapSubresourceCatalog{
			string(subresource): obj,
		},
	}
	ret, err := s.client.Update(ctx, identifier, &object, UpdateOptions{
		Subresource: string(subresource),
	})
	if err != nil {
		return nil, err
	}
	return s.cast(ret)
}

// Delete deletes a resource with the given identifier.
func (s *SimpleStore[T]) Delete(ctx context.Context, identifier Identifier) error {
	return s.client.Delete(ctx, identifier, DeleteOptions{})
}

type MapSubresourceCatalog map[string]any

//nolint:revive
func (s *SimpleStore[T]) cast(obj Object) (*TypedObject[T, MapSubresourceCatalog], error) {
	if cast, ok := obj.(*TypedObject[T, MapSubresourceCatalog]); ok {
		return cast, nil
	}
	spec, ok := obj.GetSpec().(T)
	if !ok {
		return nil, errors.New("returned object could not be cast to store's type")
	}
	apiVersion, kind := obj.GetObjectKind().GroupVersionKind().ToAPIVersionAndKind()
	return &TypedObject[T, MapSubresourceCatalog]{
		TypeMeta: metav1.TypeMeta{
			Kind:       kind,
			APIVersion: apiVersion,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:                       obj.GetName(),
			GenerateName:               obj.GetGenerateName(),
			Namespace:                  obj.GetNamespace(),
			SelfLink:                   obj.GetSelfLink(),
			UID:                        obj.GetUID(),
			ResourceVersion:            obj.GetResourceVersion(),
			Generation:                 obj.GetGeneration(),
			CreationTimestamp:          obj.GetCreationTimestamp(),
			DeletionTimestamp:          obj.GetDeletionTimestamp(),
			DeletionGracePeriodSeconds: obj.GetDeletionGracePeriodSeconds(),
			Labels:                     obj.GetLabels(),
			Annotations:                obj.GetAnnotations(),
			OwnerReferences:            obj.GetOwnerReferences(),
			Finalizers:                 obj.GetFinalizers(),
			ManagedFields:              obj.GetManagedFields(),
		},
		Spec:         spec,
		Subresources: obj.GetSubresources(),
	}, nil
}
