package router

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/plugin"
	"github.com/grafana/grafana-app-sdk/resource"
)

// Store is the interface for a CRD storage component.
type Store interface {
	Add(ctx context.Context, obj resource.Object) (resource.Object, error)
	Get(ctx context.Context, kind string, identifier resource.Identifier) (resource.Object, error)
	List(ctx context.Context, kind string, options resource.StoreListOptions) (resource.ListObject, error)
	Update(ctx context.Context, obj resource.Object) (resource.Object, error)
	Delete(ctx context.Context, kind string, identifier resource.Identifier) error
}

// ResourceGroupRouter is a Router which exposes generic CRUD routes for every resource contained in a given group.
type ResourceGroupRouter struct {
	*JSONRouter
	resourceGroup resource.KindCollection
	namespace     string
	store         Store
}

// NewResourceGroupRouter returns a new ResourceGroupRouter,
// exposing CRUD routes to manipulate resources in given group.
func NewResourceGroupRouter(
	resourceGroup resource.KindCollection,
	namespace string,
	clientGenerator resource.ClientGenerator,
) (*ResourceGroupRouter, error) {
	store := resource.NewStore(clientGenerator, resourceGroup)

	return NewResourceGroupRouterWithStore(resourceGroup, namespace, store)
}

// NewResourceGroupRouterWithStore returns a new ResourceGroupRouter with pre-configured Store.
func NewResourceGroupRouterWithStore(
	resourceGroup resource.KindCollection,
	namespace string,
	store Store,
) (*ResourceGroupRouter, error) {
	router := &ResourceGroupRouter{
		JSONRouter:    NewJSONRouter(),
		resourceGroup: resourceGroup,
		store:         store,
		namespace:     namespace,
	}

	for _, schema := range router.resourceGroup.Kinds() {
		// TODO: all possible versions for each kind should be handled, address this with SchemaGroup in codegen?
		baseRoute := fmt.Sprintf(
			"%s/%s/%s",
			schema.Group(),
			schema.Version(),
			schema.Plural(),
		)

		router.HandleWithCode(
			baseRoute, router.createResource(schema), http.StatusAccepted, http.MethodPost,
		)
		router.Handle(
			baseRoute, router.listResources(schema), http.MethodGet,
		)
		router.Handle(
			fmt.Sprintf("%s/{name}", baseRoute), router.getResource(schema), http.MethodGet,
		)
		router.HandleWithCode(
			fmt.Sprintf("%s/{name}", baseRoute), router.updateResource(schema), http.StatusAccepted, http.MethodPut,
		)
		router.Handle(
			fmt.Sprintf("%s/{name}", baseRoute), router.deleteResource(schema), http.MethodDelete,
		)
	}

	return router, nil
}

func (router *ResourceGroupRouter) createResource(cr resource.Schema) JSONHandlerFunc {
	return func(ctx context.Context, request JSONRequest) (JSONResponse, error) {
		toBeInserted := cr.ZeroValue()
		// TODO: use Unmarshal() method for version stuff
		if err := json.NewDecoder(request.Body).Decode(toBeInserted); err != nil {
			return nil, plugin.WrapError(http.StatusBadRequest, err)
		}
		// The only bit of static metadata the user can specify here is the name
		toBeInserted.SetStaticMetadata(resource.StaticMetadata{
			Name:      toBeInserted.GetName(),
			Namespace: router.namespace,
			Group:     cr.Group(),
			Version:   cr.Version(),
			Kind:      cr.Kind(),
		})

		addedResource, err := router.store.Add(ctx, toBeInserted)
		if err != nil {
			return nil, plugin.WrapError(http.StatusInternalServerError, err)
		}

		return addedResource, nil
	}
}

func (router *ResourceGroupRouter) listResources(cr resource.Schema) JSONHandlerFunc {
	return func(ctx context.Context, _ JSONRequest) (JSONResponse, error) {
		resources, err := router.store.List(ctx, cr.Kind(), resource.StoreListOptions{Namespace: router.namespace}) // TODO: support labels and pagination
		if err != nil {
			return nil, plugin.WrapError(http.StatusInternalServerError, err)
		}

		return resources, nil
	}
}

func (router *ResourceGroupRouter) getResource(cr resource.Schema) JSONHandlerFunc {
	return func(ctx context.Context, request JSONRequest) (JSONResponse, error) {
		name, ok := request.Vars.Get("name")
		if !ok {
			return nil, plugin.NewError(http.StatusBadRequest, "must provide resource name")
		}

		obj, err := router.store.Get(ctx, cr.Kind(), resource.Identifier{
			Namespace: router.namespace,
			Name:      name,
		})
		if err != nil {
			return nil, plugin.WrapError(http.StatusInternalServerError, err)
		}

		return obj, nil
	}
}

func (router *ResourceGroupRouter) updateResource(cr resource.Schema) JSONHandlerFunc {
	return func(ctx context.Context, request JSONRequest) (JSONResponse, error) {
		if _, ok := request.Vars.Get("name"); !ok {
			return nil, plugin.NewError(http.StatusBadRequest, "must provide resource name")
		}

		updatedResource := cr.ZeroValue()
		if err := json.NewDecoder(request.Body).Decode(updatedResource); err != nil {
			return nil, plugin.WrapError(http.StatusBadRequest, err)
		}
		// The only bit of static metadata the user can specify here is the name
		updatedResource.SetStaticMetadata(resource.StaticMetadata{
			Name:      updatedResource.GetName(),
			Namespace: router.namespace,
			Group:     cr.Group(),
			Version:   cr.Version(),
			Kind:      cr.Kind(),
		})

		updated, err := router.store.Update(ctx, updatedResource)
		if err != nil {
			return nil, plugin.WrapError(http.StatusInternalServerError, err)
		}

		return updated, nil
	}
}

func (router *ResourceGroupRouter) deleteResource(cr resource.Schema) JSONHandlerFunc {
	return func(ctx context.Context, request JSONRequest) (JSONResponse, error) {
		name, ok := request.Vars.Get("name")
		if !ok {
			return nil, plugin.NewError(http.StatusBadRequest, "must provide resource name")
		}

		if err := router.store.Delete(ctx, cr.Kind(), resource.Identifier{
			Namespace: router.namespace,
			Name:      name,
		}); err != nil {
			return nil, plugin.WrapError(http.StatusInternalServerError, err)
		}

		return nil, nil
	}
}
