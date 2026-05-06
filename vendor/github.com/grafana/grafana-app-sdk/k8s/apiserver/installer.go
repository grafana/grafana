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
	"reflect"
	"regexp"
	"sort"
	"strings"
	"sync"

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
type CustomRouteResponseResolver func(kind, ver, path, method string) (any, bool)

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
}

var (
	// ErrAppNotInitialized is returned if the app.App has not been initialized
	ErrAppNotInitialized = errors.New("app not initialized")
	// ErrAppAlreadyInitialized is returned if the app.App has already been initialized and cannot be initialized again
	ErrAppAlreadyInitialized = errors.New("app already initialized")
)

var _ AppInstaller = (*defaultInstaller)(nil)

type defaultInstaller struct {
	appProvider         app.Provider
	appConfig           app.Config
	managedKindResolver ManagedKindResolver
	customRouteResolver CustomRouteResponseResolver

	app    app.App
	appMux sync.Mutex
	scheme *runtime.Scheme
	codecs serializer.CodecFactory
}

// NewDefaultAppInstaller creates a new AppInstaller with default behavior for an app.Provider and app.Config.
//
//nolint:revive
func NewDefaultAppInstaller(appProvider app.Provider, appConfig app.Config, kindResolver ManagedKindResolver, customRouteResolver CustomRouteResponseResolver) (*defaultInstaller, error) {
	installer := &defaultInstaller{
		appProvider:         appProvider,
		appConfig:           appConfig,
		managedKindResolver: kindResolver,
		customRouteResolver: customRouteResolver,
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
	for gv, kinds := range kindsByGV {
		for _, kind := range kinds {
			scheme.AddKnownTypeWithName(kind.Kind.GroupVersionKind(), kind.Kind.ZeroValue())
			scheme.AddKnownTypeWithName(gv.WithKind(kind.Kind.Kind()+"List"), kind.Kind.ZeroListValue())
			metav1.AddToGroupVersion(scheme, kind.Kind.GroupVersionKind().GroupVersion())
			if _, ok := internalKinds[kind.Kind.Kind()]; !ok {
				internalKinds[kind.Kind.Kind()] = kind.Kind
			}
			if _, ok := kindsByGroup[kind.Kind.Group()]; !ok {
				kindsByGroup[kind.Kind.Group()] = []resource.Kind{}
			}
			kindsByGroup[kind.Kind.Group()] = append(kindsByGroup[kind.Kind.Group()], kind.Kind)
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

	internalGv := schema.GroupVersion{Group: r.appConfig.ManifestData.Group, Version: runtime.APIVersionInternal}
	for _, internalKind := range internalKinds {
		scheme.AddKnownTypeWithName(internalGv.WithKind(internalKind.Kind()), internalKind.ZeroValue())
		scheme.AddKnownTypeWithName(internalGv.WithKind(internalKind.Kind()+"List"), internalKind.ZeroListValue())

		for _, kind := range kindsByGroup[internalKind.Group()] {
			if err = scheme.AddConversionFunc(kind.ZeroValue(), internalKind.ZeroValue(), r.conversionHandler); err != nil {
				return fmt.Errorf("could not add conversion func for kind %s: %w", internalKind.Kind(), err)
			}
			if err = scheme.AddConversionFunc(internalKind.ZeroValue(), kind.ZeroValue(), r.conversionHandler); err != nil {
				return fmt.Errorf("could not add conversion func for kind %s: %w", internalKind.Kind(), err)
			}
		}
	}

	sort.Slice(groupVersions, func(i, j int) bool {
		return version.CompareKubeAwareVersionStrings(groupVersions[i].Version, groupVersions[j].Version) < 0
	})
	if err = scheme.SetVersionPriority(groupVersions...); err != nil {
		return fmt.Errorf("failed to set version priority: %w", err)
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
			kind, ok := r.managedKindResolver(manifestKind.Kind, v.Name)
			if !ok {
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
				maps.Copy(res, r.getManifestCustomRoutesOpenAPI(manifestKind.Kind, v.Name, manifestKind.Routes, defaultEtcdPathPrefix, callback))
			}
		}
	}
	if hasCustomRoutes {
		maps.Copy(res, GetResourceCallOptionsOpenAPIDefinition())
	}
	return res
}

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
			s, err := newGenericStoreForKind(r.scheme, kind.Kind, optsGetter)
			if err != nil {
				return fmt.Errorf("failed to create store for kind %s: %w", kind.Kind.Kind(), err)
			}
			storage[kind.Kind.Plural()] = s
			if _, ok := kind.Kind.ZeroValue().GetSubresource(string(resource.SubresourceStatus)); ok {
				storage[fmt.Sprintf("%s/%s", kind.Kind.Plural(), resource.SubresourceStatus)] = newRegistryStatusStoreForKind(r.scheme, kind.Kind, s)
			}
			for route, props := range kind.ManifestKind.Routes {
				if route == "" {
					continue
				}
				if route[0] == '/' {
					route = route[1:]
				}
				storage[fmt.Sprintf("%s/%s", kind.Kind.Plural(), route)] = &SubresourceConnector{
					Methods: spec3PropsToConnectorMethods(props, kind.Kind.Kind(), gv.Version, route, r.customRouteResolver),
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

	return server.InstallAPIGroup(&apiGroupInfo)
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

func (r *defaultInstaller) conversionHandler(a, b any, _ conversion.Scope) error {
	if r.app == nil {
		return fmt.Errorf("app is not initialized")
	}
	if r.scheme == nil {
		return fmt.Errorf("scheme is not initialized")
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
		SourceGVK: aResourceObj.GroupVersionKind(),
		TargetGVK: bResourceObj.GroupVersionKind(),
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

func (r *defaultInstaller) getManifestCustomRoutesOpenAPI(kind, ver string, routes map[string]spec3.PathProps, defaultPkgPrefix string, callback common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	defs := make(map[string]common.OpenAPIDefinition)
	for path, pathProps := range routes {
		if pathProps.Get != nil {
			key, val := r.getOperationOpenAPI(kind, ver, path, "GET", pathProps.Get, r.customRouteResolver, defaultPkgPrefix, callback)
			defs[key] = val
		}
		if pathProps.Post != nil {
			key, val := r.getOperationOpenAPI(kind, ver, path, "POST", pathProps.Post, r.customRouteResolver, defaultPkgPrefix, callback)
			defs[key] = val
		}
		if pathProps.Put != nil {
			key, val := r.getOperationOpenAPI(kind, ver, path, "PUT", pathProps.Put, r.customRouteResolver, defaultPkgPrefix, callback)
			defs[key] = val
		}
		if pathProps.Patch != nil {
			key, val := r.getOperationOpenAPI(kind, ver, path, "PATCH", pathProps.Patch, r.customRouteResolver, defaultPkgPrefix, callback)
			defs[key] = val
		}
		if pathProps.Delete != nil {
			key, val := r.getOperationOpenAPI(kind, ver, path, "DELETE", pathProps.Delete, r.customRouteResolver, defaultPkgPrefix, callback)
			defs[key] = val
		}
		if pathProps.Head != nil {
			key, val := r.getOperationOpenAPI(kind, ver, path, "HEAD", pathProps.Head, r.customRouteResolver, defaultPkgPrefix, callback)
			defs[key] = val
		}
		if pathProps.Options != nil {
			key, val := r.getOperationOpenAPI(kind, ver, path, "OPTIONS", pathProps.Options, r.customRouteResolver, defaultPkgPrefix, callback)
			defs[key] = val
		}
	}
	return defs
}

func (*defaultInstaller) getOperationOpenAPI(kind, ver, path, method string, operation *spec3.Operation, resolver CustomRouteResponseResolver, defaultPkgPrefix string, _ common.ReferenceCallback) (string, common.OpenAPIDefinition) {
	typePath := ""
	if resolver == nil {
		resolver = func(_, _, _, _ string) (any, bool) {
			return nil, false
		}
	}
	goType, ok := resolver(kind, ver, path, method)
	if ok {
		typ := reflect.TypeOf(goType)
		typePath = typ.PkgPath() + "." + typ.Name()
	} else {
		// Use a default type name
		var ucFirstMethod string
		if len(method) > 1 {
			ucFirstMethod = strings.ToUpper(method[:1]) + strings.ToLower(method[1:])
		} else {
			ucFirstMethod = strings.ToUpper(method)
		}
		ucFirstPath := regexp.MustCompile("[^A-Za-z0-9]").ReplaceAllString(path, "")
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
					typeSchema = *val.Schema
				}
				if key == "application/json" {
					break
				}
			}
		}
	}
	return typePath, common.OpenAPIDefinition{
		Schema: typeSchema,
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
			kind, ok := r.managedKindResolver(manifestKind.Kind, v.Name)
			if !ok {
				return nil, fmt.Errorf("failed to resolve kind %s", manifestKind.Kind)
			}
			out[gv] = append(out[gv], KindAndManifestKind{Kind: kind, ManifestKind: manifestKind})
		}
	}
	return out, nil
}

func spec3PropsToConnectorMethods(props spec3.PathProps, kind, ver, path string, resolver CustomRouteResponseResolver) map[string]SubresourceConnectorResponseObject {
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
		resp, _ := resolver(kind, ver, path, "GET")
		methods["GET"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Get),
		}
	}
	if props.Post != nil {
		resp, _ := resolver(kind, ver, path, "POST")
		methods["POST"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Get),
		}
	}
	if props.Put != nil {
		resp, _ := resolver(kind, ver, path, "PUT")
		methods["PUT"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Get),
		}
	}
	if props.Patch != nil {
		resp, _ := resolver(kind, ver, path, "PATCH")
		methods["PATCH"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Get),
		}
	}
	if props.Delete != nil {
		resp, _ := resolver(kind, ver, path, "DELETE")
		methods["DELETE"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Get),
		}
	}
	if props.Head != nil {
		resp, _ := resolver(kind, ver, path, "HEAD")
		methods["HEAD"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Get),
		}
	}
	if props.Options != nil {
		resp, _ := resolver(kind, ver, path, "OPTIONS")
		methods["OPTIONS"] = SubresourceConnectorResponseObject{
			Object:    resp,
			MIMETypes: mimeTypes(props.Get),
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
