package apiserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"path"
	"reflect"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/emicklei/go-restful/v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/apiserver/pkg/admission"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

// ManagedKindResolver resolves a kind and version into a resource.Kind instance.
// group is not provided as a ManagedKindResolver function is expected to exist on a per-group basis.
type ManagedKindResolver func(kind, ver string) (resource.Kind, bool)

// CustomRouteResponseResolver resolves the kind, version, path, and method into a go type which is returned
// from that custom route call. kind may be empty for resource routes.
// group is not provided as a CustomRouteResponseResolver function is expected to exist on a per-group basis.
type CustomRouteResponseResolver func(kind, ver, routePath, method string) (any, bool)

// AppInstaller represents an App which can be installed on a kubernetes API server.
// It provides all the methods needed to configure and install an App onto an API server.
type AppInstaller interface {
	// AddToScheme registers all the kinds provided by the App to the runtime.Scheme.
	// Other functionality which relies on a runtime.Scheme may use the last scheme provided in AddToScheme for this purpose.
	AddToScheme(scheme *runtime.Scheme) error
	// GetOpenAPIDefinitions gets a map of OpenAPI definitions for use with kubernetes OpenAPI
	GetOpenAPIDefinitions(callback common.ReferenceCallback) map[string]common.OpenAPIDefinition
	// InstallAPIs installs the API endpoints to an API server
	InstallAPIs(server GenericAPIServer, optsGetter genericregistry.RESTOptionsGetter) error
	// AdmissionPlugin returns an admission.Factory to use for the Admission Plugin.
	// If the App does not provide admission control, it should return nil
	AdmissionPlugin() admission.Factory
	// InitializeApp initializes the underlying App for the AppInstaller using the provided kube config.
	// This should only be called once, if the App is already initialized the method should return ErrAppAlreadyInitialized.
	// App initialization should only be done once the final kube config is ready, as it cannot be changed after initialization.
	InitializeApp(clientrest.Config) error
	// App returns the underlying App, if initialized, or ErrAppNotInitialized if not.
	// Callers which depend on the App should account for the App not yet being initialized and do lazy loading or delayed retries.
	App() (app.App, error)
	// GroupVersions returns the list of all GroupVersions supported by this AppInstaller
	GroupVersions() []schema.GroupVersion
	// ManifestData returns the App's ManifestData
	ManifestData() *app.ManifestData
}

// GenericAPIServer describes a generic API server which can have an API Group installed onto it
type GenericAPIServer interface {
	// InstallAPIGroup installs the provided APIGroupInfo onto the API Server
	InstallAPIGroup(apiGroupInfo *genericapiserver.APIGroupInfo) error
	// RegisteredWebServices returns a list of pointers to currently-installed restful.WebService instances
	RegisteredWebServices() []*restful.WebService
}

var _ GenericAPIServer = &KubernetesGenericAPIServer{}

// KubernetesGenericAPIServer implements GenericAPIServer for a kubernetes *server.GenericAPIServer
type KubernetesGenericAPIServer struct {
	*genericapiserver.GenericAPIServer
}

// NewKubernetesGenericAPIServer creates a new KubernetesGenericAPIServer wrapping the provided *server.GenericAPIServer
func NewKubernetesGenericAPIServer(apiserver *genericapiserver.GenericAPIServer) *KubernetesGenericAPIServer {
	return &KubernetesGenericAPIServer{
		GenericAPIServer: apiserver,
	}
}

func (k *KubernetesGenericAPIServer) InstallAPIGroup(apiGroupInfo *genericapiserver.APIGroupInfo) error {
	err := k.GenericAPIServer.InstallAPIGroup(apiGroupInfo)
	if err != nil {
		return err
	}
	// Make sure GroupVersions which have no resources still get installed
	for _, gv := range apiGroupInfo.PrioritizedVersions {
		if m, ok := apiGroupInfo.VersionedResourcesStorageMap[gv.Group]; ok && len(m) > 0 {
			continue
		}
		// Check if a WS exists for the path (it might if a different version for the group had kinds)
		rootPath := fmt.Sprintf("/apis/%s/%s", gv.Group, gv.Version)
		if k.Handler == nil || k.Handler.GoRestfulContainer == nil {
			return errors.New("cannot install custom route: underlying Handler.GoRestfulContainer is nil")
		}
		found := false
		for _, ws := range k.Handler.GoRestfulContainer.RegisteredWebServices() {
			if ws.RootPath() == rootPath {
				found = true
				break
			}
		}
		if !found {
			ws := new(restful.WebService)
			ws.Path(fmt.Sprintf("/apis/%s/%s", gv.Group, gv.Version))
			k.Handler.GoRestfulContainer.Add(ws)
		}
	}
	return nil
}

// RegisteredWebServices returns the result of the underlying apiserver's Handler.GoRestfulContainer.RegisteredWebServices(),
// or nil if either Handler or Handler.GoRestfulContainer is nil
func (k *KubernetesGenericAPIServer) RegisteredWebServices() []*restful.WebService {
	if k.Handler != nil && k.Handler.GoRestfulContainer != nil {
		return k.Handler.GoRestfulContainer.RegisteredWebServices()
	}
	return nil
}

// GoTypeResolver is an interface which describes an object which catalogs the relationship between different aspects of an app
// and its go types which need to be used by the API server.
type GoTypeResolver interface {
	// KindToGoType resolves a kind and version into a resource.Kind instance.
	// group is not provided as a KindToGoType function is expected to exist on a per-group basis.
	//nolint:revive
	KindToGoType(kind, version string) (goType resource.Kind, exists bool)
	// CustomRouteReturnGoType resolves the kind, version, path, and method into a go type which is returned
	// from that custom route call. kind may be empty for resource routes.
	// group is not provided as a CustomRouteReturnGoType function is expected to exist on a per-group basis.
	//nolint:revive
	CustomRouteReturnGoType(kind, version, path, verb string) (goType any, exists bool)
	// CustomRouteQueryGoType resolves the kind, version, path, and method into a go type which is returned
	// used for the query parameters of the route.
	// group is not provided as a CustomRouteQueryGoType function is expected to exist on a per-group basis.
	//nolint:revive
	CustomRouteQueryGoType(kind, version, path, verb string) (goType runtime.Object, exists bool)
	// CustomRouteRequestBodyGoType resolves the kind, version, path, and method into a go type which is
	// the accepted body type for the request.
	// group is not provided as a CustomRouteRequestBodyGoType function is expected to exist on a per-group basis.
	//nolint:revive
	CustomRouteRequestBodyGoType(kind, version, path, verb string) (goType any, exists bool)
}

var (
	// ErrAppNotInitialized is returned if the app.App has not been initialized
	ErrAppNotInitialized = errors.New("app not initialized")
	// ErrAppAlreadyInitialized is returned if the app.App has already been initialized and cannot be initialized again
	ErrAppAlreadyInitialized = errors.New("app already initialized")
)

var _ AppInstaller = (*defaultInstaller)(nil)

type defaultInstaller struct {
	appProvider    app.Provider
	appConfig      app.Config
	resolver       GoTypeResolver
	resourceConfig *serverstorage.ResourceConfig

	app    app.App
	appMux sync.Mutex
	scheme *runtime.Scheme
	codecs serializer.CodecFactory
}

// NewDefaultAppInstaller creates a new AppInstaller with default behavior for an app.Provider and app.Config.
//
//nolint:revive
func NewDefaultAppInstaller(appProvider app.Provider, appConfig app.Config, resolver GoTypeResolver) (*defaultInstaller, error) {
	installer := &defaultInstaller{
		appProvider: appProvider,
		appConfig:   appConfig,
		resolver:    resolver,
	}
	if installer.appConfig.ManifestData.IsEmpty() {
		// Fill in the manifest data from the Provider if we can
		m := appProvider.Manifest()
		if m.ManifestData != nil {
			installer.appConfig.ManifestData = *m.ManifestData
		}
	}
	if installer.appConfig.SpecificConfig == nil {
		installer.appConfig.SpecificConfig = appProvider.SpecificConfig()
	}
	return installer, nil
}

// SetResourceConfig sets a ResourceConfig for the installer, which will be used to check each kind and route
// when installing the APIs. Custom routes will be matched using the first slash-separated segment of their path as the resource.
// Providing a `nil` ResourceConfig will remove any resourceConfig checking (this is the default behavior).
func (r *defaultInstaller) SetResourceConfig(resourceConfig *serverstorage.ResourceConfig) {
	r.resourceConfig = resourceConfig
}

//nolint:gocognit,gocyclo,funlen
func (r *defaultInstaller) AddToScheme(scheme *runtime.Scheme) error {
	if scheme == nil {
		return errors.New("scheme cannot be nil")
	}

	kindsByGV, err := r.getKindsByGroupVersion()
	if err != nil {
		return fmt.Errorf("failed to get kinds by group version: %w", err)
	}

	internalKinds := map[string]resource.Kind{}
	kindsByGroup := map[string][]resource.Kind{}
	groupVersions := make([]schema.GroupVersion, 0)
	kindVersionPriorities := make(map[string][]string)
	for gv, kinds := range kindsByGV {
		for _, kind := range kinds {
			priorities, ok := kindVersionPriorities[kind.Kind.Kind()]
			if !ok {
				priorities = make([]string, 0)
			}
			priorities = append(priorities, gv.Version)
			kindVersionPriorities[kind.Kind.Kind()] = priorities

			scheme.AddKnownTypeWithName(kind.Kind.GroupVersionKind(), kind.Kind.ZeroValue())
			scheme.AddKnownTypeWithName(gv.WithKind(kind.Kind.Kind()+"List"), kind.Kind.ZeroListValue())
			metav1.AddToGroupVersion(scheme, kind.Kind.GroupVersionKind().GroupVersion())
			// Ensure that the internal kind uses the preferred version if possible,
			// but otherwise make sure it always has _something_ set
			if _, ok := internalKinds[kind.Kind.Kind()]; !ok || r.appConfig.ManifestData.PreferredVersion == gv.Version {
				internalKinds[kind.Kind.Kind()] = kind.Kind
			}
			if _, ok := kindsByGroup[kind.Kind.Group()]; !ok {
				kindsByGroup[kind.Kind.Group()] = []resource.Kind{}
			}
			kindsByGroup[kind.Kind.Group()] = append(kindsByGroup[kind.Kind.Group()], kind.Kind)

			for cpath, pathProps := range kind.ManifestKind.Routes {
				if pathProps.Get != nil {
					if t, exists := r.resolver.CustomRouteQueryGoType(kind.Kind.Kind(), gv.Version, cpath, "GET"); exists {
						scheme.AddKnownTypes(gv, t)
					}
				}
			}

			// Register field selectors
			err := scheme.AddFieldLabelConversionFunc(
				kind.Kind.GroupVersionKind(),
				fieldLabelConversionFuncForKind(kind.Kind),
			)
			if err != nil {
				return err
			}
		}
		scheme.AddUnversionedTypes(gv, &ResourceCallOptions{})
		err = scheme.AddGeneratedConversionFunc((*url.Values)(nil), (*ResourceCallOptions)(nil), func(a, b any, scope conversion.Scope) error {
			return CovertURLValuesToResourceCallOptions(a.(*url.Values), b.(*ResourceCallOptions), scope)
		})
		if err != nil {
			return fmt.Errorf("could not add conversion func for ResourceCallOptions: %w", err)
		}
		groupVersions = append(groupVersions, gv)
	}

	// Make sure we didn't miss any versions that don't have any kinds registered
	for _, v := range r.appConfig.ManifestData.Versions {
		gv := schema.GroupVersion{Group: r.appConfig.ManifestData.Group, Version: v.Name}
		if _, ok := kindsByGV[gv]; ok {
			continue
		}
		groupVersions = append(groupVersions, gv)
		// Add a dummy kind to the scheme for this version to get it to exist in the scheme (used for discovery)
		scheme.AddKnownTypeWithName(gv.WithKind("none"), &resource.UntypedObject{})
	}

	internalGv := schema.GroupVersion{Group: r.appConfig.ManifestData.Group, Version: runtime.APIVersionInternal}
	for _, internalKind := range internalKinds {
		scheme.AddKnownTypeWithName(internalGv.WithKind(internalKind.Kind()), internalKind.ZeroValue())
		scheme.AddKnownTypeWithName(internalGv.WithKind(internalKind.Kind()+"List"), internalKind.ZeroListValue())

		for _, kind := range kindsByGroup[internalKind.Group()] {
			if kind.Kind() != internalKind.Kind() {
				continue
			}
			if err = scheme.AddConversionFunc(kind.ZeroValue(), internalKind.ZeroValue(), r.conversionHandlerFunc(kind.GroupVersionKind(), internalKind.GroupVersionKind())); err != nil {
				return fmt.Errorf("could not add conversion func for kind %s: %w", internalKind.Kind(), err)
			}
			if err = scheme.AddConversionFunc(internalKind.ZeroValue(), kind.ZeroValue(), r.conversionHandlerFunc(internalKind.GroupVersionKind(), kind.GroupVersionKind())); err != nil {
				return fmt.Errorf("could not add conversion func for kind %s: %w", internalKind.Kind(), err)
			}
		}
	}

	sort.Slice(groupVersions, func(i, j int) bool {
		if groupVersions[i].Version == r.appConfig.ManifestData.PreferredVersion {
			return true
		}
		if groupVersions[j].Version == r.appConfig.ManifestData.PreferredVersion {
			return false
		}
		return version.CompareKubeAwareVersionStrings(groupVersions[i].Version, groupVersions[j].Version) > 0
	})
	if len(groupVersions) > 0 {
		if err = scheme.SetVersionPriority(groupVersions...); err != nil {
			return fmt.Errorf("failed to set version priority: %w", err)
		}
	}

	// save the scheme for later use
	if r.scheme == nil {
		r.scheme = scheme
		r.codecs = serializer.NewCodecFactory(scheme)
	}

	return nil
}

func (r *defaultInstaller) ManifestData() *app.ManifestData {
	return r.appProvider.Manifest().ManifestData
}

func (r *defaultInstaller) GetOpenAPIDefinitions(callback common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	res := map[string]common.OpenAPIDefinition{}
	hasCustomRoutes := false
	for _, v := range r.appConfig.ManifestData.Versions {
		for _, manifestKind := range v.Kinds {
			kind, ok := r.resolver.KindToGoType(manifestKind.Kind, v.Name)
			if !ok {
				fmt.Printf("Resolver failed to look up version=%s, kind=%s. This will impact kind availability\n", v.Name, manifestKind.Kind) //nolint:revive
				continue
			}
			if r.scheme == nil {
				fmt.Printf("scheme is not set in defaultInstaller.GetOpenAPIDefinitions, skipping %s. This will impact kind availability\n", manifestKind.Kind) //nolint:revive
				continue
			}
			pkgPrefix := ""
			for k, t := range r.scheme.KnownTypes(schema.GroupVersion{Group: r.appConfig.ManifestData.Group, Version: v.Name}) {
				if k == manifestKind.Kind {
					pkgPrefix = t.PkgPath()
				}
			}
			if pkgPrefix == "" {
				fmt.Printf("scheme does not contain kind %s.%s, skipping OpenAPI component\n", v.Name, manifestKind.Kind) //nolint:revive
			}
			oapi, err := manifestKind.Schema.AsKubeOpenAPI(kind.GroupVersionKind(), callback, pkgPrefix)
			if err != nil {
				fmt.Printf("failed to convert kind %s to KubeOpenAPI: %v\n", kind.GroupVersionKind().Kind, err) //nolint:revive
				continue
			}
			maps.Copy(res, oapi)
			if len(manifestKind.Routes) > 0 {
				hasCustomRoutes = true
				// Add the definitions and use the name as the reflect type name from the resolver, if it exists
				maps.Copy(res, r.getManifestCustomRoutesOpenAPI(manifestKind.Kind, v.Name, manifestKind.Routes, "", defaultEtcdPathPrefix, callback))
			}
		}
		// TODO: improve this, it's a bit wonky
		customRoutePkgPrefix := ""
		if len(v.Routes.Namespaced) > 0 {
			hasCustomRoutes = true
			entries := r.getManifestCustomRoutesOpenAPI("", v.Name, v.Routes.Namespaced, "<namespace>", "", callback)
			maps.Copy(res, entries)
			for k := range entries {
				parts := strings.Split(k, ".") // Everything before the . is the prefix
				customRoutePkgPrefix = strings.Join(parts[:len(parts)-1], ".")
				break
			}
		}
		if len(v.Routes.Cluster) > 0 {
			hasCustomRoutes = true
			entries := r.getManifestCustomRoutesOpenAPI("", v.Name, v.Routes.Cluster, "", "", callback)
			maps.Copy(res, entries)
			for k := range entries {
				parts := strings.Split(k, ".") // Everything before the . is the prefix
				customRoutePkgPrefix = strings.Join(parts[:len(parts)-1], ".")
				break
			}
		}
		if len(v.Routes.Schemas) > 0 {
			replFunc := app.KubeOpenAPIReferenceReplacerFunc(customRoutePkgPrefix, schema.GroupVersionKind{Group: r.appConfig.ManifestData.Group, Version: v.Name})
			for key, sch := range v.Routes.Schemas {
				// copy the schema so we don't modify the original
				cpy := copySpecSchema(&sch)
				deps := r.replaceReferencesInSchema(&cpy, callback, replFunc)
				res[replFunc(key)] = common.OpenAPIDefinition{
					Schema:       cpy,
					Dependencies: deps,
				}
			}
		}
	}
	if hasCustomRoutes {
		maps.Copy(res, GetResourceCallOptionsOpenAPIDefinition())
		res["github.com/grafana/grafana-app-sdk/k8s/apiserver.EmptyObject"] = common.OpenAPIDefinition{
			Schema: spec.Schema{
				SchemaProps: spec.SchemaProps{
					Description: "EmptyObject defines a model for a missing object type",
					Type:        []string{"object"},
				},
			},
		}
	}
	return res
}

//nolint:gocognit,funlen,gocyclo
func (r *defaultInstaller) InstallAPIs(server GenericAPIServer, optsGetter genericregistry.RESTOptionsGetter) error {
	group := r.appConfig.ManifestData.Group
	if r.scheme == nil {
		r.scheme = newScheme()
		r.codecs = serializer.NewCodecFactory(r.scheme)
		if err := r.AddToScheme(r.scheme); err != nil {
			return fmt.Errorf("failed to add to scheme: %w", err)
		}
	}
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(group, r.scheme, runtime.NewParameterCodec(r.scheme), r.codecs)

	kindsByGV, err := r.getKindsByGroupVersion()
	if err != nil {
		return fmt.Errorf("failed to get kinds by group version: %w", err)
	}

	for gv, kinds := range kindsByGV {
		storage := map[string]rest.Storage{}
		for _, kind := range kinds {
			if r.resourceConfig != nil && !r.resourceConfig.ResourceEnabled(schema.GroupVersionResource{
				Group:    gv.Group,
				Version:  gv.Version,
				Resource: kind.Kind.Plural(),
			}) {
				logging.DefaultLogger.Info("Skipping resource based on provided ResourceConfig", "kind", kind.Kind, "version", gv.Version, "group", group)
				continue
			}
			s, err := newGenericStoreForKind(r.scheme, kind.Kind, optsGetter)
			if err != nil {
				return fmt.Errorf("failed to create store for kind %s: %w", kind.Kind.Kind(), err)
			}
			storage[kind.Kind.Plural()] = s
			// Loop through all subresources and set up storage
			for sr := range kind.Kind.ZeroValue().GetSubresources() {
				// Use *StatusREST for the status subresource for backwards compatibility with grafana
				if sr == string(resource.SubresourceStatus) {
					storage[fmt.Sprintf("%s/%s", kind.Kind.Plural(), resource.SubresourceStatus)] = newRegistryStatusStoreForKind(r.scheme, kind.Kind, s)
					continue
				}
				storage[fmt.Sprintf("%s/%s", kind.Kind.Plural(), sr)] = newSubresourceREST(s, r.scheme, kind.Kind, sr)
			}
			for route, props := range kind.ManifestKind.Routes {
				if route == "" {
					continue
				}
				if route[0] == '/' {
					route = route[1:]
				}
				storage[fmt.Sprintf("%s/%s", kind.Kind.Plural(), route)] = &SubresourceConnector{
					Methods: spec3PropsToConnectorMethods(props, kind.Kind.Kind(), gv.Version, route, r.resolver.CustomRouteReturnGoType),
					Route: CustomRoute{
						Path: route,
						Handler: func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
							logging.FromContext(ctx).Debug("Calling custom subresource route", "path", route, "namespace", request.ResourceIdentifier.Namespace, "name", request.ResourceIdentifier.Name, "gvk", kind.Kind.GroupVersionKind().String())
							a, err := r.App()
							if err != nil {
								logging.FromContext(ctx).Error("failed to get app for calling custom route", "error", err, "path", route, "namespace", request.ResourceIdentifier.Namespace, "name", request.ResourceIdentifier.Name, "gvk", kind.Kind.GroupVersionKind().String())
								return err
							}
							err = a.CallCustomRoute(ctx, writer, request)
							if errors.Is(err, app.ErrCustomRouteNotFound) {
								writer.WriteHeader(http.StatusNotFound)
								fullError := apierrors.StatusError{
									ErrStatus: metav1.Status{
										Status: metav1.StatusFailure,
										Code:   http.StatusNotFound,
										Reason: metav1.StatusReasonNotFound,
										Details: &metav1.StatusDetails{
											Group: gv.Group,
											Kind:  kind.ManifestKind.Kind,
											Name:  request.ResourceIdentifier.Name,
										},
										Message: fmt.Sprintf("%s.%s/%s subresource '%s' not found", kind.ManifestKind.Plural, gv.Group, gv.Version, route),
									}}
								return json.NewEncoder(writer).Encode(fullError)
							}
							return err
						},
					},
					Kind: kind.Kind,
				}
			}
			apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
		}
	}

	// Make sure we didn't miss any versions that don't have any kinds registered
	hasEnabledRoutes := make(map[string]bool)
	for _, v := range r.appConfig.ManifestData.Versions {
		gv := schema.GroupVersion{Group: r.appConfig.ManifestData.Group, Version: v.Name}
		for routePath := range v.Routes.Namespaced {
			if r.isCustomRouteEnabled(gv, routePath) {
				hasEnabledRoutes[gv.Version] = true
				break
			}
		}
		for routePath := range v.Routes.Cluster {
			if r.isCustomRouteEnabled(gv, routePath) {
				hasEnabledRoutes[gv.Version] = true
				break
			}
		}
		if _, ok := kindsByGV[gv]; ok {
			continue
		}
		if !slices.Contains(apiGroupInfo.PrioritizedVersions, gv) {
			if !hasEnabledRoutes[gv.Version] {
				// skip this version because none of the custom routes are enabled
				continue
			}
			apiGroupInfo.PrioritizedVersions = append(apiGroupInfo.PrioritizedVersions, gv)
		}
	}

	err = server.InstallAPIGroup(&apiGroupInfo)
	if err != nil {
		return err
	}

	// version custom routes
	hasResourceRoutes := false
	for _, v := range r.ManifestData().Versions {
		if len(v.Routes.Namespaced) > 0 || len(v.Routes.Cluster) > 0 {
			hasResourceRoutes = true
			break
		}
	}
	if hasResourceRoutes {
		webServices := server.RegisteredWebServices()
		if webServices == nil {
			return errors.New("could not register custom routes: server.RegisteredWebServices() is nil")
		}
		for _, ver := range r.ManifestData().Versions {
			if !hasEnabledRoutes[ver.Name] {
				// No resource routes for this version
				continue
			}
			found := false
			for _, ws := range webServices {
				if ws.RootPath() == fmt.Sprintf("/apis/%s/%s", group, ver.Name) {
					found = true
					for rpath, route := range ver.Routes.Namespaced {
						if !r.isCustomRouteEnabled(schema.GroupVersion{Group: group, Version: ver.Name}, rpath) {
							logging.DefaultLogger.Info("Skipping namespaced custom route based on provided ResourceConfig", "path", rpath, "version", ver.Name, "group", group)
							continue
						}
						err := r.registerResourceRoute(ws, schema.GroupVersion{Group: group, Version: ver.Name}, rpath, route, resource.NamespacedScope)
						if err != nil {
							return fmt.Errorf("failed to register namespaced custom route '%s' for version %s: %w", rpath, ver.Name, err)
						}
					}
					for rpath, route := range ver.Routes.Cluster {
						if !r.isCustomRouteEnabled(schema.GroupVersion{Group: group, Version: ver.Name}, rpath) {
							logging.DefaultLogger.Info("Skipping cluster custom route based on provided ResourceConfig", "path", rpath, "version", ver.Name, "group", group)
							continue
						}
						err := r.registerResourceRoute(ws, schema.GroupVersion{Group: group, Version: ver.Name}, rpath, route, resource.ClusterScope)
						if err != nil {
							return fmt.Errorf("failed to register cluster custom route '%s' for version %s: %w", rpath, ver.Name, err)
						}
					}
					break
				}
			}
			if !found {
				// Return an error here rather than failing silently to add the routes
				return fmt.Errorf("failed to find WebService for version %s", ver.Name)
			}
		}
	}

	return err
}

func (r *defaultInstaller) registerResourceRoute(ws *restful.WebService, gv schema.GroupVersion, rpath string, props spec3.PathProps, scope resource.SchemaScope) error {
	if props.Get != nil {
		if err := r.registerResourceRouteOperation(ws, gv, rpath, props.Get, scope, "GET"); err != nil {
			return err
		}
	}
	if props.Post != nil {
		if err := r.registerResourceRouteOperation(ws, gv, rpath, props.Post, scope, "POST"); err != nil {
			return err
		}
	}
	if props.Put != nil {
		if err := r.registerResourceRouteOperation(ws, gv, rpath, props.Put, scope, "PUT"); err != nil {
			return err
		}
	}
	if props.Patch != nil {
		if err := r.registerResourceRouteOperation(ws, gv, rpath, props.Patch, scope, "PATCH"); err != nil {
			return err
		}
	}
	if props.Delete != nil {
		if err := r.registerResourceRouteOperation(ws, gv, rpath, props.Delete, scope, "DELETE"); err != nil {
			return err
		}
	}
	if props.Head != nil {
		if err := r.registerResourceRouteOperation(ws, gv, rpath, props.Head, scope, "HEAD"); err != nil {
			return err
		}
	}
	if props.Options != nil {
		if err := r.registerResourceRouteOperation(ws, gv, rpath, props.Options, scope, "OPTIONS"); err != nil {
			return err
		}
	}
	return nil
}

func (r *defaultInstaller) registerResourceRouteOperation(ws *restful.WebService, gv schema.GroupVersion, rpath string, op *spec3.Operation, scope resource.SchemaScope, method string) error {
	lookup := rpath
	if scope == resource.NamespacedScope {
		lookup = path.Join("<namespace>", rpath)
	}
	responseType, ok := r.resolver.CustomRouteReturnGoType("", gv.Version, lookup, method)
	if !ok {
		// TODO: warn here?
		responseType = &EmptyObject{}
	}
	fullpath := rpath
	if scope == resource.NamespacedScope {
		fullpath = path.Join("namespaces", "{namespace}", rpath)
	}
	var builder *restful.RouteBuilder
	switch strings.ToLower(method) {
	case "get":
		builder = ws.GET(fullpath)
	case "post":
		builder = ws.POST(fullpath)
	case "put":
		builder = ws.PUT(fullpath)
	case "patch":
		builder = ws.PATCH(fullpath)
	case "delete":
		builder = ws.DELETE(fullpath)
	case "head":
		builder = ws.HEAD(fullpath)
	case "options":
		builder = ws.OPTIONS(fullpath)
	default:
		return fmt.Errorf("unsupported method %s", method)
	}
	if op.RequestBody != nil {
		if goBody, ok := r.resolver.CustomRouteRequestBodyGoType("", gv.Version, lookup, method); ok {
			builder = builder.Reads(goBody)
		}
	}
	if scope == resource.NamespacedScope {
		builder = builder.Param(restful.PathParameter("namespace", "object name and auth scope, such as for teams and projects"))
	}
	for _, param := range op.Parameters {
		switch param.In {
		case "path":
			builder = builder.Param(restful.PathParameter(param.Name, param.Description))
		case "query":
			builder = builder.Param(restful.QueryParameter(param.Name, param.Description))
		case "header":
			builder = builder.Param(restful.HeaderParameter(param.Name, param.Description))
		default:
		}
	}

	ws.Route(builder.Operation(prefixRouteIDWithK8sVerbIfNotPresent(op.OperationId, method)).To(func(req *restful.Request, resp *restful.Response) {
		a, err := r.App()
		if err != nil {
			resp.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(resp).Encode(metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: err.Error(),
			})
		}
		identifier := resource.FullIdentifier{
			Group:   r.appConfig.ManifestData.Group,
			Version: gv.Version,
		}
		if scope == resource.NamespacedScope {
			identifier.Namespace = req.PathParameters()["namespace"]
		}
		err = a.CallCustomRoute(req.Request.Context(), resp, &app.CustomRouteRequest{
			ResourceIdentifier: identifier,
			Path:               rpath,
			URL:                req.Request.URL,
			Method:             req.Request.Method,
			Headers:            req.Request.Header,
			Body:               req.Request.Body,
		})
		if err != nil {
			resp.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(resp).Encode(metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: err.Error(),
			})
		}
	}).Returns(200, "OK", responseType))
	return nil
}

var allowedK8sVerbs = []string{
	"get", "log", "read", "replace", "patch", "delete", "deletecollection", "watch", "connect", "proxy", "list", "create", "patch",
}

var httpMethodToK8sVerb = map[string]string{
	http.MethodGet:     "get",
	http.MethodPost:    "create",
	http.MethodPut:     "replace",
	http.MethodPatch:   "patch",
	http.MethodDelete:  "delete",
	http.MethodConnect: "connect",
	http.MethodOptions: "connect", // No real equivalent to options and head
	http.MethodHead:    "connect",
}

func prefixRouteIDWithK8sVerbIfNotPresent(operationID string, method string) string {
	for _, verb := range allowedK8sVerbs {
		if len(operationID) > len(verb) && operationID[:len(verb)] == verb {
			return operationID
		}
	}
	return fmt.Sprintf("%s%s", httpMethodToK8sVerb[strings.ToUpper(method)], operationID)
}

func (r *defaultInstaller) AdmissionPlugin() admission.Factory {
	supportsMutation := false
	supportsValidation := false
	for _, v := range r.appConfig.ManifestData.Versions {
		for _, manifestKind := range v.Kinds {
			if manifestKind.Admission != nil && manifestKind.Admission.SupportsAnyMutation() {
				supportsMutation = true
			}
			if manifestKind.Admission != nil && manifestKind.Admission.SupportsAnyValidation() {
				supportsValidation = true
			}
		}
	}
	if supportsMutation || supportsValidation {
		return func(_ io.Reader) (admission.Interface, error) {
			return newAppAdmission(r.appConfig.ManifestData, func() app.App {
				return r.app
			}), nil
		}
	}

	return nil
}

func (r *defaultInstaller) InitializeApp(cfg clientrest.Config) error {
	r.appMux.Lock()
	defer r.appMux.Unlock()
	if r.app != nil {
		return ErrAppAlreadyInitialized
	}
	initApp, err := r.appProvider.NewApp(app.Config{
		KubeConfig:     cfg,
		SpecificConfig: r.appConfig.SpecificConfig,
		ManifestData:   r.appConfig.ManifestData,
	})
	if err != nil {
		return err
	}
	r.app = initApp
	return nil
}

func (r *defaultInstaller) App() (app.App, error) {
	if r.app == nil {
		return nil, ErrAppNotInitialized
	}
	return r.app, nil
}

func (r *defaultInstaller) GroupVersions() []schema.GroupVersion {
	groupVersions := make([]schema.GroupVersion, 0)
	for _, gv := range r.appConfig.ManifestData.Versions {
		groupVersions = append(groupVersions, schema.GroupVersion{Group: r.appConfig.ManifestData.Group, Version: gv.Name})
	}
	return groupVersions
}

// isCustomRouteEnabled returns true if any of the following are true:
// * resourceConfig is nil
// * a resource with the same GV and resource==<first /-separated path segment of the path> is enabled
// This is split into a separate method to allow for this logic to be more complex if we need to do exact route matching
func (r *defaultInstaller) isCustomRouteEnabled(groupVersion schema.GroupVersion, routePath string) bool {
	return r.resourceConfig == nil ||
		r.resourceConfig.ResourceEnabled(groupVersion.WithResource(strings.Split(strings.Trim(routePath, "/"), "/")[0]))
}

// conversionHandlerFunc returns a function that will convert resources of type src to dst.
// Since the objects passed to the conversion function don't contain any information,
// this is the way to handle this without using reflection and associating the kind go types to the GVK necessary.
// If this doesn't work in some edge cases in the future, we could also build a map of reflect.Type -> resource.Kind when
// registering resources in the scheme.
func (r *defaultInstaller) conversionHandlerFunc(src, dst schema.GroupVersionKind) func(a, b any, _ conversion.Scope) error {
	return func(a, b any, _ conversion.Scope) error {
		if r.app == nil {
			return errors.New("app is not initialized")
		}
		if r.scheme == nil {
			return errors.New("scheme is not initialized")
		}
		aResourceObj, ok := a.(resource.Object)
		if !ok {
			return fmt.Errorf("object (%T) is not a resource.Object", a)
		}
		bResourceObj, ok := b.(resource.Object)
		if !ok {
			return fmt.Errorf("object (%T) is not a resource.Object", b)
		}

		rawInput, err := runtime.Encode(r.codecs.LegacyCodec(aResourceObj.GroupVersionKind().GroupVersion()), aResourceObj)
		if err != nil {
			return fmt.Errorf("failed to encode object %s: %w", aResourceObj.GetName(), err)
		}

		req := app.ConversionRequest{
			SourceGVK: src,
			TargetGVK: dst,
			Raw: app.RawObject{
				Raw:      rawInput,
				Object:   aResourceObj,
				Encoding: resource.KindEncodingJSON,
			},
		}
		res, err := r.app.Convert(context.Background(), req)
		if err != nil {
			return fmt.Errorf("failed to convert object %s from %s to %s: %w", aResourceObj.GetName(), req.SourceGVK, req.TargetGVK, err)
		}

		bObj, ok := b.(runtime.Object)
		if !ok {
			return fmt.Errorf("object (%T) is not a runtime.Object", b)
		}

		return runtime.DecodeInto(r.codecs.UniversalDecoder(bResourceObj.GroupVersionKind().GroupVersion()), res.Raw, bObj)
	}
}

func (r *defaultInstaller) getManifestCustomRoutesOpenAPI(kind, ver string, routes map[string]spec3.PathProps, routePathPrefix string, defaultPkgPrefix string, callback common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	defs := make(map[string]common.OpenAPIDefinition)
	for rpath, pathProps := range routes {
		if routePathPrefix != "" {
			rpath = path.Join(routePathPrefix, rpath)
		}
		if pathProps.Get != nil {
			key, val := r.getOperationResponseOpenAPI(kind, ver, rpath, "GET", pathProps.Get, r.resolver.CustomRouteReturnGoType, defaultPkgPrefix, callback)
			defs[key] = val
			if pathProps.Get.RequestBody != nil {
				key, val := r.getOperationRequestBodyOpenAPI(kind, ver, rpath, "GET", pathProps.Get, r.resolver.CustomRouteRequestBodyGoType, defaultPkgPrefix, callback)
				defs[key] = val
			}
		}
		if pathProps.Post != nil {
			key, val := r.getOperationResponseOpenAPI(kind, ver, rpath, "POST", pathProps.Post, r.resolver.CustomRouteReturnGoType, defaultPkgPrefix, callback)
			defs[key] = val
			if pathProps.Post.RequestBody != nil {
				key, val := r.getOperationRequestBodyOpenAPI(kind, ver, rpath, "POST", pathProps.Post, r.resolver.CustomRouteRequestBodyGoType, defaultPkgPrefix, callback)
				defs[key] = val
			}
		}
		if pathProps.Put != nil {
			key, val := r.getOperationResponseOpenAPI(kind, ver, rpath, "PUT", pathProps.Put, r.resolver.CustomRouteReturnGoType, defaultPkgPrefix, callback)
			defs[key] = val
			if pathProps.Put.RequestBody != nil {
				key, val := r.getOperationRequestBodyOpenAPI(kind, ver, rpath, "PUT", pathProps.Put, r.resolver.CustomRouteRequestBodyGoType, defaultPkgPrefix, callback)
				defs[key] = val
			}
		}
		if pathProps.Patch != nil {
			key, val := r.getOperationResponseOpenAPI(kind, ver, rpath, "PATCH", pathProps.Patch, r.resolver.CustomRouteReturnGoType, defaultPkgPrefix, callback)
			defs[key] = val
			if pathProps.Patch.RequestBody != nil {
				key, val := r.getOperationRequestBodyOpenAPI(kind, ver, rpath, "PATCH", pathProps.Patch, r.resolver.CustomRouteRequestBodyGoType, defaultPkgPrefix, callback)
				defs[key] = val
			}
		}
		if pathProps.Delete != nil {
			key, val := r.getOperationResponseOpenAPI(kind, ver, rpath, "DELETE", pathProps.Delete, r.resolver.CustomRouteReturnGoType, defaultPkgPrefix, callback)
			defs[key] = val
			if pathProps.Delete.RequestBody != nil {
				key, val := r.getOperationRequestBodyOpenAPI(kind, ver, rpath, "DELETE", pathProps.Delete, r.resolver.CustomRouteRequestBodyGoType, defaultPkgPrefix, callback)
				defs[key] = val
			}
		}
		if pathProps.Head != nil {
			key, val := r.getOperationResponseOpenAPI(kind, ver, rpath, "HEAD", pathProps.Head, r.resolver.CustomRouteReturnGoType, defaultPkgPrefix, callback)
			defs[key] = val
			if pathProps.Head.RequestBody != nil {
				key, val := r.getOperationRequestBodyOpenAPI(kind, ver, rpath, "HEAD", pathProps.Head, r.resolver.CustomRouteRequestBodyGoType, defaultPkgPrefix, callback)
				defs[key] = val
			}
		}
		if pathProps.Options != nil {
			key, val := r.getOperationResponseOpenAPI(kind, ver, rpath, "OPTIONS", pathProps.Options, r.resolver.CustomRouteReturnGoType, defaultPkgPrefix, callback)
			defs[key] = val
			if pathProps.Options.RequestBody != nil {
				key, val := r.getOperationRequestBodyOpenAPI(kind, ver, rpath, "OPTIONS", pathProps.Options, r.resolver.CustomRouteRequestBodyGoType, defaultPkgPrefix, callback)
				defs[key] = val
			}
		}
	}
	return defs
}

func (r *defaultInstaller) getOperationResponseOpenAPI(kind, ver, opPath, method string, op *spec3.Operation, resolver CustomRouteResponseResolver, defaultPkgPrefix string, ref common.ReferenceCallback) (string, common.OpenAPIDefinition) {
	// We need to fully copy the route info so that multiple calls to this method with the same input (such as calling GetOpenAPIDefinitions() multiple times) don't cause issues when we do ref replacement
	operation := copyOperation(op)

	typePath := ""
	if resolver == nil {
		resolver = func(_, _, _, _ string) (any, bool) {
			return nil, false
		}
	}
	goType, ok := resolver(kind, ver, opPath, method)
	pkgPrefix := defaultPkgPrefix
	if ok {
		typ := reflect.TypeOf(goType)
		pkgPrefix = typ.PkgPath()
		typePath = typ.PkgPath() + "." + typ.Name()
	} else {
		// Use a default type name
		var ucFirstMethod string
		if len(method) > 1 {
			ucFirstMethod = strings.ToUpper(method[:1]) + strings.ToLower(method[1:])
		} else {
			ucFirstMethod = strings.ToUpper(method)
		}
		ucFirstPath := regexp.MustCompile("[^A-Za-z0-9]").ReplaceAllString(opPath, "")
		if len(ucFirstPath) > 1 {
			ucFirstPath = strings.ToUpper(ucFirstPath[:1]) + ucFirstPath[1:]
		} else {
			ucFirstPath = strings.ToUpper(ucFirstPath)
		}
		typePath = fmt.Sprintf("%s.%s%s", defaultPkgPrefix, ucFirstMethod, ucFirstPath)
	}
	var typeSchema spec.Schema
	if operation.Responses != nil && operation.Responses.Default != nil {
		if len(operation.Responses.Default.Content) > 0 {
			for key, val := range operation.Responses.Default.Content {
				if val.Schema != nil {
					// Copy the schema since we may make alterations
					typeSchema = copySpecSchema(val.Schema)
				}
				if key == "application/json" {
					break
				}
			}
		}
	}
	dependencies := r.replaceReferencesInSchema(&typeSchema, ref, app.KubeOpenAPIReferenceReplacerFunc(pkgPrefix, schema.GroupVersionKind{Kind: kind, Version: ver}))
	// Check for x-grafana-app extensions that dictate that the metadata field is a kubernetes metadata object,
	// and should be replaced with the canonical definition like we do with kinds.
	if metadataProp, ok := typeSchema.Properties["metadata"]; ok {
		if usesObjectMeta, ok := metadataProp.Extensions[app.OpenAPIExtensionUsesKubernetesObjectMeta]; ok {
			if cast, ok := usesObjectMeta.(bool); ok && cast {
				typeSchema.Properties["metadata"] = spec.Schema{
					SchemaProps: spec.SchemaProps{
						Default: map[string]any{},
						Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta"),
					},
				}
				dependencies = append(dependencies, "k8s.io/apimachinery/pkg/apis/meta/v1.ObjectMeta")
			}
		} else if usesListMeta, ok := metadataProp.Extensions[app.OpenAPIExtensionUsesKubernetesListMeta]; ok {
			if cast, ok := usesListMeta.(bool); ok && cast {
				typeSchema.Properties["metadata"] = spec.Schema{
					SchemaProps: spec.SchemaProps{
						Default: map[string]any{},
						Ref:     ref("k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta"),
					},
				}
				dependencies = append(dependencies, "k8s.io/apimachinery/pkg/apis/meta/v1.ListMeta")
			}
		}
	}
	if len(dependencies) == 0 {
		dependencies = nil // set dependencies to nil so it's omitted in the OpenAPIDefinition
	}
	return typePath, common.OpenAPIDefinition{
		Schema:       typeSchema,
		Dependencies: dependencies,
	}
}

func (r *defaultInstaller) replaceReferencesInSchema(sch *spec.Schema, ref common.ReferenceCallback, replaceFunc func(string) string) []string {
	deps := make([]string, 0)
	if sch.Ref.String() != "" {
		rf := strings.TrimPrefix(sch.Ref.String(), "#/components/schemas/")
		rf = replaceFunc(rf)
		sch.Ref = ref(rf)
		deps = append(deps, rf)
		return deps
	}
	for key, prop := range sch.Properties {
		if prop.Ref.String() != "" {
			// Remove leading "#/components/schemas/"
			rf := strings.TrimPrefix(prop.Ref.String(), "#/components/schemas/")
			prop.Ref = ref(replaceFunc(rf))
			sch.Properties[key] = prop
			deps = append(deps, replaceFunc(rf))
			continue
		}
		if prop.AdditionalProperties != nil && prop.AdditionalProperties.Schema != nil {
			d := r.replaceReferencesInSchema(prop.AdditionalProperties.Schema, ref, replaceFunc)
			sch.Properties[key] = prop
			deps = append(deps, d...)
			continue
		}
		if prop.Items != nil && prop.Items.Schema != nil {
			d := r.replaceReferencesInSchema(prop.Items.Schema, ref, replaceFunc)
			sch.Properties[key] = prop
			deps = append(deps, d...)
			continue
		}
		if len(prop.Properties) > 0 {
			for k, v := range prop.Properties {
				d := r.replaceReferencesInSchema(&v, ref, replaceFunc)
				prop.Properties[k] = v
				deps = append(deps, d...)
			}
			sch.Properties[key] = prop
		}
	}
	if sch.AdditionalProperties != nil && sch.AdditionalProperties.Schema != nil {
		d := r.replaceReferencesInSchema(sch.AdditionalProperties.Schema, ref, replaceFunc)
		deps = append(deps, d...)
	}
	return deps
}

func (r *defaultInstaller) getOperationRequestBodyOpenAPI(kind, ver, opPath, method string, op *spec3.Operation, resolver CustomRouteResponseResolver, defaultPkgPrefix string, ref common.ReferenceCallback) (string, common.OpenAPIDefinition) {
	// We need to fully copy the route info so that multiple calls to this method with the same input (such as calling GetOpenAPIDefinitions() multiple times) don't cause issues when we do ref replacement
	operation := copyOperation(op)
	typePath := ""
	pkgPrefix := defaultPkgPrefix
	if resolver == nil {
		resolver = func(_, _, _, _ string) (any, bool) {
			return nil, false
		}
	}
	goType, ok := resolver(kind, ver, opPath, method)
	if ok {
		typ := reflect.TypeOf(goType)
		pkgPrefix = typ.PkgPath()
		typePath = typ.PkgPath() + "." + typ.Name()
	} else {
		// Use a default type name
		var ucFirstMethod string
		if len(method) > 1 {
			ucFirstMethod = strings.ToUpper(method[:1]) + strings.ToLower(method[1:])
		} else {
			ucFirstMethod = strings.ToUpper(method)
		}
		ucFirstPath := regexp.MustCompile("[^A-Za-z0-9]").ReplaceAllString(opPath, "")
		if len(ucFirstPath) > 1 {
			ucFirstPath = strings.ToUpper(ucFirstPath[:1]) + ucFirstPath[1:]
		} else {
			ucFirstPath = strings.ToUpper(ucFirstPath)
		}
		typePath = fmt.Sprintf("%s.%s%s", defaultPkgPrefix, ucFirstMethod, ucFirstPath)
	}
	var typeSchema spec.Schema
	if operation.RequestBody != nil {
		if len(operation.RequestBody.Content) > 0 {
			for key, val := range operation.RequestBody.Content {
				if val.Schema != nil {
					typeSchema = copySpecSchema(val.Schema)
				}
				if key == "application/json" {
					break
				}
			}
		}
	}
	dependencies := r.replaceReferencesInSchema(&typeSchema, ref, app.KubeOpenAPIReferenceReplacerFunc(pkgPrefix, schema.GroupVersionKind{Kind: kind, Version: ver}))
	if len(dependencies) == 0 {
		dependencies = nil
	}
	return typePath, common.OpenAPIDefinition{
		Schema:       typeSchema,
		Dependencies: dependencies,
	}
}

type KindAndManifestKind struct {
	Kind         resource.Kind
	ManifestKind app.ManifestVersionKind
}

func (r *defaultInstaller) getKindsByGroupVersion() (map[schema.GroupVersion][]KindAndManifestKind, error) {
	out := make(map[schema.GroupVersion][]KindAndManifestKind)
	group := r.appConfig.ManifestData.Group
	for _, v := range r.appConfig.ManifestData.Versions {
		for _, manifestKind := range v.Kinds {
			gv := schema.GroupVersion{Group: group, Version: v.Name}
			kind, ok := r.resolver.KindToGoType(manifestKind.Kind, v.Name)
			if !ok {
				return nil, fmt.Errorf("failed to resolve kind %s", manifestKind.Kind)
			}
			out[gv] = append(out[gv], KindAndManifestKind{Kind: kind, ManifestKind: manifestKind})
		}
	}
	return out, nil
}

func spec3PropsToConnectorMethods(props spec3.PathProps, kind, ver, routePath string, resolver CustomRouteResponseResolver) map[string]SubresourceConnectorResponseObject {
	if resolver == nil {
		resolver = func(_, _, _, _ string) (any, bool) {
			return nil, false
		}
	}
	mimeTypes := func(operation *spec3.Operation) []string {
		if operation.Responses == nil {
			return []string{"*/*"}
		}
		if operation.Responses.Default == nil {
			return []string{"*/*"}
		}
		types := make([]string, 0)
		for contentType := range operation.Responses.Default.Content {
			types = append(types, contentType)
		}
		return types
	}
	methods := make(map[string]SubresourceConnectorResponseObject)
	if props.Get != nil {
		resp, _ := resolver(kind, ver, routePath, "GET")
		methods["GET"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Get),
		}
	}
	if props.Post != nil {
		resp, _ := resolver(kind, ver, routePath, "POST")
		methods["POST"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Post),
		}
	}
	if props.Put != nil {
		resp, _ := resolver(kind, ver, routePath, "PUT")
		methods["PUT"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Put),
		}
	}
	if props.Patch != nil {
		resp, _ := resolver(kind, ver, routePath, "PATCH")
		methods["PATCH"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Patch),
		}
	}
	if props.Delete != nil {
		resp, _ := resolver(kind, ver, routePath, "DELETE")
		methods["DELETE"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Delete),
		}
	}
	if props.Head != nil {
		resp, _ := resolver(kind, ver, routePath, "HEAD")
		methods["HEAD"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Head),
		}
	}
	if props.Options != nil {
		resp, _ := resolver(kind, ver, routePath, "OPTIONS")
		methods["OPTIONS"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Options),
		}
	}
	return methods
}

func NewDefaultScheme() *runtime.Scheme {
	return newScheme()
}

func newScheme() *runtime.Scheme {
	unversionedVersion := schema.GroupVersion{Group: "", Version: "v1"}
	unversionedTypes := []runtime.Object{
		&metav1.Status{},
		&metav1.WatchEvent{},
		&metav1.APIVersions{},
		&metav1.APIGroupList{},
		&metav1.APIGroup{},
		&metav1.APIResourceList{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	}

	scheme := runtime.NewScheme()
	// we need to add the options to empty v1
	metav1.AddToGroupVersion(scheme, schema.GroupVersion{Group: "", Version: "v1"})
	scheme.AddUnversionedTypes(unversionedVersion, unversionedTypes...)
	return scheme
}

func copyPointerPrimitive[T any](f *T) *T {
	if f == nil {
		return nil
	}
	cpy := *f
	return &cpy
}

func copySpecSchemaArray(in []spec.Schema) []spec.Schema {
	if in == nil {
		return nil
	}
	out := make([]spec.Schema, len(in))
	for i := range in {
		out[i] = copySpecSchema(&in[i])
	}
	return out
}

//nolint:funlen
func copySpecSchema(in *spec.Schema) spec.Schema {
	out := spec.Schema{}
	if in == nil {
		return out
	}
	out.ID = in.ID
	out.Ref = in.Ref       // TODO: Ref has pointers inside of it
	out.Schema = in.Schema // SchemaURL is an alias of string
	out.Description = in.Description
	if in.Type != nil {
		out.Type = append(spec.StringOrArray{}, in.Type...)
	}
	out.Nullable = in.Nullable
	out.Format = in.Format
	out.Title = in.Title
	out.Default = in.Default // TODO: this is any, should we make a copy of this?
	out.Maximum = copyPointerPrimitive(in.Maximum)
	out.ExclusiveMaximum = in.ExclusiveMaximum
	out.Minimum = copyPointerPrimitive(in.Minimum)
	out.ExclusiveMinimum = in.ExclusiveMinimum
	out.MaxLength = copyPointerPrimitive(in.MaxLength)
	out.MinLength = copyPointerPrimitive(in.MinLength)
	out.Pattern = in.Pattern
	out.MaxItems = copyPointerPrimitive(in.MaxItems)
	out.MinItems = copyPointerPrimitive(in.MinItems)
	out.UniqueItems = in.UniqueItems
	out.MultipleOf = copyPointerPrimitive(in.MultipleOf)
	out.Enum = in.Enum // TODO: this is type any, we should copy?
	out.MaxProperties = copyPointerPrimitive(in.MaxProperties)
	out.MinProperties = copyPointerPrimitive(in.MinProperties)
	if in.Required != nil {
		out.Required = make([]string, len(in.Required))
		copy(out.Required, in.Required)
	}
	if in.Items != nil {
		out.Items = &spec.SchemaOrArray{}
		if in.Items.Schema != nil {
			schemaCopy := copySpecSchema(in.Items.Schema)
			out.Items.Schema = &schemaCopy
		}
		if len(in.Items.Schemas) > 0 {
			out.Items.Schemas = copySpecSchemaArray(in.Items.Schemas)
		}
	}
	out.AllOf = copySpecSchemaArray(in.AllOf)
	out.OneOf = copySpecSchemaArray(in.OneOf)
	out.AnyOf = copySpecSchemaArray(in.AnyOf)
	if in.Not != nil {
		cpy := copySpecSchema(in.Not)
		out.Not = &cpy
	}
	if in.Properties != nil {
		out.Properties = make(map[string]spec.Schema)
		for k, v := range in.Properties {
			out.Properties[k] = copySpecSchema(&v)
		}
	}
	if in.AdditionalProperties != nil {
		out.AdditionalProperties = &spec.SchemaOrBool{
			Allows: in.AdditionalProperties.Allows,
		}
		if in.AdditionalProperties.Schema != nil {
			schemaCopy := copySpecSchema(in.AdditionalProperties.Schema)
			out.AdditionalProperties.Schema = &schemaCopy
		}
	}
	if in.PatternProperties != nil {
		out.PatternProperties = make(map[string]spec.Schema)
		for k, v := range in.PatternProperties {
			out.Properties[k] = copySpecSchema(&v)
		}
	}
	if in.Dependencies != nil {
		out.Dependencies = make(spec.Dependencies)
		for k, v := range in.Dependencies {
			val := spec.SchemaOrStringArray{}
			if v.Schema != nil {
				schemaCopy := copySpecSchema(v.Schema)
				val.Schema = &schemaCopy
			}
			if len(v.Property) > 0 {
				val.Property = make([]string, len(v.Property))
				copy(val.Property, v.Property)
			}
			out.Dependencies[k] = val
		}
	}
	if in.AdditionalItems != nil {
		out.AdditionalItems = &spec.SchemaOrBool{
			Allows: in.AdditionalItems.Allows,
		}
		if in.AdditionalItems.Schema != nil {
			schemaCopy := copySpecSchema(in.AdditionalItems.Schema)
			out.AdditionalItems.Schema = &schemaCopy
		}
	}
	if in.Definitions != nil {
		out.Definitions = make(map[string]spec.Schema)
		for k, v := range in.Definitions {
			out.Definitions[k] = copySpecSchema(&v)
		}
	}
	out.Discriminator = in.Discriminator
	out.ReadOnly = in.ReadOnly
	if in.ExternalDocs != nil {
		out.ExternalDocs = &spec.ExternalDocumentation{
			Description: in.ExternalDocs.Description,
			URL:         in.ExternalDocs.URL,
		}
	}
	out.Example = in.Example // TODO: this is any
	if in.Extensions != nil {
		out.Extensions = spec.Extensions{}
		maps.Copy(out.Extensions, in.Extensions)
	}
	if in.ExtraProps != nil {
		out.ExtraProps = make(map[string]any)
		maps.Copy(out.ExtraProps, in.ExtraProps)
	}
	return out
}

func copyOperation(operation *spec3.Operation) *spec3.Operation {
	if operation == nil {
		return nil
	}
	cpy := spec3.Operation{
		OperationProps: spec3.OperationProps{
			Summary:     operation.Summary,
			Description: operation.Description,
			OperationId: operation.OperationId,
			Deprecated:  operation.Deprecated,
			RequestBody: copySpec3RequestBody(operation.RequestBody),
			Responses:   copySpec3Responses(operation.Responses),
		},
	}
	if operation.Tags != nil {
		cpy.Tags = make([]string, len(operation.Tags))
		copy(cpy.Tags, operation.Tags)
	}
	// TODO: ExternalDocs -- not used currently
	if operation.Parameters != nil {
		cpy.Parameters = make([]*spec3.Parameter, len(operation.Parameters))
		for idx, param := range operation.Parameters {
			cpy.Parameters[idx] = copySpec3Parameter(param)
		}
	}
	// TODO: SecurityRequirements -- not used currently
	// TODO: Servers -- not used currently
	if operation.Extensions != nil {
		cpy.Extensions = make(map[string]any)
		maps.Copy(cpy.Extensions, operation.Extensions)
	}

	return &cpy
}

func copySpec3Parameter(param *spec3.Parameter) *spec3.Parameter {
	if param == nil {
		return nil
	}
	cpy := spec3.Parameter{
		ParameterProps: spec3.ParameterProps{
			Name:            param.Name,
			In:              param.In,
			Description:     param.Description,
			Required:        param.Required,
			Deprecated:      param.Deprecated,
			AllowEmptyValue: param.AllowEmptyValue,
			Style:           param.Style,
			Explode:         param.Explode,
			AllowReserved:   param.AllowReserved,
		},
	}
	if param.Schema != nil {
		schCpy := copySpecSchema(param.Schema)
		cpy.Schema = &schCpy
	}
	if param.Content != nil {
		cpy.Content = make(map[string]*spec3.MediaType)
		for k, v := range param.Content {
			cpy.Content[k] = copySpec3MediaType(v)
		}
	}
	// TODO: Example -- not used currently
	// TODO: Examples -- not used currently
	if param.Ref.String() != "" {
		cpy.Ref, _ = spec.NewRef(param.Ref.String())
	}
	if param.Extensions != nil {
		cpy.Extensions = make(map[string]any)
		maps.Copy(cpy.Extensions, param.Extensions)
	}
	return &cpy
}

func copySpec3RequestBody(body *spec3.RequestBody) *spec3.RequestBody {
	if body == nil {
		return nil
	}
	cpy := spec3.RequestBody{
		RequestBodyProps: spec3.RequestBodyProps{
			Description: body.Description,
			Required:    body.Required,
		},
	}
	if body.Content != nil {
		cpy.Content = make(map[string]*spec3.MediaType)
		for k, v := range body.Content {
			cpy.Content[k] = copySpec3MediaType(v)
		}
	}
	if body.Ref.String() != "" {
		cpy.Ref, _ = spec.NewRef(body.Ref.String())
	}
	if body.Extensions != nil {
		cpy.Extensions = make(map[string]any)
		maps.Copy(cpy.Extensions, body.Extensions)
	}
	return &cpy
}

func copySpec3Responses(responses *spec3.Responses) *spec3.Responses {
	if responses == nil {
		return nil
	}
	cpy := spec3.Responses{
		ResponsesProps: spec3.ResponsesProps{
			Default: copySpec3Response(responses.Default),
		},
	}
	if responses.StatusCodeResponses != nil {
		cpy.StatusCodeResponses = make(map[int]*spec3.Response)
		for k, v := range responses.StatusCodeResponses {
			cpy.StatusCodeResponses[k] = copySpec3Response(v)
		}
	}
	if responses.Extensions != nil {
		cpy.Extensions = make(map[string]any)
		maps.Copy(cpy.Extensions, responses.Extensions)
	}
	return &cpy
}

func copySpec3Response(response *spec3.Response) *spec3.Response {
	if response == nil {
		return nil
	}
	cpy := spec3.Response{
		ResponseProps: spec3.ResponseProps{
			Description: response.Description,
		},
	}
	if response.Headers != nil {
		cpy.Headers = make(map[string]*spec3.Header)
		maps.Copy(cpy.Headers, response.Headers) // Just copy the map because we never mutate these
	}
	if response.Content != nil {
		cpy.Content = make(map[string]*spec3.MediaType)
		for k, v := range response.Content {
			cpy.Content[k] = copySpec3MediaType(v)
		}
	}
	if response.Links != nil {
		cpy.Links = make(map[string]*spec3.Link)
		maps.Copy(cpy.Links, response.Links) // Just copy the map because we never mutate these
	}
	if response.Ref.String() != "" {
		cpy.Ref, _ = spec.NewRef(response.Ref.String())
	}
	if response.Extensions != nil {
		cpy.Extensions = make(map[string]any)
		maps.Copy(cpy.Extensions, response.Extensions)
	}
	return &cpy
}

func copySpec3MediaType(mt *spec3.MediaType) *spec3.MediaType {
	if mt == nil {
		return nil
	}
	cpy := spec3.MediaType{
		MediaTypeProps: spec3.MediaTypeProps{
			Example: mt.Example,
		},
	}
	if mt.Schema != nil {
		schCpy := copySpecSchema(mt.Schema)
		cpy.Schema = &schCpy
	}
	// TODO: Example -- not used currently
	// TODO: Examples -- not used currently
	if mt.Encoding != nil {
		cpy.Encoding = make(map[string]*spec3.Encoding)
		maps.Copy(cpy.Encoding, mt.Encoding) // Just copy the map because we never mutate these
	}
	if mt.Extensions != nil {
		cpy.Extensions = make(map[string]any)
		maps.Copy(cpy.Extensions, mt.Extensions)
	}
	return &cpy
}

type EmptyObject struct{}

func fieldLabelConversionFuncForKind(kind resource.Kind) func(label, value string) (string, string, error) {
	return func(label, value string) (string, string, error) {
		if label == "metadata.name" || (kind.Scope() != resource.ClusterScope && label == "metadata.namespace") {
			return label, value, nil
		}
		fields := kind.SelectableFields()
		for _, field := range fields {
			// Allow either dot-prefixed or no prefix for the selector
			if field.FieldSelector == label || strings.TrimPrefix(field.FieldSelector, ".") == label {
				// match function trims the dot prefix, so make sure we're using the one without it
				return strings.TrimPrefix(field.FieldSelector, "."), value, nil
			}
		}
		return "", "", fmt.Errorf("field label not supported for %s: %s", kind.GroupVersionKind(), label)
	}
}
