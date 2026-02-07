package operator

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/health"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"
)

var _ Controller = &InformerController{}

type ResourceAction string

const (
	ResourceActionCreate = ResourceAction("CREATE")
	ResourceActionUpdate = ResourceAction("UPDATE")
	ResourceActionDelete = ResourceAction("DELETE")
	ResourceActionResync = ResourceAction("RESYNC")
)

// ErrNilObject indicates that a provided resource.Object is nil, and cannot be processed
var ErrNilObject = errors.New("object cannot be nil")

// ErrInformerAlreadyAdded indicates that there is already an informer for the resource kind mapped
var ErrInformerAlreadyAdded = errors.New("informer for resource kind already added")

// DefaultRetryPolicy is an Exponential Backoff RetryPolicy with an initial 5-second delay and a max of 5 attempts
var DefaultRetryPolicy = ExponentialBackoffRetryPolicy(5*time.Second, 5)

// DefaultErrorHandler is an error handler function which simply logs the error with the logger in the context
var DefaultErrorHandler = func(ctx context.Context, err error) {
	logging.FromContext(ctx).Error(err.Error(), "component", "InformerController", "error", err)
}

// Informer is an interface describing an informer which can be managed by InformerController
type Informer interface {
	app.Runnable
	WaitForSync(ctx context.Context) error
	AddEventHandler(handler ResourceWatcher) error
}

// ResourceWatcher describes an object which handles Add/Update/Delete actions for a resource
type ResourceWatcher interface {
	Add(context.Context, resource.Object) error
	Update(ctx context.Context, src, tgt resource.Object) error
	Delete(context.Context, resource.Object) error
}

// RetryPolicy is a function that defines whether an event should be retried, based on the error and number of attempts.
// It returns a boolean indicating whether another attempt should be made, and a time.Duration after which that attempt should be made again.
type RetryPolicy func(err error, attempt int) (bool, time.Duration)

// ExponentialBackoffRetryPolicy returns an Exponential Backoff RetryPolicy function, which follows the following formula:
// retry time = initialDelay * (2^attempt).
// If maxAttempts is exceeded, it will return false for the retry.
func ExponentialBackoffRetryPolicy(initialDelay time.Duration, maxAttempts int) RetryPolicy {
	return func(_ error, attempt int) (bool, time.Duration) {
		if attempt > maxAttempts {
			return false, 0
		}

		return true, initialDelay * time.Duration(math.Pow(2, float64(attempt)))
	}
}

// RetryDequeuePolicy is a function that defines when a retry should be dequeued when a new action is taken on a resource.
// It accepts information about the new action being taken, and information about the current queued retry,
// and returns `true` if the retry should be dequeued.
// A RetryDequeuePolicy may be called multiple times for the same action, depending on the number of pending retries for the object.
type RetryDequeuePolicy func(newAction ResourceAction, newObject resource.Object, retryAction ResourceAction, retryObject resource.Object, retryError error) bool

// OpinionatedRetryDequeuePolicy is a RetryDequeuePolicy which has the following logic:
// 1. If the newAction is a delete, dequeue the retry
// 2. If the newAction and retryAction are different, keep the retry (for example, a queued create retry, and a received update action)
// 3. If the generation of newObject and retryObject is the same, keep the retry
// 4. Otherwise, dequeue the retry
var OpinionatedRetryDequeuePolicy = func(newAction ResourceAction, newObject resource.Object, retryAction ResourceAction, retryObject resource.Object, _ error) bool {
	if newAction == ResourceActionDelete {
		return true
	}
	if newAction != retryAction {
		return false
	}
	if newObject.GetGeneration() == retryObject.GetGeneration() {
		return false
	}
	return true
}

// InformerController is an object that handles coordinating informers and observers.
// Unlike adding a Watcher directly to an Informer with AddEventHandler, the InformerController
// guarantees sequential execution of watchers, based on add order.
type InformerController struct {
	// ErrorHandler is a user-specified error handling function. This is typically for logging/metrics use,
	// as retry logic is covered by the RetryPolicy.
	ErrorHandler func(context.Context, error)
	// RetryPolicy is a user-specified retry logic function which will be used when ResourceWatcher function calls fail.
	RetryPolicy RetryPolicy
	// RetryDequeuePolicy is a user-specified retry dequeue logic function which will be used for new informer actions
	// when one or more retries for the object are still pending. If not present, existing retries are always dequeued.
	// If using an OpinionatedWatcher or OpinionatedReconciler, this should be set to OpinionatedRetryDequeuePolicy,
	// or something with similar logic, as the OpinionatedWatcher and OpinionatedReconciler trigger updates on adds which error,
	// which will cause the add retry to be dequeued if RetryDequeuePolicy is absent.
	RetryDequeuePolicy  RetryDequeuePolicy
	informers           *ListMap[string, Informer]
	watchers            *ListMap[string, ResourceWatcher]
	reconcilers         *ListMap[string, Reconciler]
	toRetry             *ListMap[string, retryInfo]
	retryTickerInterval time.Duration
	runner              *app.DynamicMultiRunner
	totalEvents         *prometheus.CounterVec
	reconcileLatency    *prometheus.HistogramVec
	reconcilerLatency   *prometheus.HistogramVec
	watcherLatency      *prometheus.HistogramVec
	inflightActions     *prometheus.GaugeVec
	inflightEvents      *prometheus.GaugeVec
}

type retryInfo struct {
	retryAfter time.Time
	retryFunc  func() (*time.Duration, error)
	attempt    int
	action     ResourceAction
	object     resource.Object
	err        error
}

// InformerControllerConfig contains configuration options for an InformerController
type InformerControllerConfig struct {
	MetricsConfig metrics.Config
	// ErrorHandler is a user-specified error handling function. This is typically for logging/metrics use,
	// as retry logic is covered by the RetryPolicy. If left nil, DefaultErrorHandler will be used.
	ErrorHandler func(context.Context, error)
	// RetryPolicy is a user-specified retry logic function which will be used when ResourceWatcher function calls fail.
	// If left nil, DefaultRetryPolicy will be used.
	RetryPolicy RetryPolicy
	// RetryDequeuePolicy is a user-specified retry dequeue logic function which will be used for new informer actions
	// when one or more retries for the object are still pending. If not present, existing retries are always dequeued.
	// If left nil, no RetryDequeuePolicy will be used, and retries will only be dequeued when RetryPolicy returns false.
	RetryDequeuePolicy RetryDequeuePolicy
}

// DefaultInformerControllerConfig returns an InformerControllerConfig with default values
func DefaultInformerControllerConfig() InformerControllerConfig {
	return InformerControllerConfig{
		MetricsConfig:      metrics.DefaultConfig(""),
		ErrorHandler:       DefaultErrorHandler,
		RetryPolicy:        DefaultRetryPolicy,
		RetryDequeuePolicy: OpinionatedRetryDequeuePolicy,
	}
}

// NewInformerController creates a new controller
func NewInformerController(cfg InformerControllerConfig) *InformerController {
	inf := &InformerController{
		RetryPolicy:         DefaultRetryPolicy,
		ErrorHandler:        DefaultErrorHandler,
		informers:           NewListMap[Informer](),
		watchers:            NewListMap[ResourceWatcher](),
		reconcilers:         NewListMap[Reconciler](),
		toRetry:             NewListMap[retryInfo](),
		retryTickerInterval: time.Second,
		runner:              app.NewDynamicMultiRunner(),
		reconcileLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       cfg.MetricsConfig.Namespace,
			Subsystem:                       "informer",
			Name:                            "reconcile_duration_seconds",
			Help:                            "Time (in seconds) spent performing all reconcile actions for an event.",
			Buckets:                         metrics.LatencyBuckets,
			NativeHistogramBucketFactor:     cfg.MetricsConfig.NativeHistogramBucketFactor,
			NativeHistogramMaxBucketNumber:  cfg.MetricsConfig.NativeHistogramMaxBucketNumber,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"event_type", "kind"}),
		reconcilerLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       cfg.MetricsConfig.Namespace,
			Subsystem:                       "reconciler",
			Name:                            "process_duration_seconds",
			Help:                            "Time (in seconds) spent performing individual reconciler actions.",
			Buckets:                         metrics.LatencyBuckets,
			NativeHistogramBucketFactor:     cfg.MetricsConfig.NativeHistogramBucketFactor,
			NativeHistogramMaxBucketNumber:  cfg.MetricsConfig.NativeHistogramMaxBucketNumber,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"event_type", "kind"}),
		watcherLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       cfg.MetricsConfig.Namespace,
			Subsystem:                       "watcher",
			Name:                            "process_duration_seconds",
			Help:                            "Time (in seconds) spent perfoming individual watcher actions.",
			Buckets:                         metrics.LatencyBuckets,
			NativeHistogramBucketFactor:     cfg.MetricsConfig.NativeHistogramBucketFactor,
			NativeHistogramMaxBucketNumber:  cfg.MetricsConfig.NativeHistogramMaxBucketNumber,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"event_type", "kind"}),
		totalEvents: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name:      "events_total",
			Subsystem: "informer",
			Namespace: cfg.MetricsConfig.Namespace,
			Help:      "Total number of informer events",
		}, []string{"event_type", "kind"}),
		inflightActions: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name:      "ongoing_reconcile_processes",
			Namespace: cfg.MetricsConfig.Namespace,
			Help:      "Current number of ongoing reconciliation (reconciler or watcher) processes",
		}, []string{"event_type", "kind"}),
		inflightEvents: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name:      "ongoing_reconcile_events",
			Namespace: cfg.MetricsConfig.Namespace,
			Help:      "Current number of events which have active reconcile processes",
		}, []string{"event_type", "kind"}),
	}
	if cfg.ErrorHandler != nil {
		inf.ErrorHandler = cfg.ErrorHandler
	}
	if cfg.RetryPolicy != nil {
		inf.RetryPolicy = cfg.RetryPolicy
	}
	if cfg.RetryDequeuePolicy != nil {
		inf.RetryDequeuePolicy = cfg.RetryDequeuePolicy
	}
	return inf
}

// AddInformer adds an informer for a specific resourceKind.
// The `resourceKind` string is used for internal tracking and correlation to observers,
// and does not necessarily need to match the informer's type.
//
// Multiple informers may be added for the same resource kind,
// and each will trigger all watchers for that resource kind.
// The most common usage of this is to have informers partitioned by namespace or labels for the same resource kind,
// which share a watcher.
//
//nolint:gocognit,funlen,dupl
func (c *InformerController) AddInformer(informer Informer, resourceKind string) error {
	if informer == nil {
		return errors.New("informer cannot be nil")
	}
	if resourceKind == "" {
		return errors.New("resourceKind cannot be empty")
	}

	err := informer.AddEventHandler(&SimpleWatcher{
		AddFunc:    c.informerAddFunc(resourceKind),
		UpdateFunc: c.informerUpdateFunc(resourceKind),
		DeleteFunc: c.informerDeleteFunc(resourceKind),
	})
	if err != nil {
		return err
	}

	c.runner.AddRunnable(informer)
	c.informers.AddItem(resourceKind, informer)
	return nil
}

// RemoveInformer removes the provided informer, stopping it if it is currently running.
func (c *InformerController) RemoveInformer(informer Informer, resourceKind string) {
	c.runner.RemoveRunnable(informer)
	c.informers.RemoveItem(resourceKind, func(i Informer) bool {
		return i == informer
	})
}

// AddWatcher adds an observer to an informer with a matching `resourceKind`.
// Any time the informer sees an add, update, or delete, it will call the observer's corresponding method.
// Multiple watchers can exist for the same resource kind.
// They will be run in the order they were added to the informer.
func (c *InformerController) AddWatcher(watcher ResourceWatcher, resourceKind string) error {
	if watcher == nil {
		return errors.New("watcher cannot be nil")
	}
	if resourceKind == "" {
		return errors.New("resourceKind cannot be empty")
	}
	c.watchers.AddItem(resourceKind, watcher)
	return nil
}

// RemoveWatcher removes the given ResourceWatcher from the list for the resourceKind, provided it exists in the list.
func (c *InformerController) RemoveWatcher(watcher ResourceWatcher, resourceKind string) {
	c.watchers.RemoveItem(resourceKind, func(w ResourceWatcher) bool {
		return watcher == w
	})
}

// RemoveAllWatchersForResource removes all watchers for a specific resourceKind
func (c *InformerController) RemoveAllWatchersForResource(resourceKind string) {
	c.watchers.RemoveKey(resourceKind)
}

// AddReconciler adds a reconciler to an informer with a matching `resourceKind`.
// Any time the informer sees an add, update, or delete, it will call reconciler.Reconcile.
// Multiple reconcilers can exist for the same resource kind. If multiple reconcilers exist,
// they will be run in the order they were added to the informer.
func (c *InformerController) AddReconciler(reconciler Reconciler, resourceKind string) error {
	if reconciler == nil {
		return errors.New("reconciler cannot be nil")
	}
	if resourceKind == "" {
		return errors.New("resourceKind cannot be empty")
	}
	c.reconcilers.AddItem(resourceKind, reconciler)
	return nil
}

// RemoveReconciler removes the given Reconciler from the list for the resourceKind, provided it exists in the list.
func (c *InformerController) RemoveReconciler(reconciler Reconciler, resourceKind string) {
	c.reconcilers.RemoveItem(resourceKind, func(r Reconciler) bool {
		return reconciler == r
	})
}

// RemoveAllReconcilersForResource removes all Reconcilers for a specific resourceKind
func (c *InformerController) RemoveAllReconcilersForResource(resourceKind string) {
	c.reconcilers.RemoveKey(resourceKind)
}

// Run runs the controller, which starts all informers, until stopCh is closed
//
//nolint:errcheck
func (c *InformerController) Run(ctx context.Context) error {
	// Using derivedCtx ensures that if c.runner exits prematurely due to an error, c.retryTicker will also stop
	derivedCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	go c.retryTicker(derivedCtx)
	return c.runner.Run(ctx)
}

// PrometheusCollectors returns the prometheus metric collectors used by this informer, as well as collectors used by
// any registered informer or watcher which implements metrics.Provider, to allow for registration
func (c *InformerController) PrometheusCollectors() []prometheus.Collector {
	collectors := []prometheus.Collector{
		c.totalEvents, c.reconcileLatency, c.inflightEvents, c.inflightActions, c.reconcilerLatency, c.watcherLatency,
	}
	c.informers.RangeAll(func(_ string, _ int, value Informer) {
		if cast, ok := value.(metrics.Provider); ok {
			collectors = append(collectors, cast.PrometheusCollectors()...)
		}
	})
	c.watchers.RangeAll(func(_ string, _ int, value ResourceWatcher) {
		if cast, ok := value.(metrics.Provider); ok {
			collectors = append(collectors, cast.PrometheusCollectors()...)
		}
	})
	return collectors
}

// HealthChecks
func (c *InformerController) HealthChecks() []health.Check {
	checks := make([]health.Check, 0)

	c.informers.RangeAll(func(_ string, _ int, value Informer) {
		if cast, ok := value.(health.Check); ok {
			checks = append(checks, cast)
		}

		if cast, ok := value.(health.Checker); ok {
			checks = append(checks, cast.HealthChecks()...)
		}
	})
	c.watchers.RangeAll(func(_ string, _ int, value ResourceWatcher) {
		if cast, ok := value.(health.Check); ok {
			checks = append(checks, cast)
		}

		if cast, ok := value.(health.Checker); ok {
			checks = append(checks, cast.HealthChecks()...)
		}
	})
	c.reconcilers.RangeAll(func(_ string, _ int, value Reconciler) {
		if cast, ok := value.(health.Check); ok {
			checks = append(checks, cast)
		}

		if cast, ok := value.(health.Checker); ok {
			checks = append(checks, cast.HealthChecks()...)
		}
	})
	return checks
}

// nolint:dupl
func (c *InformerController) informerAddFunc(resourceKind string) func(context.Context, resource.Object) error {
	return func(ctx context.Context, obj resource.Object) error {
		if obj == nil {
			return ErrNilObject
		}

		// Metrics for the whole reconcile process
		eventStart := c.startEvent(string(ResourceActionCreate), obj.GetStaticMetadata().Kind)
		defer c.completeEvent(string(ResourceActionCreate), obj.GetStaticMetadata().Kind, eventStart)

		ctx, span := GetTracer().Start(ctx, "controller-event-add")
		defer span.End()
		// Handle all watchers for the add for this resource kind
		c.watchers.Range(resourceKind, func(idx int, watcher ResourceWatcher) {
			// Generate the unique key for this object
			retryKey := c.keyForWatcherEvent(resourceKind, idx, obj)

			// Dequeue retries according to the RetryDequeuePolicy
			c.dequeueIfRequired(retryKey, obj, ResourceActionCreate)

			// Do the watcher's Add, check for error
			c.wrapWatcherCall(string(ResourceActionCreate), obj.GetStaticMetadata().Kind, func() {
				err := watcher.Add(ctx, obj)
				if err != nil && c.ErrorHandler != nil {
					c.ErrorHandler(ctx, err) // TODO: improve ErrorHandler
				}
				if err != nil && c.RetryPolicy != nil {
					c.queueRetry(retryKey, err, func() (*time.Duration, error) {
						ctx, span := GetTracer().Start(ctx, "controller-retry")
						defer span.End()
						return nil, watcher.Add(ctx, obj)
					}, ResourceActionCreate, obj)
				}
			})
		})
		// Handle all reconcilers for the add for this resource kind
		c.reconcilers.Range(resourceKind, func(idx int, reconciler Reconciler) {
			// Generate the unique key for this object
			retryKey := c.keyForReconcilerEvent(resourceKind, idx, obj)

			// Dequeue retries according to the RetryDequeuePolicy
			c.dequeueIfRequired(retryKey, obj, ResourceActionCreate)

			// Do the reconciler's add, check for error or a response with a specified RetryAfter
			req := ReconcileRequest{
				Action: ReconcileActionCreated,
				Object: obj,
			}
			c.doReconcile(ctx, reconciler, req, retryKey)
		})
		return nil
	}
}

// nolint:dupl
func (c *InformerController) informerUpdateFunc(resourceKind string) func(context.Context, resource.Object, resource.Object) error {
	return func(ctx context.Context, oldObj resource.Object, newObj resource.Object) error {
		if newObj == nil {
			return ErrNilObject
		}

		// Metrics for the whole reconcile process
		eventStart := c.startEvent(string(ResourceActionUpdate), newObj.GetStaticMetadata().Kind)
		defer c.completeEvent(string(ResourceActionUpdate), newObj.GetStaticMetadata().Kind, eventStart)

		ctx, span := GetTracer().Start(ctx, "controller-event-update")
		defer span.End()
		// Handle all watchers for the update for this resource kind
		c.watchers.Range(resourceKind, func(idx int, watcher ResourceWatcher) {
			// Generate the unique key for this object
			retryKey := c.keyForWatcherEvent(resourceKind, idx, newObj)

			// Dequeue retries according to the RetryDequeuePolicy
			c.dequeueIfRequired(retryKey, newObj, ResourceActionUpdate)

			// Do the watcher's Update, check for error
			c.wrapWatcherCall(string(ResourceActionUpdate), newObj.GetStaticMetadata().Kind, func() {
				err := watcher.Update(ctx, oldObj, newObj)
				if err != nil && c.ErrorHandler != nil {
					c.ErrorHandler(ctx, err)
				}
				if err != nil && c.RetryPolicy != nil {
					c.queueRetry(retryKey, err, func() (*time.Duration, error) {
						ctx, span := GetTracer().Start(ctx, "controller-retry")
						defer span.End()
						return nil, watcher.Update(ctx, oldObj, newObj)
					}, ResourceActionUpdate, newObj)
				}
			})
		})
		// Handle all reconcilers for the update for this resource kind
		c.reconcilers.Range(resourceKind, func(index int, reconciler Reconciler) {
			// Generate the unique key for this object
			retryKey := c.keyForReconcilerEvent(resourceKind, index, newObj)

			// Convert to a resync action if the old and new RV are the same
			action := ResourceActionUpdate
			if oldObj != nil && oldObj.GetResourceVersion() == newObj.GetResourceVersion() {
				action = ResourceActionResync
			}

			// Dequeue retries according to the RetryDequeuePolicy
			c.dequeueIfRequired(retryKey, newObj, action)

			// Do the reconciler's update, check for error or a response with a specified RetryAfter
			req := ReconcileRequest{
				Action: ReconcileActionFromResourceAction(action),
				Object: newObj,
			}
			c.doReconcile(ctx, reconciler, req, retryKey)
		})
		return nil
	}
}

// nolint:dupl
func (c *InformerController) informerDeleteFunc(resourceKind string) func(context.Context, resource.Object) error {
	return func(ctx context.Context, obj resource.Object) error {
		if obj == nil {
			return ErrNilObject
		}

		// Metrics for the whole reconcile process
		eventStart := c.startEvent(string(ResourceActionDelete), obj.GetStaticMetadata().Kind)
		defer c.completeEvent(string(ResourceActionDelete), obj.GetStaticMetadata().Kind, eventStart)

		ctx, span := GetTracer().Start(ctx, "controller-event-delete")
		defer span.End()
		// Handle all watchers for the add for this resource kind
		c.watchers.Range(resourceKind, func(idx int, watcher ResourceWatcher) {
			// Generate the unique key for this object
			retryKey := c.keyForWatcherEvent(resourceKind, idx, obj)

			// Dequeue retries according to the RetryDequeuePolicy
			c.dequeueIfRequired(retryKey, obj, ResourceActionDelete)

			c.inflightActions.WithLabelValues(string(ResourceActionUpdate), obj.GetStaticMetadata().Kind).Inc()
			defer c.inflightActions.WithLabelValues(string(ResourceActionUpdate), obj.GetStaticMetadata().Kind).Dec()

			// Do the watcher's Delete, check for error
			c.wrapWatcherCall(string(ResourceActionDelete), obj.GetStaticMetadata().Kind, func() {
				err := watcher.Delete(ctx, obj)
				if err != nil && c.ErrorHandler != nil {
					c.ErrorHandler(ctx, err) // TODO: improve ErrorHandler
				}
				if err != nil && c.RetryPolicy != nil {
					c.queueRetry(retryKey, err, func() (*time.Duration, error) {
						ctx, span := GetTracer().Start(ctx, "controller-retry")
						defer span.End()
						return nil, watcher.Delete(ctx, obj)
					}, ResourceActionDelete, obj)
				}
			})
		})
		// Handle all reconcilers for the add for this resource kind
		c.reconcilers.Range(resourceKind, func(idx int, reconciler Reconciler) {
			// Generate the unique key for this object
			retryKey := c.keyForReconcilerEvent(resourceKind, idx, obj)

			// Dequeue retries according to the RetryDequeuePolicy
			c.dequeueIfRequired(retryKey, obj, ResourceActionDelete)

			// Do the reconciler's add, check for error or a response with a specified RetryAfter
			req := ReconcileRequest{
				Action: ReconcileActionDeleted,
				Object: obj,
			}

			c.doReconcile(ctx, reconciler, req, retryKey)
		})
		return nil
	}
}

func (c *InformerController) dequeueIfRequired(retryKey string, currentObjectState resource.Object, action ResourceAction) {
	if c.RetryDequeuePolicy != nil {
		c.toRetry.RemoveItems(retryKey, func(info retryInfo) bool {
			return c.RetryDequeuePolicy(action, currentObjectState, info.action, info.object, info.err)
		}, -1)
	} else {
		// If no RetryDequeuePolicy exists, dequeue all retries for the object
		c.toRetry.RemoveKey(retryKey)
	}
}

func (c *InformerController) doReconcile(ctx context.Context, reconciler Reconciler, req ReconcileRequest, retryKey string) {
	// Metrics for the reconcile action
	action := ResourceActionFromReconcileAction(req.Action)
	if c.inflightActions != nil {
		c.inflightActions.WithLabelValues(string(action), req.Object.GetStaticMetadata().Kind).Inc()
		defer c.inflightActions.WithLabelValues(string(action), req.Object.GetStaticMetadata().Kind).Dec()
	}
	if c.reconcilerLatency != nil {
		start := time.Now()
		defer func() {
			c.reconcilerLatency.WithLabelValues(string(action), req.Object.GetStaticMetadata().Kind).Observe(time.Since(start).Seconds())
		}()
	}

	ctx, span := GetTracer().Start(ctx, "controller-event-reconcile")
	defer span.End()
	// Do the reconcile
	res, err := reconciler.Reconcile(ctx, req)
	// If the response contains a state, add it to the request for future retries
	if res.State != nil {
		req.State = res.State
	}
	if res.RequeueAfter != nil {
		// If RequeueAfter is non-nil, add a retry to the queue for now+RequeueAfter
		c.toRetry.AddItem(retryKey, retryInfo{
			retryAfter: time.Now().Add(*res.RequeueAfter),
			retryFunc: func() (*time.Duration, error) {
				res, err := reconciler.Reconcile(ctx, req)
				return res.RequeueAfter, err
			},
			action: ResourceActionFromReconcileAction(req.Action),
			object: req.Object,
			err:    err,
		})
	} else if err != nil {
		// Otherwise, if err is non-nil, queue a retry according to the RetryPolicy
		if c.ErrorHandler != nil {
			// Call the ErrorHandler function as well if it's set
			c.ErrorHandler(ctx, err)
		}
		c.queueRetry(retryKey, err, func() (*time.Duration, error) {
			ctx, span := GetTracer().Start(ctx, "controller-retry")
			defer span.End()
			res, err := reconciler.Reconcile(ctx, req)
			return res.RequeueAfter, err
		}, ResourceActionFromReconcileAction(req.Action), req.Object)
	}
}

// retryTicker blocks until stopCh is closed or receives a message.
// It checks if there are function calls to be retried every second, and, if there are any, calls the function.
// If the function returns an error, it schedules a new retry according to the RetryPolicy.
func (c *InformerController) retryTicker(ctx context.Context) {
	ticker := time.NewTicker(c.retryTickerInterval)
	defer ticker.Stop()
	for {
		select {
		case t := <-ticker.C:
			for _, key := range c.toRetry.Keys() {
				// To be simple, we retry all retries which should be done now, and remove them from the list
				// We then add back in retries which failed and need to be retried again
				toAdd := make([]retryInfo, 0)
				c.toRetry.RemoveItems(key, func(val retryInfo) bool {
					if t.After(val.retryAfter) {
						specifiedRetry, err := val.retryFunc()
						if specifiedRetry != nil {
							toAdd = append(toAdd, retryInfo{
								attempt:    val.attempt, // TODO: whether or not this should trigger an attempt increase
								retryAfter: t.Add(*specifiedRetry),
								retryFunc:  val.retryFunc,
								action:     val.action,
								object:     val.object,
							})
						} else if err != nil && c.RetryPolicy != nil {
							ok, after := c.RetryPolicy(err, val.attempt+1)
							if ok {
								toAdd = append(toAdd, retryInfo{
									attempt:    val.attempt + 1,
									retryAfter: t.Add(after),
									retryFunc:  val.retryFunc,
									action:     val.action,
									object:     val.object,
								})
							}
						}
						return true
					}
					return false
				}, -1)
				for _, inf := range toAdd {
					c.toRetry.AddItem(key, inf)
				}
			}
		case <-ctx.Done():
			return
		}
	}
}

func (c *InformerController) startEvent(eventType string, resourceKind string) time.Time {
	if c.totalEvents != nil {
		c.totalEvents.WithLabelValues(eventType, resourceKind).Inc()
	}
	if c.inflightEvents != nil {
		c.inflightEvents.WithLabelValues(eventType, resourceKind).Inc()
	}
	return time.Now()
}

func (c *InformerController) completeEvent(eventType string, resourceKind string, startTime time.Time) {
	if c.inflightEvents != nil {
		c.inflightEvents.WithLabelValues(eventType, resourceKind).Dec()
	}
	if c.reconcileLatency != nil {
		c.reconcileLatency.WithLabelValues(eventType, resourceKind).Observe(time.Since(startTime).Seconds())
	}
}

func (c *InformerController) wrapWatcherCall(eventType string, resourceKind string, f func()) {
	if c.inflightActions != nil {
		c.inflightActions.WithLabelValues(eventType, resourceKind).Inc()
		defer c.inflightActions.WithLabelValues(eventType, resourceKind).Dec()
	}
	start := time.Now()
	f()
	if c.watcherLatency != nil {
		c.watcherLatency.WithLabelValues(eventType, resourceKind).Observe(time.Since(start).Seconds())
	}
}

func (*InformerController) keyForWatcherEvent(resourceKind string, watcherIndex int, obj resource.Object) string {
	if obj == nil {
		return fmt.Sprintf("%s:%d:nil:nil", resourceKind, watcherIndex)
	}
	return fmt.Sprintf("%s:%d:%s:%s", resourceKind, watcherIndex, obj.GetNamespace(), obj.GetName())
}

func (*InformerController) keyForReconcilerEvent(resourceKind string, reconcilerIndex int, obj resource.Object) string {
	if obj == nil {
		return fmt.Sprintf("reconcile:%s:%d:nil:nil", resourceKind, reconcilerIndex)
	}
	return fmt.Sprintf("reconcile:%s:%d:%s:%s", resourceKind, reconcilerIndex, obj.GetNamespace(), obj.GetName())
}

func (c *InformerController) queueRetry(key string, err error, toRetry func() (*time.Duration, error), action ResourceAction, obj resource.Object) {
	if c.RetryPolicy == nil {
		return
	}

	if ok, after := c.RetryPolicy(err, 0); ok {
		c.toRetry.AddItem(key, retryInfo{
			retryAfter: time.Now().Add(after),
			retryFunc:  toRetry,
			action:     action,
			object:     obj,
			err:        err,
		})
	}
}
