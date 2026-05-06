package resource

import (
	"context"
	"fmt"
)

// TypedClient is a wrapper around a Client that works with a specific Object type.
// It is used to provide type safety and convenience methods for working with a specific object type.
// It automatically sets the GroupVersionKind on the provided object type when creating or updating resources,
// which means that the caller doesn't need to ensure that they are set in advance.
type TypedClient[T Object, L ListObject] struct {
	cli  Client
	kind Kind
}

// NewTypedClient creates a new TypedClient.
// It requires the caller to provide the kind, because it's possible that empty objects of the provided type
// will not have their kind set.
func NewTypedClient[T Object, L ListObject](cli Client, kind Kind) *TypedClient[T, L] {
	return &TypedClient[T, L]{
		cli:  cli,
		kind: kind,
	}
}

// List returns the list of objects of the provided type.
func (c *TypedClient[T, L]) List(ctx context.Context, namespace string, opts ListOptions) (L, error) {
	var res L

	v, err := c.cli.List(ctx, namespace, opts)
	if err != nil {
		return res, err
	}

	res, ok := v.(L)
	if !ok {
		return res, fmt.Errorf("expected %T, got %T", res, v)
	}

	return res, nil
}

// Watch returns an untyped watch response.
// It is the same as calling the underlying client's Watch method.
// Due to how the SDK handles watch responses, it is currently not possible to provide a type-safe watch response.
func (c *TypedClient[T, L]) Watch(ctx context.Context, namespace string, opts WatchOptions) (WatchResponse, error) {
	return c.cli.Watch(ctx, namespace, opts)
}

// Get returns an object of the provided type.
func (c *TypedClient[T, L]) Get(ctx context.Context, id Identifier) (T, error) {
	var res T

	v, err := c.cli.Get(ctx, id)
	if err != nil {
		return res, err
	}

	res, ok := v.(T)
	if !ok {
		return res, fmt.Errorf("expected %T, got %T", res, v)
	}

	return res, nil
}

// Create creates the provided object.
// It automatically sets the GroupVersionKind on the provided object type when creating resources,
// so the caller doesn't need to ensure that they are set in advance.
func (c *TypedClient[T, L]) Create(ctx context.Context, obj T, opts CreateOptions) (T, error) {
	obj.SetGroupVersionKind(c.kind.GroupVersionKind())

	var res T

	v, err := c.cli.Create(ctx, obj.GetStaticMetadata().Identifier(), obj, opts)
	if err != nil {
		return res, err
	}

	res, ok := v.(T)
	if !ok {
		return res, fmt.Errorf("expected %T, got %T", res, v)
	}

	return res, nil
}

// Update updates the provided object.
// It automatically sets the GroupVersionKind on the provided object type when updating resources,
// so the caller doesn't need to ensure that they are set in advance.
func (c *TypedClient[T, L]) Update(ctx context.Context, obj T, opts UpdateOptions) (T, error) {
	obj.SetGroupVersionKind(c.kind.GroupVersionKind())

	var res T
	v, err := c.cli.Update(ctx, obj.GetStaticMetadata().Identifier(), obj, opts)
	if err != nil {
		return res, err
	}

	res, ok := v.(T)
	if !ok {
		return res, fmt.Errorf("expected %T, got %T", res, v)
	}

	return res, nil
}

// Patch patches the provided object.
func (c *TypedClient[T, L]) Patch(ctx context.Context, id Identifier, req PatchRequest, opts PatchOptions) (T, error) {
	var res T

	v, err := c.cli.Patch(ctx, id, req, opts)
	if err != nil {
		return res, err
	}

	res, ok := v.(T)
	if !ok {
		return res, fmt.Errorf("expected %T, got %T", res, v)
	}

	return res, nil
}

// Delete deletes the provided object.
func (c *TypedClient[T, L]) Delete(ctx context.Context, id Identifier, opts DeleteOptions) error {
	return c.cli.Delete(ctx, id, opts)
}

// SubresourceRequest makes a request to a resource's subresource path using the provided verb.
// It returns the raw bytes of the response, or an error if the request returns an error.
func (c *TypedClient[T, L]) SubresourceRequest(ctx context.Context, id Identifier, opts CustomRouteRequestOptions) ([]byte, error) {
	return c.cli.SubresourceRequest(ctx, id, opts)
}
