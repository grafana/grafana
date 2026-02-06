package operator

import (
	"context"
	"fmt"
	"math/rand"
	"slices"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

type finalizerUpdater struct {
	client PatchClient
}

func newFinalizerUpdater(client PatchClient) *finalizerUpdater {
	return &finalizerUpdater{
		client: client,
	}
}

func (o *finalizerUpdater) AddFinalizer(ctx context.Context, object resource.Object, finalizer string) error {
	err := o.doAddFinalizer(ctx, object, finalizer)
	attempts := 0
	// If we run into a conflict, retry a few times
	for err != nil && apierrors.IsConflict(err) && attempts < 3 {
		logging.FromContext(ctx).Debug("conflict adding finalizer, retrying after small delay", "finalizer", finalizer)
		// Simple wait in case we've got multiple operators working on this
		time.Sleep(time.Second*time.Duration(attempts) + o.jitter(time.Millisecond, 500))
		// Try again with an updated object
		err = o.client.GetInto(ctx, object.GetStaticMetadata().Identifier(), object)
		if err != nil {
			return fmt.Errorf("unable to get updated object to add finalizer: %w", err)
		}
		err = o.doAddFinalizer(ctx, object, finalizer)
		attempts++
	}
	return err
}

func (o *finalizerUpdater) doAddFinalizer(ctx context.Context, object resource.Object, finalizer string) error {
	finalizers := object.GetFinalizers()
	if slices.Contains(finalizers, finalizer) {
		// Finalizer already added
		return nil
	}

	req := resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/metadata/finalizers",
			Value:     []string{finalizer},
		}, {
			Operation: resource.PatchOpReplace,
			Path:      "/metadata/resourceVersion",
			Value:     object.GetResourceVersion(),
		}},
	}
	if len(finalizers) > 0 {
		req = resource.PatchRequest{
			Operations: []resource.PatchOperation{{
				Operation: resource.PatchOpAdd,
				Path:      "/metadata/finalizers/-",
				Value:     finalizer,
			}, {
				Operation: resource.PatchOpReplace,
				Path:      "/metadata/resourceVersion",
				Value:     object.GetResourceVersion(),
			}},
		}
	}

	err := o.client.PatchInto(ctx, object.GetStaticMetadata().Identifier(), req, resource.PatchOptions{}, object)
	if err != nil {
		return NewFinalizerOperationError(err, req)
	}
	return nil
}

func (o *finalizerUpdater) ReplaceFinalizer(ctx context.Context, object resource.Object, toReplace, replaceWith string) error {
	err := o.doReplaceFinalizer(ctx, object, toReplace, replaceWith)
	attempts := 0
	// If we run into a conflict, retry a few times
	for err != nil && apierrors.IsConflict(err) && attempts < 3 {
		logging.FromContext(ctx).Debug("conflict replacing finalizer, retrying after small delay", "toReplace", toReplace, "replaceWith", replaceWith)
		// Simple wait in case we've got multiple operators working on this
		time.Sleep(time.Second*time.Duration(attempts) + o.jitter(time.Millisecond, 500))
		// Try again with an updated object
		err = o.client.GetInto(ctx, object.GetStaticMetadata().Identifier(), object)
		if err != nil {
			return fmt.Errorf("unable to get updated object to add finalizer: %w", err)
		}
		err = o.doReplaceFinalizer(ctx, object, toReplace, replaceWith)
		attempts++
	}
	return err
}

func (o *finalizerUpdater) doReplaceFinalizer(ctx context.Context, object resource.Object, toReplace, replaceWith string) error {
	finalizers := object.GetFinalizers()
	if slices.Contains(finalizers, replaceWith) {
		// Finalizer already added, check if toReplace is already removed (and remove it if it's still present)
		if slices.Contains(finalizers, toReplace) {
			return o.doRemoveFinalizer(ctx, object, toReplace)
		}
		return nil
	}
	if !slices.Contains(finalizers, toReplace) {
		// toReplace already removed, just add replaceWith
		return o.doAddFinalizer(ctx, object, toReplace)
	}

	req := resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpReplace,
			Path:      fmt.Sprintf("/metadata/finalizers/%d", slices.Index(finalizers, toReplace)),
			Value:     replaceWith,
		}, {
			Operation: resource.PatchOpReplace,
			Path:      "/metadata/resourceVersion",
			Value:     object.GetResourceVersion(),
		}},
	}
	err := o.client.PatchInto(ctx, object.GetStaticMetadata().Identifier(), req, resource.PatchOptions{}, object)
	if err != nil {
		return NewFinalizerOperationError(err, req)
	}
	return nil
}

func (o *finalizerUpdater) RemoveFinalizer(ctx context.Context, object resource.Object, finalizer string) error {
	err := o.doRemoveFinalizer(ctx, object, finalizer)
	attempts := 0
	// If we run into a conflict, retry a few times
	for err != nil && apierrors.IsConflict(err) && attempts < 3 {
		logging.FromContext(ctx).Debug("conflict removing finalizer, retrying after small delay", "finalizer", finalizer)
		// Simple wait in case we've got multiple operators working on this
		time.Sleep(time.Second*time.Duration(attempts) + o.jitter(time.Millisecond, 500))
		// Try again with an updated object
		err = o.client.GetInto(ctx, object.GetStaticMetadata().Identifier(), object)
		if err != nil {
			return fmt.Errorf("unable to get updated object to add finalizer: %w", err)
		}
		err = o.doRemoveFinalizer(ctx, object, finalizer)
		attempts++
	}
	return err
}

func (o *finalizerUpdater) doRemoveFinalizer(ctx context.Context, object resource.Object, finalizer string) error {
	var (
		finalizers = make([]string, 0, len(object.GetFinalizers()))
		found      = false
	)

	for _, f := range object.GetFinalizers() {
		if f == finalizer {
			found = true
			continue
		}

		finalizers = append(finalizers, f)
	}

	if !found {
		return nil
	}

	req := resource.PatchRequest{
		Operations: []resource.PatchOperation{
			{
				Operation: resource.PatchOpReplace,
				Path:      "/metadata/finalizers",
				Value:     finalizers,
			}, {
				Operation: resource.PatchOpReplace,
				Path:      "/metadata/resourceVersion",
				Value:     object.GetResourceVersion(),
			},
		},
	}

	if err := o.client.PatchInto(
		ctx, object.GetStaticMetadata().Identifier(), req, resource.PatchOptions{}, object,
	); err != nil {
		return NewFinalizerOperationError(err, req)
	}

	return nil
}

// gosec linter gets mad about math/rand, but we don't need secure random for time jitter
//
//nolint:gosec,revive
func (*finalizerUpdater) jitter(unit time.Duration, max int) time.Duration {
	return time.Duration(rand.Intn(max)) * unit
}
