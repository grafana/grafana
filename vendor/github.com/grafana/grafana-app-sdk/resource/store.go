package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// TODO: rewrite the godocs, this is all copied from crd/store.go

// SubresourceName is a string wrapper type for CRD subresource names
type SubresourceName string

// Subresource object names.
// As a "minimum supported set" in the SDK, we only present two predefined names,
// as only `status` and `scale` are allowed in CRDs,
// per https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/#subresources
// Additional subresource names can be defined by implementers, but be aware of your storage system's restrictions.
const (
	SubresourceStatus = SubresourceName("status")
	SubresourceScale  = SubresourceName("scale")
)

type KindCollection interface {
	Kinds() []Kind
}

type StoreListOptions struct {
	Namespace      string
	PerPage        int
	Filters        []string
	FieldSelectors []string
}

// Store presents Schema's resource Objects as a simple Key-Value store,
// abstracting the need to track clients or issue requests.
// If you wish to directly use a client managed by the store,
// the Client method returns the client used for a specific Schema.
type Store struct {
	clients ClientGenerator
	types   map[string]Kind
}

// NewStore creates a new SchemaStore, optionally initially registering all Schemas in the provided SchemaGroups
func NewStore(gen ClientGenerator, groups ...KindCollection) *Store {
	s := Store{
		clients: gen,
		types:   make(map[string]Kind),
	}
	for _, g := range groups {
		s.RegisterGroup(g)
	}
	return &s
}

// Register makes the store aware of a given Schema, and adds it to the list of `kind` values
// that can be supplied in calls. If a different schema with the same kind already exists, it will be overwritten.
func (s *Store) Register(sch Kind) {
	s.types[sch.Kind()] = sch
}

// RegisterGroup calls Register on each Schema in the provided SchemaGroup
func (s *Store) RegisterGroup(group KindCollection) {
	for _, sch := range group.Kinds() {
		s.Register(sch)
	}
}

// Get gets a resource with the provided kind and identifier
func (s *Store) Get(ctx context.Context, kind string, identifier Identifier) (Object, error) {
	client, err := s.getClient(kind)
	if err != nil {
		return nil, err
	}
	return client.Get(ctx, identifier)
}

// Add adds the provided resource.
// This method expects the provided Object's StaticMetadata to have the Name, Namespace, and Kind appropriately set.
// If they are not, no request will be issued to the underlying client, and an error will be returned.
func (s *Store) Add(ctx context.Context, obj Object) (Object, error) {
	if obj.GetStaticMetadata().Kind == "" {
		return nil, errors.New("obj.GetStaticMetadata().Kind must not be empty")
	}
	if obj.GetNamespace() == "" {
		return nil, errors.New("obj.GetNamespace() must not be empty")
	}
	if obj.GetName() == "" {
		return nil, errors.New("obj.GetName() must not be empty")
	}

	client, err := s.getClient(obj.GetStaticMetadata().Kind)
	if err != nil {
		return nil, err
	}

	return client.Create(ctx, obj.GetStaticMetadata().Identifier(), obj, CreateOptions{})
}

// SimpleAdd is a variation of Add that has the caller explicitly supply Identifier and kind as arguments,
// which will overwrite whatever is set in the obj argument's metadata.
func (s *Store) SimpleAdd(ctx context.Context, kind string, identifier Identifier, obj Object) (Object, error) {
	client, err := s.getClient(kind)
	if err != nil {
		return nil, err
	}

	return client.Create(ctx, identifier, obj, CreateOptions{})
}

// Update updates the provided object.
// Keep in mind that an Update will completely overwrite the object,
// so nil or missing values will be removed, not ignored.
// It is usually best to use the result of a Get call, change the appropriate values, and then call Update with that.
// The update will fail if no ResourceVersion is provided, or if the ResourceVersion does not match the current one.
// It returns the updated Object from the storage system.
func (s *Store) Update(ctx context.Context, obj Object) (Object, error) {
	if obj.GetStaticMetadata().Kind == "" {
		return nil, errors.New("obj.GetStaticMetadata().Kind must not be empty")
	}
	if obj.GetNamespace() == "" {
		return nil, errors.New("obj.GetNamespace() must not be empty")
	}
	if obj.GetName() == "" {
		return nil, errors.New("obj.GetName() must not be empty")
	}

	md := obj.GetCommonMetadata()
	md.UpdateTimestamp = time.Now().UTC()
	obj.SetCommonMetadata(md)

	client, err := s.getClient(obj.GetStaticMetadata().Kind)
	if err != nil {
		return nil, err
	}

	return client.Update(ctx, obj.GetStaticMetadata().Identifier(), obj, UpdateOptions{
		ResourceVersion: obj.GetResourceVersion(),
	})
}

// UpdateSubresource updates a subresource of an object.
// The provided obj parameter should be the subresource object, not the entire object.
// No checks are made that the provided object matches the subresource's definition.
func (s *Store) UpdateSubresource(
	ctx context.Context, kind string, identifier Identifier, subresourceName SubresourceName, obj any,
) (Object, error) {
	client, err := s.getClient(kind)
	if err != nil {
		return nil, err
	}
	if subresourceName == "" {
		return nil, errors.New("subresourceName cannot be empty")
	}

	srBytes, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}

	toUpdate := UntypedObject{
		Subresources: map[string]json.RawMessage{
			string(subresourceName): srBytes,
		},
	}

	return client.Update(ctx, identifier, &toUpdate, UpdateOptions{
		Subresource: string(subresourceName),
	})
}

// Upsert updates/creates the provided object.
// Keep in mind that an Upsert will completely overwrite the object,
// so nil or missing values will be removed, not ignored.
// It is usually best to use the result of a Get call, change the appropriate values, and then call Update with that.
// The update will fail if no ResourceVersion is provided, or if the ResourceVersion does not match the current one.
// It returns the updated/created Object from the storage system.
func (s *Store) Upsert(ctx context.Context, obj Object) (Object, error) {
	if obj.GetStaticMetadata().Kind == "" {
		return nil, errors.New("obj.GetStaticMetadata().Kind must not be empty")
	}
	if obj.GetNamespace() == "" {
		return nil, errors.New("obj.GetNamespace() must not be empty")
	}
	if obj.GetName() == "" {
		return nil, errors.New("obj.GetName() must not be empty")
	}

	client, err := s.getClient(obj.GetStaticMetadata().Kind)
	if err != nil {
		return nil, err
	}

	resp, err := client.Get(ctx, obj.GetStaticMetadata().Identifier())
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, err
	}

	if resp != nil {
		md := obj.GetCommonMetadata()
		md.UpdateTimestamp = time.Now().UTC()
		obj.SetCommonMetadata(md)
		return client.Update(ctx, Identifier{
			Namespace: obj.GetNamespace(),
			Name:      obj.GetName(),
		}, obj, UpdateOptions{
			ResourceVersion: obj.GetResourceVersion(),
		})
	}
	return client.Create(ctx, Identifier{
		Namespace: obj.GetNamespace(),
		Name:      obj.GetName(),
	}, obj, CreateOptions{})
}

// Delete deletes a resource with the given Identifier and kind.
func (s *Store) Delete(ctx context.Context, kind string, identifier Identifier) error {
	client, err := s.getClient(kind)
	if err != nil {
		return err
	}

	return client.Delete(ctx, identifier, DeleteOptions{})
}

// ForceDelete deletes a resource with the given Identifier and kind, ignores client 404 errors.
func (s *Store) ForceDelete(ctx context.Context, kind string, identifier Identifier) error {
	client, err := s.getClient(kind)
	if err != nil {
		return err
	}

	err = client.Delete(ctx, identifier, DeleteOptions{})

	if apierrors.IsNotFound(err) {
		return nil
	}
	return err
}

// List lists all resources using the Namespace and Filters provided in options. An empty namespace in options is
// equivalent to NamespaceAll, and an empty or nil Filters slice will be ignored.
// List will automatically paginate through results, fetching pages based on options.PerPage.
// To list a single page of results, use ListPage.
func (s *Store) List(ctx context.Context, kind string, options StoreListOptions) (ListObject, error) {
	client, err := s.getClient(kind)
	if err != nil {
		return nil, err
	}
	resp, err := client.List(ctx, options.Namespace, ListOptions{
		Limit:          options.PerPage,
		LabelFilters:   options.Filters,
		FieldSelectors: options.FieldSelectors,
	})
	if err != nil {
		return nil, err
	}
	for resp.GetContinue() != "" {
		page, err := client.List(ctx, options.Namespace, ListOptions{
			Continue:       resp.GetContinue(),
			Limit:          options.PerPage,
			LabelFilters:   options.Filters,
			FieldSelectors: options.FieldSelectors,
		})
		if err != nil {
			return nil, err
		}
		resp.SetContinue(page.GetContinue())
		resp.SetResourceVersion(page.GetResourceVersion())
		resp.SetItems(append(resp.GetItems(), page.GetItems()...))
	}
	return resp, nil
}

// ListPage lists a single page of resources, with no auto-paging logic like List.
// This is semantically identical to calling Client(kind).List(ctx, namespace, options)
func (s *Store) ListPage(ctx context.Context, kind string, namespace string, options ListOptions) (ListObject, error) {
	client, err := s.getClient(kind)
	if err != nil {
		return nil, err
	}

	return client.List(ctx, namespace, options)
}

// Client returns a Client for the provided kind, if that kind is tracked by the Store
func (s *Store) Client(kind string) (Client, error) {
	client, err := s.getClient(kind)
	if err != nil {
		return nil, err
	}
	return client, nil
}

func (s *Store) getClient(kind string) (Client, error) {
	schema, ok := s.types[kind]
	if !ok {
		return nil, fmt.Errorf("resource kind '%s' is not registered in store", kind)
	}
	client, err := s.clients.ClientFor(schema)
	if err != nil {
		return nil, err
	}
	return client, nil
}
