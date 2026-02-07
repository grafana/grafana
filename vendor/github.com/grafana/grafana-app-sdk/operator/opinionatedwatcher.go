package operator

import (
	"context"
	"errors"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/codes"
	"k8s.io/utils/strings/slices"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"
)

// PatchClient is a Client capable of making PatchInto requests. This is used by OpinionatedWatch to update finalizers.
type PatchClient interface {
	PatchInto(context.Context, resource.Identifier, resource.PatchRequest, resource.PatchOptions, resource.Object) error
	GetInto(context.Context, resource.Identifier, resource.Object) error
}

// FinalizerUpdater is an interface which describes a type which can manipulate finalizers for an object,
// Updating them in the API server and updating the provided object with the current state of the entire object after the update.
type FinalizerUpdater interface {
	// AddFinalizer adds a finalizer to the provided object, and serializes the updated object back into the `obj` parameter
	AddFinalizer(ctx context.Context, obj resource.Object, finalizer string) error
	// ReplaceFinalizer replaces a finalizer in the provided object, and serializes the updated object back into the `obj` parameter
	ReplaceFinalizer(ctx context.Context, obj resource.Object, toReplace, replaceWith string) error
	// RemoveFinalizer removes a finalizer from the provided object, and serializes the updated object back into the `obj` parameter
	RemoveFinalizer(ctx context.Context, obj resource.Object, finalizer string) error
}

// OpinionatedWatcher is a ResourceWatcher implementation that handles extra state logic,
// ensuring that downtime and restarts will not result in missed events.
// It does this via a few mechanisms is transparently handles for the user:
//
// It adds a finalizer for all newly-created resources.
// This ensures that deletes cannot complete until the finalizer is removed,
// so the event will not be missed if the operator is down.
//
// It only removes the finalizer after a successful call to `DeleteFunc`,
// which ensures that the resource is only deleted once the handler has succeeded.
//
// On startup, it is able to differentiate between `Add` events,
// which are newly-created resources the operator has not yet handled,
// and `Add` events which are previously-created resources that have already been handled by the operator.
// Fully new resources call the `AddFunc` handler,
// and previously-created call the `SyncFunc` handler.
//
// `Update` events which do not update anything in the spec or significant parts of the metadata are ignored.
//
// OpinionatedWatcher contains unexported fields, and must be created with NewOpinionatedWatcher
type OpinionatedWatcher struct {
	AddFunc             func(ctx context.Context, object resource.Object) error
	UpdateFunc          func(ctx context.Context, src resource.Object, tgt resource.Object) error
	DeleteFunc          func(ctx context.Context, object resource.Object) error
	SyncFunc            func(ctx context.Context, object resource.Object) error
	finalizer           string
	addPendingFinalizer string
	schema              resource.Schema
	collectors          []prometheus.Collector
	finalizerUpdater    finalizerUpdater
}

// FinalizerSupplier represents a function that creates string finalizer from provider schema.
type FinalizerSupplier func(sch resource.Schema) string

// DefaultFinalizerSupplier crates finalizer following to pattern `operator.{version}.{kind}.{group}`.
func DefaultFinalizerSupplier(sch resource.Schema) string {
	return fmt.Sprintf("operator.%s.%s.%s", sch.Version(), sch.Kind(), sch.Group())
}

func InProgressFinalizerSupplier(sch resource.Schema) string {
	return fmt.Sprintf("wip.%s.%s.%s", sch.Version(), sch.Kind(), sch.Group())
}

// OpinionatedWatcherConfig contains configuration options for creating a new OpinionatedWatcher
type OpinionatedWatcherConfig struct {
	// Finalizer supplies the finalizer used for the OpinionatedWatcher.
	// If nil, DefaultFinalizerSupplier will be used.
	Finalizer FinalizerSupplier
	// InProgressFinalizer supplies the finalizer used to indicate an incomplete action and prevent deletes until completion.
	// If nil, InProgressFinalizerSupplier will be used.
	InProgressFinalizer FinalizerSupplier
}

// NewOpinionatedWatcher sets up a new OpinionatedWatcher and returns a pointer to it.
func NewOpinionatedWatcher(sch resource.Schema, client PatchClient, config OpinionatedWatcherConfig) (*OpinionatedWatcher, error) {
	if sch == nil {
		return nil, errors.New("schema cannot be nil")
	}
	if client == nil {
		return nil, errors.New("client cannot be nil")
	}
	supplier := config.Finalizer
	if supplier == nil {
		supplier = DefaultFinalizerSupplier
	}
	finalizer := supplier(sch)
	if len(finalizer) > 63 {
		return nil, fmt.Errorf("finalizer length cannot exceed 63 chars: %s", finalizer)
	}
	pendingAddSupplier := config.InProgressFinalizer
	if pendingAddSupplier == nil {
		pendingAddSupplier = InProgressFinalizerSupplier
	}
	pendingAddFinalizer := pendingAddSupplier(sch)
	if len(pendingAddFinalizer) > 63 {
		return nil, fmt.Errorf("in-progress finalizer length cannot exceed 63 chars: %s", finalizer)
	}
	return &OpinionatedWatcher{
		finalizerUpdater:    *newFinalizerUpdater(client),
		schema:              sch,
		finalizer:           finalizer,
		addPendingFinalizer: pendingAddFinalizer,
		collectors:          make([]prometheus.Collector, 0),
	}, nil
}

// Wrap wraps the Add, Update, and Delete calls in another ResourceWatcher by having the AddFunc call watcher.
// Add, UpdateFunc call watcher.Update, and DeleteFunc call watcher.Delete.
// If syncToAdd is true, SyncFunc will also call resource.Add. If it is false, SyncFunc will not be assigned.
func (o *OpinionatedWatcher) Wrap(watcher ResourceWatcher, syncToAdd bool) { // nolint: revive
	if watcher == nil {
		return
	}

	o.AddFunc = watcher.Add
	o.UpdateFunc = watcher.Update
	o.DeleteFunc = watcher.Delete
	if syncToAdd {
		o.SyncFunc = watcher.Add
	}

	if cast, ok := watcher.(metrics.Provider); ok {
		o.collectors = append(o.collectors, cast.PrometheusCollectors()...)
	}
}

// Add is part of implementing ResourceWatcher,
// and calls the underlying AddFunc, SyncFunc, or DeleteFunc based upon internal logic.
// When the object is first added, AddFunc is called and a finalizer is attached to it.
// Subsequent calls to Add will check the finalizer list and call SyncFunc if the finalizer is already attached,
// or if ObjectMetadata.DeletionTimestamp is non-nil, they will call DeleteFunc and remove the finalizer
// (the finalizer prevents the resource from being hard deleted until it is removed).
//
//nolint:funlen
func (o *OpinionatedWatcher) Add(ctx context.Context, object resource.Object) error {
	ctx, span := GetTracer().Start(ctx, "OpinionatedWatcher-add")
	defer span.End()
	if object == nil {
		span.SetStatus(codes.Error, "object cannot be nil")
		return errors.New("object cannot be nil")
	}

	logger := logging.FromContext(ctx).With("action", "add", "component", "OpinionatedWatcher", "kind", object.GroupVersionKind().Kind, "namespace", object.GetNamespace(), "name", object.GetName())
	logger.Debug("Handling add")

	finalizers := o.getFinalizers(object)

	// If we're pending deletion, check on the finalizers to see if it's waiting on us.
	// An "add" event would trigger if the informer was restart or resyncing,
	// so we may have missed the delete/update event.
	if object.GetDeletionTimestamp() != nil {
		span.AddEvent("object is deleted and pending finalizer removal")

		// Check if we're the finalizer it's waiting for. If we're not, we can drop this whole event.
		if !slices.Contains(finalizers, o.finalizer) && !slices.Contains(finalizers, o.addPendingFinalizer) {
			logger.Debug("Update has a DeletionTimestamp, but missing our finalizer, ignoring", "deletionTimestamp", object.GetDeletionTimestamp())
			return nil
		}

		// Otherwise, we need to run our delete handler, then remove the finalizer
		logger.Debug("Update has a DeletionTimestamp, calling Delete", "deletionTimestamp", object.GetDeletionTimestamp())
		err := o.deleteFunc(ctx, object)
		if err != nil {
			span.SetStatus(codes.Error, fmt.Sprintf("watcher delete error: %s", err.Error()))
			return err
		}

		// The remove finalizer code is shared by both our add and update handlers, as this logic can be hit from either
		if slices.Contains(finalizers, o.finalizer) {
			logger.Debug("Delete successful, removing finalizer", "finalizer", o.finalizer, "currentFinalizers", finalizers)
			err = o.finalizerUpdater.RemoveFinalizer(ctx, object, o.finalizer)
			if err != nil {
				span.SetStatus(codes.Error, fmt.Sprintf("error removing finalizer: %s", err.Error()))
				var chk FinalizerError
				if errors.As(err, &chk) {
					logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
				}
				logger.Error("error removing finalizer", "error", err.Error(), "kind", object.GroupVersionKind().Kind, "namespace", object.GetNamespace(), "name", object.GetName())
				return err
			}
		}
		if slices.Contains(finalizers, o.addPendingFinalizer) {
			logger.Debug("Delete successful, removing finalizer", "finalizer", o.addPendingFinalizer, "currentFinalizers", finalizers)
			err = o.finalizerUpdater.RemoveFinalizer(ctx, object, o.addPendingFinalizer)
			if err != nil {
				span.SetStatus(codes.Error, fmt.Sprintf("error removing finalizer: %s", err.Error()))
				var chk FinalizerError
				if errors.As(err, &chk) {
					logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
				}
				logger.Error("error removing in-progress finalizer", "error", err.Error(), "kind", object.GroupVersionKind().Kind, "namespace", object.GetNamespace(), "name", object.GetName())
				return err
			}
		}
		return nil
	}

	// Next, we need to check if our finalizer is already in the finalizer list.
	// If it is, we've already done the add logic on a previous run of the operator,
	// and this event is due to the list call on startup. In that case, we call our sync handler
	if slices.Contains(finalizers, o.finalizer) {
		span.AddEvent("object has watcher finalizer")
		logger.Debug("Object has our finalizer, calling Sync", "finalizers", finalizers)
		err := o.syncFunc(ctx, object)
		if err != nil {
			span.SetStatus(codes.Error, fmt.Sprintf("watcher sync error: %s", err.Error()))
			return err
		}
		// If we somehow still have the add-pending finalizer, remove it
		if slices.Contains(finalizers, o.addPendingFinalizer) {
			logger.Debug("Add-pending finalizer still on object, removing", "finalizer", o.addPendingFinalizer, "currentFinalizers", finalizers)
			err = o.finalizerUpdater.RemoveFinalizer(ctx, object, o.addPendingFinalizer)
			if err != nil {
				span.SetStatus(codes.Error, fmt.Sprintf("error removing finalizer: %s", err.Error()))
				var chk FinalizerError
				if errors.As(err, &chk) {
					logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
				}
				logger.Error("error removing in-progress finalizer", "error", err.Error(), "kind", object.GroupVersionKind().Kind, "namespace", object.GetNamespace(), "name", object.GetName())
				return err
			}
		}
		return nil
	}

	// If this isn't a delete or an add we've seen before, then it's a new resource we need to handle appropriately.
	// Call the add handler, and if it returns successfully (no error), add the finalizer.
	// Before we call the downstream add, add an "add pending" finalizer to prevent us missing a delete during the add process (and/or its retries)
	logger.Debug("Adding in-progress finalizer before add call", "finalizer", o.addPendingFinalizer, "currentFinalizers", finalizers)
	err := o.finalizerUpdater.AddFinalizer(ctx, object, o.addPendingFinalizer)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("finalizer add error: %s", err.Error()))
		var chk FinalizerError
		if errors.As(err, &chk) {
			logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
		}
		logger.Error("error adding in-progress finalizer", "error", err.Error(), "kind", object.GroupVersionKind().Kind, "namespace", object.GetNamespace(), "name", object.GetName())
		return fmt.Errorf("error adding in-progress finalizer: %w", err)
	}

	err = o.addFunc(ctx, object)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("watcher add error: %s", err.Error()))
		return err
	}

	// Add the finalizer
	logger.Debug("Successful Add call, adding finalizer and removing in-progress one", "finalizer", o.finalizer, "currentFinalizers", finalizers)
	err = o.finalizerUpdater.ReplaceFinalizer(ctx, object, o.addPendingFinalizer, o.finalizer)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("finalizer add error: %s", err.Error()))
		var chk FinalizerError
		if errors.As(err, &chk) {
			logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
		}
		logger.Error("error adding finalizer", "error", err.Error(), "kind", object.GroupVersionKind().Kind, "namespace", object.GetNamespace(), "name", object.GetName())
		return fmt.Errorf("error adding finalizer: %w", err)
	}
	return nil
}

// Update is part of implementing ResourceWatcher
// and calls the underlying UpdateFunc or DeleteFunc based on internal logic.
// If the new object has a non-nil ObjectMetadata.DeletionTimestamp in its metadata, DeleteFunc will be called,
// and the object's finalizer will be removed to allow kubernetes to hard delete it.
// Otherwise, UpdateFunc is called, provided the update is non-trivial (that is, the metadata.Generation has changed).
//
//nolint:funlen
func (o *OpinionatedWatcher) Update(ctx context.Context, src resource.Object, tgt resource.Object) error {
	ctx, span := GetTracer().Start(ctx, "OpinionatedWatcher-update")
	defer span.End()
	// TODO: If old is nil, it _might_ be ok?
	if src == nil {
		return errors.New("old cannot be nil")
	}
	if tgt == nil {
		return errors.New("new cannot be nil")
	}

	logger := logging.FromContext(ctx).With("action", "update", "component", "OpinionatedWatcher", "kind", tgt.GroupVersionKind().Kind, "namespace", tgt.GetNamespace(), "name", tgt.GetName())
	logger.Debug("Handling update")

	// Only fire off Update if the generation has changed (so skip subresource updates)
	if tgt.GetGeneration() > 0 && src.GetGeneration() == tgt.GetGeneration() {
		return nil
	}

	// TODO: finalizers part of object metadata?
	oldFinalizers := o.getFinalizers(src)
	newFinalizers := o.getFinalizers(tgt)
	if !slices.Contains(newFinalizers, o.finalizer) && tgt.GetDeletionTimestamp() == nil {
		// Either the add somehow snuck past us (unlikely), or the original AddFunc call failed, and should be retried.
		// Either way, we need to try calling AddFunc
		logger.Debug("Missing finalizer, calling Add")
		err := o.addFunc(ctx, tgt)
		if err != nil {
			span.SetStatus(codes.Error, fmt.Sprintf("watcher add error: %s", err.Error()))
			return err
		}
		// Add the finalizer (which also updates `new` inline)
		logger.Debug("Successful call to Add, add the finalizer to the object", "finalizer", o.finalizer)
		err = o.finalizerUpdater.ReplaceFinalizer(ctx, tgt, o.addPendingFinalizer, o.finalizer)
		if err != nil {
			span.SetStatus(codes.Error, fmt.Sprintf("watcher add finalizer error: %s", err.Error()))
			var chk FinalizerError
			if errors.As(err, &chk) {
				logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
			}
			logger.Error("error adding finalizer", "error", err.Error(), "kind", tgt.GroupVersionKind().Kind, "namespace", tgt.GetNamespace(), "name", tgt.GetName())
			return fmt.Errorf("error adding finalizer: %w", err)
		}
	}

	// Check if the deletion timestamp is non-nil.
	// This denotes that the resource was deletes, but has one or more finalizers blocking it from actually deleting.
	if tgt.GetDeletionTimestamp() != nil {
		// If our finalizer is in the list, treat this as a delete.
		// Otherwise, drop the event and don't handle it as an update.
		if !slices.Contains(newFinalizers, o.finalizer) && !slices.Contains(newFinalizers, o.addPendingFinalizer) {
			logger.Debug("Update has a DeletionTimestamp, but missing our finalizer, ignoring", "deletionTimestamp", tgt.GetDeletionTimestamp())
			return nil
		}

		// Call the delete handler, then remove the finalizer on success
		logger.Debug("Update has a DeletionTimestamp, calling Delete", "deletionTimestamp", tgt.GetDeletionTimestamp())
		err := o.deleteFunc(ctx, tgt)
		if err != nil {
			span.SetStatus(codes.Error, fmt.Sprintf("watcher delete error: %s", err.Error()))
			return err
		}

		if slices.Contains(newFinalizers, o.finalizer) {
			logger.Debug("Delete successful, removing finalizer", "finalizer", o.finalizer, "currentFinalizers", newFinalizers)
			err = o.finalizerUpdater.RemoveFinalizer(ctx, tgt, o.finalizer)
			if err != nil {
				span.SetStatus(codes.Error, fmt.Sprintf("error removing finalizer: %s", err.Error()))
				var chk FinalizerError
				if errors.As(err, &chk) {
					logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
				}
				logger.Error("error removing finalizer", "error", err.Error(), "kind", tgt.GroupVersionKind().Kind, "namespace", tgt.GetNamespace(), "name", tgt.GetName())
				return err
			}
		}
		if slices.Contains(newFinalizers, o.addPendingFinalizer) {
			logger.Debug("Delete successful, removing finalizer", "finalizer", o.addPendingFinalizer, "currentFinalizers", newFinalizers)
			err = o.finalizerUpdater.RemoveFinalizer(ctx, tgt, o.addPendingFinalizer)
			if err != nil {
				span.SetStatus(codes.Error, fmt.Sprintf("error removing finalizer: %s", err.Error()))
				var chk FinalizerError
				if errors.As(err, &chk) {
					logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
				}
				logger.Error("error removing in-progress finalizer", "error", err.Error(), "kind", tgt.GroupVersionKind().Kind, "namespace", tgt.GetNamespace(), "name", tgt.GetName())
				return err
			}
		}
		return nil
	}

	// Check if this was us adding our finalizer. If it was, we can ignore it.
	if !slices.Contains(oldFinalizers, o.finalizer) && slices.Contains(newFinalizers, o.finalizer) {
		logger.Debug("Finalizer add update, ignoring")
		return nil
	}

	err := o.updateFunc(ctx, src, tgt)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("watcher update error: %s", err.Error()))
		return err
	}
	return nil
}

// Delete exists to implement ResourceWatcher,
// but, due to deletes only happening after the finalizer is removed, this function does nothing.
func (*OpinionatedWatcher) Delete(context.Context, resource.Object) error {
	// Do nothing here, because we add finalizers, so we actually call delete code on updates/add-sync
	return nil
}

func (o *OpinionatedWatcher) PrometheusCollectors() []prometheus.Collector {
	return o.collectors
}

// addFunc is a wrapper for AddFunc which makes a nil check to avoid panics
func (o *OpinionatedWatcher) addFunc(ctx context.Context, object resource.Object) error {
	if o.AddFunc != nil {
		return o.AddFunc(ctx, object)
	}
	// TODO: log?
	return nil
}

// updateFunc is a wrapper for UpdateFunc which makes a nil check to avoid panics
func (o *OpinionatedWatcher) updateFunc(ctx context.Context, src, tgt resource.Object) error {
	if o.UpdateFunc != nil {
		return o.UpdateFunc(ctx, src, tgt)
	}
	// TODO: log?
	return nil
}

// deleteFunc is a wrapper for DeleteFunc which makes a nil check to avoid panics
func (o *OpinionatedWatcher) deleteFunc(ctx context.Context, object resource.Object) error {
	if o.DeleteFunc != nil {
		return o.DeleteFunc(ctx, object)
	}
	// TODO: log?
	return nil
}

// syncFunc is a wrapper for SyncFunc which makes a nil check to avoid panics
func (o *OpinionatedWatcher) syncFunc(ctx context.Context, object resource.Object) error {
	if o.SyncFunc != nil {
		return o.SyncFunc(ctx, object)
	}
	// TODO: log?
	return nil
}

func (*OpinionatedWatcher) getFinalizers(object resource.Object) []string {
	if object.GetFinalizers() != nil {
		return object.GetFinalizers()
	}
	return make([]string, 0)
}
