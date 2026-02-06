package resource

import (
	"context"
)

// NamespacedClient is a typed client that is scoped to a single namespace.
// It prevents the user from having to specify the namespace in every request.
type NamespacedClient[T Object, L ListObject] struct {
	cli       *TypedClient[T, L]
	namespace string
}

// NewNamespacedClient creates a new NamespacedClient.
func NewNamespaced[T Object, L ListObject](cli *TypedClient[T, L], namespace string) *NamespacedClient[T, L] {
	return &NamespacedClient[T, L]{
		cli:       cli,
		namespace: namespace,
	}
}

// List lists all resources in the namespace.
func (c *NamespacedClient[T, L]) List(ctx context.Context, opts ListOptions) (L, error) {
	return c.cli.List(ctx, c.namespace, opts)
}

// Watch watches all resources in the namespace.
func (c *NamespacedClient[T, L]) Watch(ctx context.Context, opts WatchOptions) (WatchResponse, error) {
	return c.cli.Watch(ctx, c.namespace, opts)
}

// Get gets a resource by name in the namespace.
func (c *NamespacedClient[T, L]) Get(ctx context.Context, uid string) (T, error) {
	return c.cli.Get(ctx, Identifier{
		Namespace: c.namespace,
		Name:      uid,
	})
}

// Create creates a resource in the namespace.
func (c *NamespacedClient[T, L]) Create(ctx context.Context, obj T, opts CreateOptions) (T, error) {
	obj.SetNamespace(c.namespace)
	return c.cli.Create(ctx, obj, opts)
}

// Update updates a resource in the namespace.
func (c *NamespacedClient[T, L]) Update(ctx context.Context, obj T, opts UpdateOptions) (T, error) {
	obj.SetNamespace(c.namespace)
	return c.cli.Update(ctx, obj, opts)
}

// Patch patches a resource in the namespace.
func (c *NamespacedClient[T, L]) Patch(
	ctx context.Context, uid string, req PatchRequest, opts PatchOptions,
) (T, error) {
	return c.cli.Patch(ctx, Identifier{
		Namespace: c.namespace,
		Name:      uid,
	}, req, opts)
}

// Delete deletes a resource in the namespace.
func (c *NamespacedClient[T, L]) Delete(ctx context.Context, uid string, opts DeleteOptions) error {
	return c.cli.Delete(ctx, Identifier{
		Namespace: c.namespace,
		Name:      uid,
	}, opts)
}

// SubresourceRequest makes a request to a resource's subresource path using the provided verb.
// It returns the raw bytes of the response, or an error if the request returns an error.
func (c *NamespacedClient[T, L]) SubresourceRequest(ctx context.Context, uid string, opts CustomRouteRequestOptions) ([]byte, error) {
	return c.cli.SubresourceRequest(ctx, Identifier{
		Namespace: c.namespace,
		Name:      uid,
	}, opts)
}
