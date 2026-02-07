package operator

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"k8s.io/utils/strings/slices"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

// ReconcileAction describes the action that triggered reconciliation.
type ReconcileAction int

const (
	// ReconcileActionUnknown represents an Unknown ReconcileAction
	ReconcileActionUnknown ReconcileAction = iota

	// ReconcileActionCreated indicates that the resource to reconcile has been created.
	// Note that this action may also be used on initial start-up of some informer-based implementations,
	// such as the KubernetesBasedInformer. To instead receive Resync actions for these events,
	// use the OpinionatedReconciler.
	ReconcileActionCreated

	// ReconcileActionUpdated indicates that the resource to reconcile has been updated.
	ReconcileActionUpdated

	// ReconcileActionDeleted indicates that the resource to reconcile has been deleted.
	// Note that if the resource has Finalizers attached to it, a ReconcileActionUpdated will be used to indicate
	// "tombstoning" of the resource where DeletionTimestamp is non-nil and Finalizers may only be removed.
	// On completion of the actual delete from the API server once the Finalizers list is empty,
	// a Delete reconcile action will be triggered.
	ReconcileActionDeleted

	// ReconcileActionResynced indicates a periodic or initial re-sync of existing resources in the API server.
	// Note that not all implementations support this action (KubernetesBasedInformer will only trigger Created,
	// Updated, and Deleted actions. You can use OpinionatedReconciler to introduce Resync events on start instead
	// of Add events).
	ReconcileActionResynced
)

// ReconcileRequest contains the action which took place, and a snapshot of the object at that point in time.
// The Object in the ReconcileRequest is not guaranteed to be the current state of the object in-storage,
// as other actions may have taken place subsequently.
//
// Controllers such as InformerController contain logic to dequeue ReconcileRequests if subsequent actions
// are received for the same object.
type ReconcileRequest struct {
	// Action is the action that triggered this ReconcileRequest
	Action ReconcileAction
	// Object is the object at the time of the received action
	Object resource.Object
	// State is a user-defined map of state values that can be provided on retried ReconcileRequests.
	// See State in ReconcileResult. It will always be nil on an initial Reconcile call,
	// and will only be non-nil if a prior Reconcile call with this ReconcileRequest returned a State
	// in its ReconcileResult alongside either a RequeueAfter or an error.
	State map[string]any
}

// ReconcileResult is the status of a successful Reconcile action.
// "Success" in this case simply indicates that unexpected errors did not occur,
// as the ReconcileResult can specify that the Reconcile action should be re-queued to run again
// after a period of time has elapsed.
type ReconcileResult struct {
	// RequeueAfter is a duration after which the Reconcile action which returned this result should be retried.
	// If nil, the Reconcile action will not be requeued.
	RequeueAfter *time.Duration
	// State can be used alongside RequeueAfter to add the provided state map to the ReconcileRequest supplied in the
	// future Reconcile call. This allows a Reconcile to "partially complete" and not have to re-do tasks
	// if it needs to wait on an additional bit of information or if a particular call results in a transient failure.
	State map[string]any
}

// Reconciler is an interface which describes an object which implements simple Reconciliation behavior.
type Reconciler interface {
	// Reconcile should be called whenever any action is received for a relevant object.
	// The action and object at the time the action was received are contained within the ReconcileRequest.
	// If the returned ReconcileResult has a non-nil RequeueAfter, the managing controller should requeue
	// the Reconcile action, with the same ReconcileRequest and context, after that duration has elapsed.
	// If the call returns an error, the Reconcile action should be requeued according to the retry policy
	// of the controller.
	Reconcile(ctx context.Context, req ReconcileRequest) (ReconcileResult, error)
}

// ReconcileActionFromResourceAction returns the equivalent ReconcileAction from a provided ResourceAction.
// If there is no equivalent, it returns ReconcileActionUnknown.
func ReconcileActionFromResourceAction(action ResourceAction) ReconcileAction {
	switch action {
	case ResourceActionCreate:
		return ReconcileActionCreated
	case ResourceActionUpdate:
		return ReconcileActionUpdated
	case ResourceActionDelete:
		return ReconcileActionDeleted
	case ResourceActionResync:
		return ReconcileActionResynced
	default:
		return ReconcileActionUnknown
	}
}

// ResourceActionFromReconcileAction returns the equivalent ResourceAction from a provided ReconcileAction.
// If there is no equivalent, it returns an empty ResourceAction.
func ResourceActionFromReconcileAction(action ReconcileAction) ResourceAction {
	switch action {
	case ReconcileActionCreated:
		return ResourceActionCreate
	case ReconcileActionUpdated:
		return ResourceActionUpdate
	case ReconcileActionDeleted:
		return ResourceActionDelete
	case ReconcileActionResynced:
		return ResourceActionResync
	default:
		return ResourceAction("")
	}
}

// NewOpinionatedReconciler creates a new OpinionatedReconciler.
// To have the new OpinionatedReconciler wrap an existing reconciler,
// set the `OpinionatedReconciler.Reconciler` value or use `OpinionatedReconciler.Wrap()`
func NewOpinionatedReconciler(client PatchClient, finalizer string) (*OpinionatedReconciler, error) {
	if client == nil {
		return nil, errors.New("client cannot be nil")
	}
	if finalizer == "" {
		return nil, errors.New("finalizer cannot be empty")
	}
	if len(finalizer) > 63 {
		return nil, fmt.Errorf("finalizer length cannot exceed 63 chars: %s", finalizer)
	}
	return &OpinionatedReconciler{
		finalizer:        finalizer,
		finalizerUpdater: newFinalizerUpdater(client),
	}, nil
}

// OpinionatedReconciler wraps an ordinary Reconciler with finalizer-based logic to convert "Created" events into
// "resync" events on start-up when the reconciler has handled the "created" event on a previous run,
// and ensures that "delete" events are not missed during reconciler down-time by using the finalizer.
type OpinionatedReconciler struct {
	Reconciler       Reconciler
	finalizer        string
	finalizerUpdater FinalizerUpdater
}

const (
	opinionatedReconcilerPatchAddStateKey    = "grafana-app-sdk-opinionated-reconciler-create-patch-status"
	opinionatedReconcilerPatchRemoveStateKey = "grafana-app-sdk-opinionated-reconciler-delete-patch-status"
)

// Reconcile consumes a ReconcileRequest and passes it off to the underlying ReconcileFunc, using the following criteria to modify or drop the request if needed:
//   - If the action is a Create, and the OpinionatedReconciler's finalizer is in the finalizer list, update the action to a Resync
//   - If the action is a Create, and the OpinionatedReconciler's finalizer is missing, add the finalizer after the delegated Reconcile request returns successfully
//   - If the action is an Update, and the DeletionTimestamp is non-nil, remove the OpinionatedReconciler's finalizer, and do not delegate (the subsequent Delete will be delegated)
//   - If the action is an Update, and the OpinionatedReconciler's finalizer is missing (and DeletionTimestamp is nil), add the finalizer, and do not delegate (the subsequent update action will delegate)
//
//nolint:funlen,gocognit
func (o *OpinionatedReconciler) Reconcile(ctx context.Context, request ReconcileRequest) (ReconcileResult, error) {
	ctx, span := GetTracer().Start(ctx, "OpinionatedReconciler-reconcile")
	defer span.End()
	logger := logging.FromContext(ctx).With("action", ResourceActionFromReconcileAction(request.Action), "component", "OpinionatedReconciler", "kind", request.Object.GroupVersionKind().Kind, "namespace", request.Object.GetNamespace(), "name", request.Object.GetName())
	logger.Debug("Reconcile request received")

	// Ignore deleted actions, as we send them on updates where we need to remove our finalizer
	// This needs to be checked before the "is deletionTimestamp non-nil and still has our finalizer",
	// because after we remove the finalizer, a delete event comes through that still has the final finalizer to be removed from the list
	if request.Action == ReconcileActionDeleted {
		logger.Debug("Not propagating delete event, as this is handled when deletionTimestamp is set to a non-nil value")
		return ReconcileResult{}, nil
	}
	// Check if the object is deleted.
	// If it's waiting on our finalizer, propagate as a DELETE event.
	// If it's not, drop the event.
	if request.Object.GetDeletionTimestamp() != nil && slices.Contains(request.Object.GetFinalizers(), o.finalizer) {
		res := ReconcileResult{}
		if request.State == nil || request.State[opinionatedReconcilerPatchRemoveStateKey] == nil {
			logger.Debug("Update added a deletionTimestamp, propagate this event as a delete", "deletionTimestamp", request.Object.GetDeletionTimestamp())
			// Propagate as a delete, if the delete succeeds, remove the finalizer
			request.Action = ReconcileActionDeleted
			var err error
			res, err = o.wrappedReconcile(ctx, request)
			if err != nil || res.RequeueAfter != nil {
				if res.RequeueAfter != nil {
					span.SetAttributes(attribute.String("reconcile.requeafter", res.RequeueAfter.String()))
				}
				if err != nil {
					span.SetStatus(codes.Error, fmt.Sprintf("watcher add error: %s", err.Error()))
				}
				return res, err
			}
		} else {
			logger.Debug("Retry of an update which added a deletionTimestamp, downstream reconciler already successfully processed delete, need to retry removing the finalizer", "patchError", request.State[opinionatedReconcilerPatchRemoveStateKey])
		}
		logger.Debug("Removing finalizer from object", "finalizer", o.finalizer)
		patchErr := o.finalizerUpdater.RemoveFinalizer(ctx, request.Object, o.finalizer)
		if patchErr != nil {
			span.SetStatus(codes.Error, fmt.Sprintf("error adding finalizer: %s", patchErr.Error()))
			if res.State == nil {
				res.State = make(map[string]any)
			}
			res.State[opinionatedReconcilerPatchRemoveStateKey] = patchErr
			var chk FinalizerError
			if errors.As(patchErr, &chk) {
				logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
			}
			logger.Error("error removing finalizer", "error", patchErr.Error(), "kind", request.Object.GroupVersionKind().Kind, "namespace", request.Object.GetNamespace(), "name", request.Object.GetName())
		}
		return res, patchErr
	}
	if request.Object.GetDeletionTimestamp() != nil {
		logger.Debug("Object has a deletionTimestamp but does not contain our finalizer, ignoring event as object delete has already been processed", "finalizer", o.finalizer, "deletionTimestamp", request.Object.GetDeletionTimestamp())
		return ReconcileResult{}, nil
	}

	// Check if this action is a create, and the resource already has a finalizer. If so, make it a sync.
	if request.Action == ReconcileActionCreated && slices.Contains(request.Object.GetFinalizers(), o.finalizer) {
		logger.Debug("Object already has the correct finalizer, converting to a Resync event and propagating", "finalizer", o.finalizer)
		request.Action = ReconcileActionResynced
		return o.wrappedReconcile(ctx, request)
	}
	if request.Action == ReconcileActionCreated {
		resp := ReconcileResult{}
		if request.State == nil || request.State[opinionatedReconcilerPatchAddStateKey] == nil {
			// Delegate
			var err error
			resp, err = o.wrappedReconcile(ctx, request)
			if err != nil || resp.RequeueAfter != nil {
				if resp.RequeueAfter != nil {
					span.SetAttributes(attribute.String("reconcile.requeafter", resp.RequeueAfter.String()))
				}
				if err != nil {
					span.SetStatus(codes.Error, fmt.Sprintf("watcher add error: %s", err.Error()))
				}
				return resp, err
			}
		}

		// Attach the finalizer on success
		logger.Debug("Downstream reconcile succeeded, adding finalizer", "finalizer", o.finalizer)
		patchErr := o.finalizerUpdater.AddFinalizer(ctx, request.Object, o.finalizer)
		if patchErr != nil {
			span.SetStatus(codes.Error, fmt.Sprintf("error adding finalizer: %s", patchErr.Error()))
			if resp.State == nil {
				resp.State = make(map[string]any)
			}
			resp.State[opinionatedReconcilerPatchAddStateKey] = patchErr
			var chk FinalizerError
			if errors.As(patchErr, &chk) {
				logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
			}
			logger.Error("error adding finalizer", "error", patchErr.Error(), "kind", request.Object.GroupVersionKind().Kind, "namespace", request.Object.GetNamespace(), "name", request.Object.GetName())
		}
		return resp, patchErr
	}
	if request.Action == ReconcileActionUpdated && !slices.Contains(request.Object.GetFinalizers(), o.finalizer) {
		// Add the finalizer, don't delegate, let the reconcile action for adding the finalizer propagate down to avoid confusing extra reconciliations
		logger.Debug("Missing finalizer in object, adding (this will trigger a new reconcile event)", "finalizer", o.finalizer)
		patchErr := o.finalizerUpdater.AddFinalizer(ctx, request.Object, o.finalizer)
		if patchErr != nil {
			var chk FinalizerError
			if errors.As(patchErr, &chk) {
				logger = logger.With("status", chk.Status().Code, "message", chk.Status().Message, "request", chk.PatchRequest())
			}
			logger.Error("error adding finalizer", "error", patchErr.Error(), "kind", request.Object.GroupVersionKind().Kind, "namespace", request.Object.GetNamespace(), "name", request.Object.GetName())
		}
		return ReconcileResult{}, patchErr
	}
	return o.wrappedReconcile(ctx, request)
}

func (o *OpinionatedReconciler) wrappedReconcile(ctx context.Context, request ReconcileRequest) (ReconcileResult, error) {
	if o.Reconciler != nil {
		return o.Reconciler.Reconcile(ctx, request)
	}
	return ReconcileResult{}, nil
}

// Wrap wraps the provided Reconciler's Reconcile function with this OpinionatedReconciler
func (o *OpinionatedReconciler) Wrap(reconciler Reconciler) {
	o.Reconciler = reconciler
}

// Compile-time interface compliance check
var _ Reconciler = &OpinionatedReconciler{}

// SimpleReconciler is a simple Reconciler implementation that calls ReconcileFunc if non-nil on Reconcile requests.
type SimpleReconciler struct {
	ReconcileFunc func(context.Context, ReconcileRequest) (ReconcileResult, error)
}

// Reconcile calls ReconcileFunc if non-nil and returns the response, or returns an empty ReconcileResult and nil error
// if ReconcileFunc is nil.
func (s *SimpleReconciler) Reconcile(ctx context.Context, req ReconcileRequest) (ReconcileResult, error) {
	if s.ReconcileFunc != nil {
		return s.ReconcileFunc(ctx, req)
	}
	return ReconcileResult{}, nil
}

// Compile-time interface compliance check
var _ Reconciler = &SimpleReconciler{}

// TypedReconcileRequest is a variation of ReconcileRequest which uses a concretely-typed Object,
// rather than the interface resource.Object. It is used by TypedReconciler in its ReconcileFunc.
type TypedReconcileRequest[T resource.Object] struct {
	// Action is the actions which triggered this TypedReconcileRequest
	Action ReconcileAction
	// Object is the object on which the Action was performed, at the point in time of that Action
	Object T
	// State is a user-defined map of state values that can be provided on retried ReconcileRequests.
	// See State in ReconcileResult. It will always be nil on an initial Reconcile call,
	// and will only be non-nil if a prior Reconcile call with this TypedReconcileRequest returned a State
	// in its ReconcileResult alongside either a RequeueAfter or an error.
	State map[string]any
}

// TypedReconciler is a variant of SimpleReconciler in which a user can specify the underlying type of the resource.Object
// which is in the provided ReconcileRequest. Reconcile() will then attempt to cast the resource.Object in the
// ReconcileRequest into the provided T type and produce a TypedReconcileRequest, which will be passed to ReconcileFunc.
type TypedReconciler[T resource.Object] struct {
	// ReconcileFunc is called by TypedReconciler.Reconcile using the T-typed Object instead of a resource.Object.
	ReconcileFunc func(context.Context, TypedReconcileRequest[T]) (ReconcileResult, error)
}

// Reconcile tries to cast the Object in ReconcileRequest into the T-typed resource.Object,
// then creates a TypedReconcileRequest with the cast object and the same Action and State,
// which is passed to ReconcileFunc. If the Object cannot be cast, it returns an empty
// ReconcileResult with an error of type *CannotCastError. If ReconcileFunc is nil,
// it returns an empty ReconcileResult with a nil error.
func (t *TypedReconciler[T]) Reconcile(ctx context.Context, request ReconcileRequest) (ReconcileResult, error) {
	if t.ReconcileFunc == nil {
		return ReconcileResult{}, nil
	}
	cast, ok := request.Object.(T)
	if !ok {
		return ReconcileResult{}, NewCannotCastError(request.Object.GetStaticMetadata())
	}
	return t.ReconcileFunc(ctx, TypedReconcileRequest[T]{
		Action: request.Action,
		Object: cast,
		State:  request.State,
	})
}

// Compile-time interface compliance check
var _ Reconciler = &TypedReconciler[resource.Object]{}
