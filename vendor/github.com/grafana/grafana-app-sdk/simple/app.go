package simple

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/health"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
)

var _ app.Provider = &AppProvider{}

type Converter k8s.Converter

// AppProvider is a simple implementation of app.Provider which returns AppManifest when Manifest is called,
// and calls NewAppFunc when NewApp is called.
type AppProvider struct {
	AppManifest       app.Manifest
	AppSpecificConfig app.SpecificConfig
	NewAppFunc        func(config app.Config) (app.App, error)
}

// Manifest returns the AppManifest in the AppProvider
func (p *AppProvider) Manifest() app.Manifest {
	return p.AppManifest
}

func (p *AppProvider) SpecificConfig() app.SpecificConfig {
	return p.AppSpecificConfig
}

// NewApp calls NewAppFunc and returns the result
func (p *AppProvider) NewApp(settings app.Config) (app.App, error) {
	return p.NewAppFunc(settings)
}

// NewAppProvider is a convenience method for creating a new AppProvider
func NewAppProvider(manifest app.Manifest, cfg app.SpecificConfig, newAppFunc func(cfg app.Config) (app.App, error)) *AppProvider {
	return &AppProvider{
		AppManifest:       manifest,
		AppSpecificConfig: cfg,
		NewAppFunc:        newAppFunc,
	}
}

var (
	_ app.App = &App{}
)

// KindMutator is an interface which describes an object which can mutate a kind, used in AppManagedKind
type KindMutator interface {
	Mutate(context.Context, *app.AdmissionRequest) (*app.MutatingResponse, error)
}

// KindValidator is an interface which describes an object which can validate a kind, used in AppManagedKind
type KindValidator interface {
	Validate(context.Context, *app.AdmissionRequest) error
}

// Mutator is a simple implementation of KindMutator, which calls MutateFunc when Mutate is called
type Mutator struct {
	MutateFunc func(context.Context, *app.AdmissionRequest) (*app.MutatingResponse, error)
}

// Mutate calls MutateFunc and returns the result, if MutateFunc is non-nil (otherwise it returns nil, nil)
func (m *Mutator) Mutate(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
	if m.MutateFunc != nil {
		return m.MutateFunc(ctx, req)
	}
	return nil, nil
}

// Validator is a simple implementation of KindValidator, which calls ValidateFunc when Validate is called
type Validator struct {
	ValidateFunc func(context.Context, *app.AdmissionRequest) error
}

// Validate calls ValidateFunc and returns the result, if ValidateFunc is non-nil (otherwise it returns nil)
func (v *Validator) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	if v.ValidateFunc != nil {
		return v.ValidateFunc(ctx, req)
	}
	return nil
}

// App is a simple, opinionated implementation of app.App.
// It must be created with NewApp to be valid.
type App struct {
	informerController *operator.InformerController
	runner             *app.MultiRunner
	clientGenerator    resource.ClientGenerator
	kinds              map[string]AppManagedKind
	gvrToGVK           map[string]string
	internalKinds      map[string]resource.Kind
	cfg                AppConfig
	converters         map[string]Converter
	customRoutes       map[string]AppCustomRouteHandler
	patcher            *k8s.DynamicPatcher
	collectors         []prometheus.Collector
}

// AppConfig is the configuration used by App
type AppConfig struct {
	Name       string
	KubeConfig rest.Config
	// ClientGenerator is the ClientGenerator to use when constructing informers.
	// It is optional and will default to k8s.NewClientRegistry(KubeConfig, k8s.DefaultClientConfig()) if not present.
	ClientGenerator resource.ClientGenerator
	InformerConfig  AppInformerConfig
	ManagedKinds    []AppManagedKind
	UnmanagedKinds  []AppUnmanagedKind
	Converters      map[schema.GroupKind]Converter
	// VersionedCustomRoutes is a map of version string => custom route handlers for
	// custom routes attached at the version level rather than attached to a specific kind.
	// Custom route paths for each version should not conflict with plural names of kinds for the version.
	VersionedCustomRoutes map[string]AppVersionRouteHandlers
	// DiscoveryRefreshInterval is the interval at which the API discovery cache should be refreshed.
	// This is primarily used by the DynamicPatcher in the OpinionatedWatcher/OpinionatedReconciler
	// for sending finalizer add/remove patches to the latest version of the kind.
	// This defaults to 10 minutes.
	DiscoveryRefreshInterval time.Duration
}

// InformerSupplier is a function which creates an operator.Informer for a kind, given a ClientGenerator and ListWatchOptions
type InformerSupplier func(
	kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions,
) (operator.Informer, error)

// DefaultInformerSupplier is a default InformerSupplier function which creates a basic operator.KubernetesBasedInformer.
// Note: This supplier does NOT respect WatchListPageSize or UseWatchList configuration.
// For memory-optimized informers that support these options, use OptimizedInformerSupplier instead.
var DefaultInformerSupplier = func(
	kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions,
) (operator.Informer, error) {
	client, err := clients.ClientFor(kind)
	if err != nil {
		return nil, err
	}

	inf, err := operator.NewKubernetesBasedInformer(kind, client, options)
	if err != nil {
		return nil, err
	}

	return operator.NewConcurrentInformerFromOptions(inf, options)
}

// OptimizedInformerSupplier is an InformerSupplier that uses CustomCacheInformer and respects
// all configuration in InformerOptions, including UseWatchList and WatchListPageSize.
// This supplier provides better memory efficiency for large-scale watches (>10K objects).
//
// Experimental: This API is experimental and may change in future releases.
//
// Recommended for:
//   - Watching cluster-scoped resources (e.g., namespaces, nodes)
//   - Watching large numbers of objects (>10K)
//   - Environments with memory constraints
//
// Configuration tips:
//   - Set WatchListPageSize to 5000-10000 for optimal memory usage
//   - Set UseWatchList to true on Kubernetes 1.27+ for streaming support
//   - Both can be combined: WatchListPageSize provides fallback pagination if UseWatchList is not available
var OptimizedInformerSupplier = func(
	kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions,
) (operator.Informer, error) {
	client, err := clients.ClientFor(kind)
	if err != nil {
		return nil, err
	}

	store := cache.NewStore(cache.DeletionHandlingMetaNamespaceKeyFunc)
	lw := operator.NewListerWatcher(client, kind, options.ListWatchOptions)

	inf := operator.NewCustomCacheInformer(store, lw, kind, operator.CustomCacheInformerOptions{
		InformerOptions: options,
	})

	return operator.NewConcurrentInformerFromOptions(inf, options)
}

// AppInformerConfig contains configuration for the App's internal operator.InformerController
type AppInformerConfig struct {
	// InformerOptions are the options for the informer.
	InformerOptions operator.InformerOptions
	// RetryPolicy is the policy for retrying events.
	RetryPolicy operator.RetryPolicy
	// RetryDequeuePolicy is the policy for dequeuing events.
	RetryDequeuePolicy operator.RetryDequeuePolicy
	// FinalizerSupplier is used to generate the finalizer for the kind.
	FinalizerSupplier operator.FinalizerSupplier
	// InProgressFinalizerSupplier is used to generate the "in-progress" finalizer used by opinionated adds,
	// before the "normal" finalizer (provided by FinalizerSupplier) is applied when the add completes successfully.
	// By default, this is "<app name>-wip"
	InProgressFinalizerSupplier operator.FinalizerSupplier
	// InformerSupplier can be set to specify a function for creating informers for kinds.
	// If left unset, DefaultInformerSupplier will be used.
	InformerSupplier InformerSupplier
}

// AppManagedKind is a Kind and associated functionality used by an App.
type AppManagedKind struct {
	// Kind is the resource.Kind being managed. This is equivalent to a kubernetes GroupVersionKind
	Kind resource.Kind
	// Reconciler is an optional reconciler to run for this Kind. Only one version of a Kind should have a Reconciler,
	// otherwise, duplicate events will be received.
	Reconciler operator.Reconciler
	// Watcher is an optional Watcher to run for this Kind. Only one version of a Kind should have a Watcher,
	// otherwise, duplicate events will be received.
	Watcher operator.ResourceWatcher
	// Validator is an optional ValidatingAdmissionController for the Kind. It will be run only for validation
	// of this specific version.
	Validator KindValidator
	// Mutator is an optional MutatingAdmissionController for the Kind. It will be run only for mutation
	// of this specific version.
	Mutator KindMutator
	// CustomRoutes are an optional map of subresource paths to a route handler.
	// If supported by the runner, calls to these subresources on this particular version will call this handler.
	CustomRoutes AppCustomRouteHandlers
	// ReconcileOptions are the options to use for running the Reconciler or Watcher for the Kind, if one exists.
	ReconcileOptions BasicReconcileOptions
}

// AppUnmanagedKind is a Kind which an App does not manage, but still may want to watch or reconcile as part of app functionality
type AppUnmanagedKind struct {
	// Kind is the resource.Kind the App has an interest in, but does not manage.
	Kind resource.Kind
	// Reconciler is an optional reconciler to run for this Kind.
	Reconciler operator.Reconciler
	// Watcher is an optional Watcher to run for this Kind.
	Watcher operator.ResourceWatcher
	// ReconcileOptions are the options to use for running the Reconciler or Watcher for the Kind, if one exists.
	ReconcileOptions UnmanagedKindReconcileOptions
}

type UnmanagedKindReconcileOptions struct {
	// Namespace is the namespace to use in the ListWatch request
	Namespace string
	// LabelFilters are any label filters to apply to the ListWatch request
	LabelFilters []string
	// FieldSelectors are any field selector filters to apply to the ListWatch request
	FieldSelectors []string
	// UseOpinionated should be set to true to wrap the Watcher or Reconciler in its opinionated variant.
	// If true, the app must have permission to add finalizers to the unmanaged Kind, and if
	// the AppUnmanagedKind is ever removed from the app, the finalizers added should be cleaned up.
	UseOpinionated bool
}

// BasicReconcileOptions are settings for the ListWatch and informer setup for a reconciliation loop
type BasicReconcileOptions struct {
	// Namespace is the namespace to use in the ListWatch request
	Namespace string
	// LabelFilters are any label filters to apply to the ListWatch request
	LabelFilters []string
	// FieldSelectors are any field selector filters to apply to the ListWatch request
	FieldSelectors []string
	// UsePlain can be set to true to avoid wrapping the Reconciler or Watcher in its Opinionated variant.
	UsePlain bool
}

type AppCustomRouteMethod string

const (
	AppCustomRouteMethodConnect AppCustomRouteMethod = http.MethodConnect
	AppCustomRouteMethodDelete  AppCustomRouteMethod = http.MethodDelete
	AppCustomRouteMethodGet     AppCustomRouteMethod = http.MethodGet
	AppCustomRouteMethodHead    AppCustomRouteMethod = http.MethodHead
	AppCustomRouteMethodOptions AppCustomRouteMethod = http.MethodOptions
	AppCustomRouteMethodPatch   AppCustomRouteMethod = http.MethodPatch
	AppCustomRouteMethodPost    AppCustomRouteMethod = http.MethodPost
	AppCustomRouteMethodPut     AppCustomRouteMethod = http.MethodPut
	AppCustomRouteMethodTrace   AppCustomRouteMethod = http.MethodTrace
)

type AppCustomRoute struct {
	Method AppCustomRouteMethod
	Path   string
}

type AppVersionRoute struct {
	Namespaced bool
	Path       string
	Method     AppCustomRouteMethod
}

type AppCustomRouteHandler func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error

type AppCustomRouteHandlers map[AppCustomRoute]AppCustomRouteHandler

type AppVersionRouteHandlers map[AppVersionRoute]AppCustomRouteHandler

// NewApp creates a new instance of App, managing the kinds provided in AppConfig.ManagedKinds.
// AppConfig MUST contain a valid KubeConfig to be valid.
// Watcher/Reconciler error handling, retry, and dequeue logic can be managed with AppConfig.InformerConfig.
func NewApp(config AppConfig) (*App, error) {
	clients := config.ClientGenerator
	if clients == nil {
		clients = k8s.NewClientRegistry(config.KubeConfig, k8s.DefaultClientConfig())
	}
	a := &App{
		informerController: operator.NewInformerController(operator.DefaultInformerControllerConfig()),
		runner:             app.NewMultiRunner(),
		clientGenerator:    clients,
		kinds:              make(map[string]AppManagedKind),
		gvrToGVK:           make(map[string]string),
		internalKinds:      make(map[string]resource.Kind),
		converters:         make(map[string]Converter),
		customRoutes:       make(map[string]AppCustomRouteHandler),
		cfg:                config,
		collectors:         make([]prometheus.Collector, 0),
	}
	if config.InformerConfig.InformerOptions.ErrorHandler != nil {
		a.informerController.ErrorHandler = config.InformerConfig.InformerOptions.ErrorHandler
	}
	if config.InformerConfig.RetryPolicy != nil {
		a.informerController.RetryPolicy = config.InformerConfig.RetryPolicy
	}
	if config.InformerConfig.RetryDequeuePolicy != nil {
		a.informerController.RetryDequeuePolicy = config.InformerConfig.RetryDequeuePolicy
	}
	discoveryRefresh := config.DiscoveryRefreshInterval
	if discoveryRefresh == 0 {
		discoveryRefresh = time.Minute * 10
	}
	p, err := k8s.NewDynamicPatcher(&config.KubeConfig, discoveryRefresh)
	if err != nil {
		return nil, err
	}
	a.patcher = p
	for _, kind := range config.ManagedKinds {
		err := a.manageKind(kind)
		if err != nil {
			return nil, err
		}
	}
	for _, kind := range config.UnmanagedKinds {
		err := a.watchKind(kind)
		if err != nil {
			return nil, err
		}
	}
	for version, routeHandlers := range config.VersionedCustomRoutes {
		for info, handler := range routeHandlers {
			scope := resource.NamespacedScope
			if !info.Namespaced {
				scope = resource.ClusterScope
			}
			key := a.customRouteHandlerKey(schema.GroupVersionKind{
				Version: version,
			}, string(info.Method), info.Path, scope)
			if _, ok := a.customRoutes[key]; ok {
				return nil, fmt.Errorf("custom route '%s %s' already exists for version %s", info.Method, info.Path, version)
			}
			a.customRoutes[key] = handler
		}
	}
	for gk, converter := range config.Converters {
		a.RegisterKindConverter(gk, converter)
	}
	a.runner.AddRunnable(a.informerController)
	return a, nil
}

// ValidateManifest can be called with app.ManifestData to validate that the current configuration and managed kinds
// fully cover the kinds and capabilities in the provided app.ManifestData. If the provided app.ManifestData
// contains a kind or a capability for a kind/version that is not covered by the app's currently managed kinds,
// an error will be returned. If the app's current managed kinds cover more than the provided app.ManifestData
// indicates, no error will be returned.
// This method can be used after initializing an app to verify it matches the loaded app.ManifestData from the app runner.
func (a *App) ValidateManifest(manifest app.ManifestData) error {
	for _, v := range manifest.Versions {
		for _, k := range v.Kinds {
			if _, ok := a.converters[schema.GroupKind{Group: manifest.Group, Kind: k.Kind}.String()]; !ok && k.Conversion {
				return fmt.Errorf("kind %s has conversion enabled but no converter is registered", k.Kind)
			}
			kind, ok := a.kinds[gvk(manifest.Group, v.Name, k.Kind)]
			if !ok {
				return fmt.Errorf("kind %s/%s exists in manifest but is not managed by the app", k.Kind, v.Name)
			}
			if k.Admission != nil && k.Admission.SupportsAnyValidation() && kind.Validator == nil {
				return fmt.Errorf("kind %s/%s supports validation but has no validator", k.Kind, v.Name)
			}
			if k.Admission != nil && k.Admission.SupportsAnyMutation() && kind.Mutator == nil {
				return fmt.Errorf("kind %s/%s supports mutation but has no mutator", k.Kind, v.Name)
			}
			// Check for the inverse
			if kind.Validator != nil && (k.Admission == nil || !k.Admission.SupportsAnyValidation()) {
				return fmt.Errorf("kind %s/%s does not support validation, but has a validator", k.Kind, v.Name)
			}
			if kind.Mutator != nil && (k.Admission == nil || !k.Admission.SupportsAnyMutation()) {
				return fmt.Errorf("kind %s/%s does not support mutation, but has a mutator", k.Kind, v.Name)
			}
		}
	}
	return nil
}

// ManagedKinds returns a slice of all Kinds managed by this App
func (a *App) ManagedKinds() []resource.Kind {
	kinds := make([]resource.Kind, 0)
	for _, k := range a.kinds {
		kinds = append(kinds, k.Kind)
	}
	return kinds
}

// Runner returns a resource.Runnable() that runs the underlying operator.InformerController and all custom runners
// added via AddRunnable. The returned resource.Runnable also implements metrics.Provider, allowing the caller
// to gather prometheus.Collector objects used by all underlying runners.
func (a *App) Runner() app.Runnable {
	return a.runner
}

// AddRunnable adds an arbitrary resource.Runnable runner to the App, which will be encapsulated as part of Runner().Run().
// If the provided runner also implements metrics.Provider, PrometheusCollectors() will be called when called on Runner().
func (a *App) AddRunnable(runner app.Runnable) {
	a.runner.AddRunnable(runner)
}

// manageKind introduces a new kind to manage.
func (a *App) manageKind(kind AppManagedKind) error {
	a.gvrToGVK[gvr(kind.Kind.Group(), kind.Kind.Version(), kind.Kind.Plural())] = gvk(kind.Kind.Group(), kind.Kind.Version(), kind.Kind.Kind())
	a.kinds[gvk(kind.Kind.Group(), kind.Kind.Version(), kind.Kind.Kind())] = kind
	// If there are custom routes, validate them
	for route, handler := range kind.CustomRoutes {
		if route.Method == "" {
			return errors.New("custom route cannot have an empty method")
		}
		if route.Path == "" {
			return errors.New("custom route cannot have an empty path")
		}
		if handler == nil {
			return errors.New("custom route cannot have a nil handler")
		}
		key := a.customRouteHandlerKey(kind.Kind.GroupVersionKind(), string(route.Method), route.Path, kind.Kind.Scope())
		if _, ok := a.customRoutes[key]; ok {
			return fmt.Errorf("custom route '%s %s' already exists", route.Method, route.Path)
		}
		a.customRoutes[key] = handler
	}
	if kind.Reconciler != nil || kind.Watcher != nil {
		return a.watchKind(AppUnmanagedKind{
			Kind:       kind.Kind,
			Reconciler: kind.Reconciler,
			Watcher:    kind.Watcher,
			ReconcileOptions: UnmanagedKindReconcileOptions{
				Namespace:      kind.ReconcileOptions.Namespace,
				LabelFilters:   kind.ReconcileOptions.LabelFilters,
				FieldSelectors: kind.ReconcileOptions.FieldSelectors,
				UseOpinionated: !kind.ReconcileOptions.UsePlain,
			},
		})
	}
	return nil
}

func (a *App) watchKind(kind AppUnmanagedKind) error {
	if kind.Reconciler != nil && kind.Watcher != nil {
		return errors.New("please provide either Watcher or Reconciler, not both")
	}
	if kind.Reconciler != nil || kind.Watcher != nil {
		infSupplier := a.cfg.InformerConfig.InformerSupplier
		if infSupplier == nil {
			infSupplier = DefaultInformerSupplier
		}

		opts := a.cfg.InformerConfig.InformerOptions
		opts.ListWatchOptions = operator.ListWatchOptions{
			Namespace:      kind.ReconcileOptions.Namespace,
			LabelFilters:   kind.ReconcileOptions.LabelFilters,
			FieldSelectors: kind.ReconcileOptions.FieldSelectors,
		}

		inf, err := infSupplier(kind.Kind, a.clientGenerator, opts)
		if err != nil {
			return err
		}
		err = a.informerController.AddInformer(inf, kind.Kind.GroupVersionKind().String())
		if err != nil {
			return fmt.Errorf("could not add informer to controller: %v", err)
		}
		if kind.Reconciler != nil {
			reconciler := kind.Reconciler
			if kind.ReconcileOptions.UseOpinionated {
				op, err := operator.NewOpinionatedReconciler(&watchPatcher{a.patcher.ForKind(kind.Kind.GroupVersionKind().GroupKind())}, a.getFinalizer(kind.Kind))
				if err != nil {
					return err
				}
				op.Wrap(kind.Reconciler)
				reconciler = op
			}
			err = a.informerController.AddReconciler(reconciler, kind.Kind.GroupVersionKind().String())
			if err != nil {
				return fmt.Errorf("could not add reconciler to controller: %v", err)
			}
		}
		if kind.Watcher != nil {
			watcher := kind.Watcher
			if kind.ReconcileOptions.UseOpinionated {
				op, err := operator.NewOpinionatedWatcher(kind.Kind, &watchPatcher{a.patcher.ForKind(kind.Kind.GroupVersionKind().GroupKind())}, operator.OpinionatedWatcherConfig{
					Finalizer:           a.getFinalizer,
					InProgressFinalizer: a.getInProgressFinalizer,
				})
				if err != nil {
					return err
				}
				if cast, ok := kind.Watcher.(syncWatcher); ok {
					op.Wrap(cast, false)
					op.SyncFunc = cast.Sync
				} else {
					op.Wrap(kind.Watcher, true)
				}
				watcher = op
			}
			err = a.informerController.AddWatcher(watcher, kind.Kind.GroupVersionKind().String())
			if err != nil {
				return fmt.Errorf("could not add watcher to controller: %v", err)
			}
		}
	}
	return nil
}

// RegisterKindConverter adds a converter for a GroupKind, which will then be processed on Convert calls
func (a *App) RegisterKindConverter(groupKind schema.GroupKind, converter k8s.Converter) {
	a.converters[groupKind.String()] = converter
}

// PrometheusCollectors implements metrics.Provider and returns prometheus collectors used by the app for exposing metrics
func (a *App) PrometheusCollectors() []prometheus.Collector {
	return a.collectors
}

func (a *App) HealthChecks() []health.Check {
	checks := make([]health.Check, 0)

	checks = append(checks, a.runner.HealthChecks()...)
	checks = append(checks, a.informerController.HealthChecks()...)

	return checks
}

// RegisterMetricsCollectors registers additional prometheus collectors for the app, in addition to those provided
// by any Runnables the app will run as part of Runner(). These additional prometheus collectors are exposed
// as a part of the list returned by PrometheusCollectors().
func (a *App) RegisterMetricsCollectors(collectors ...prometheus.Collector) {
	a.collectors = append(a.collectors, collectors...)
}

// Validate implements app.App and handles Validating Admission Requests
func (a *App) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	k, ok := a.kinds[gvk(req.Group, req.Version, req.Kind)]
	if !ok {
		// TODO: Default validator instead of ErrNotImplemented?
		return app.ErrNotImplemented
	}
	if k.Validator == nil {
		return app.ErrNotImplemented
	}
	return k.Validator.Validate(ctx, req)
}

// Mutate implements app.App and handles Mutating Admission Requests
func (a *App) Mutate(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
	k, ok := a.kinds[gvk(req.Group, req.Version, req.Kind)]
	if !ok {
		// TODO: Default mutator instead of ErrNotImplemented?
		return nil, app.ErrNotImplemented
	}
	if k.Mutator == nil {
		return nil, app.ErrNotImplemented
	}
	return k.Mutator.Mutate(ctx, req)
}

// Convert implements app.App and handles resource conversion requests
func (a *App) Convert(_ context.Context, req app.ConversionRequest) (*app.RawObject, error) {
	converter, ok := a.converters[req.SourceGVK.GroupKind().String()]
	if !ok {
		// Default conversion?
		return nil, app.ErrNotImplemented
	}
	srcAPIVersion, _ := req.SourceGVK.ToAPIVersionAndKind()
	dstAPIVersion, _ := req.TargetGVK.ToAPIVersionAndKind()
	converted, err := converter.Convert(k8s.RawKind{
		Kind:       req.SourceGVK.Kind,
		APIVersion: srcAPIVersion,
		Group:      req.SourceGVK.Group,
		Version:    req.SourceGVK.Version,
		Raw:        req.Raw.Raw,
	}, dstAPIVersion)
	return &app.RawObject{
		Raw: converted,
	}, err
}

// CallCustomRoute implements app.App and handles custom resource route requests
func (a *App) CallCustomRoute(ctx context.Context, writer app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	if req.ResourceIdentifier.Kind == "" && req.ResourceIdentifier.Plural == "" {
		scope := resource.NamespacedScope
		if req.ResourceIdentifier.Namespace == "" {
			scope = resource.ClusterScope
		}
		if handler, ok := a.customRoutes[a.customRouteHandlerKey(schema.GroupVersionKind{
			Version: req.ResourceIdentifier.Version,
		}, req.Method, req.Path, scope)]; ok {
			return handler(ctx, writer, req)
		}
	}
	key := gvk(req.ResourceIdentifier.Group, req.ResourceIdentifier.Version, req.ResourceIdentifier.Kind)
	if req.ResourceIdentifier.Kind == "" {
		key = a.gvrToGVK[gvr(req.ResourceIdentifier.Group, req.ResourceIdentifier.Version, req.ResourceIdentifier.Plural)]
	}
	k, ok := a.kinds[key]
	if !ok {
		// TODO: still return the not found, or just return NotImplemented?
		return app.ErrCustomRouteNotFound
	}
	if handler, ok := a.customRoutes[a.customRouteHandlerKey(k.Kind.GroupVersionKind(), req.Method, req.Path, k.Kind.Scope())]; ok {
		return handler(ctx, writer, req)
	}
	return app.ErrCustomRouteNotFound
}

func (a *App) getFinalizer(sch resource.Schema) string {
	if a.cfg.InformerConfig.FinalizerSupplier != nil {
		return a.cfg.InformerConfig.FinalizerSupplier(sch)
	}
	if a.cfg.Name != "" {
		return fmt.Sprintf("%s-%s-finalizer", a.cfg.Name, sch.Plural())
	}
	return fmt.Sprintf("%s-finalizer", sch.Plural())
}

func (a *App) getInProgressFinalizer(sch resource.Schema) string {
	if a.cfg.InformerConfig.InProgressFinalizerSupplier != nil {
		return a.cfg.InformerConfig.InProgressFinalizerSupplier(sch)
	}
	if a.cfg.Name != "" {
		return fmt.Sprintf("%s-wip", a.cfg.Name)
	}
	return fmt.Sprintf("%s-wip", sch.Plural())
}

func (*App) customRouteHandlerKey(gvk schema.GroupVersionKind, method string, path string, scope resource.SchemaScope) string {
	if len(path) > 0 && path[0] == '/' {
		path = path[1:]
	}
	return fmt.Sprintf("%s|%s|%s|%s|%s|%s", scope, gvk.Group, gvk.Version, gvk.Kind, strings.ToUpper(method), path)
}

type syncWatcher interface {
	operator.ResourceWatcher
	Sync(ctx context.Context, object resource.Object) error
}

func gvk(group, version, kind string) string {
	return fmt.Sprintf("%s/%s/%s", group, version, kind)
}

func gvr(group, version, plural string) string {
	return fmt.Sprintf("%s/%s/%s", group, version, plural)
}

type k8sRunner interface {
	Run(<-chan struct{}) error
}

type k8sRunnable struct {
	runner k8sRunner
}

func (k *k8sRunnable) Run(ctx context.Context) error {
	return k.runner.Run(ctx.Done())
}

var _ operator.PatchClient = &watchPatcher{}

type watchPatcher struct {
	patcher *k8s.DynamicKindPatcher
}

func (w *watchPatcher) PatchInto(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, options resource.PatchOptions, into resource.Object) error {
	obj, err := w.patcher.Patch(ctx, identifier, req, options)
	if err != nil {
		return err
	}
	// This is only used to update the finalizers list, so we just need to update metadata
	into.SetCommonMetadata(obj.GetCommonMetadata())
	return nil
}

func (w *watchPatcher) GetInto(ctx context.Context, identifier resource.Identifier, into resource.Object) error {
	obj, err := w.patcher.Get(ctx, identifier)
	if err != nil {
		return err
	}
	into.SetCommonMetadata(obj.GetCommonMetadata())
	return nil
}
