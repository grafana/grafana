package apiserver

import (
	"fmt"
	"maps"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/util/compatibility"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana-app-sdk/app"
)

type Config struct {
	Generic    *genericapiserver.RecommendedConfig
	scheme     *runtime.Scheme
	codecs     serializer.CodecFactory
	installers []AppInstaller
}

// NewConfig returns a new Config for the provided installers
func NewConfig(installers []AppInstaller) (*Config, error) {
	scheme := newScheme()
	codecs := serializer.NewCodecFactory(scheme)
	return NewConfigWithScheme(installers, scheme, codecs)
}

// NewConfigWithScheme creates a new Config with a provided runtime.Scheme and serializer.CodecFactory.
// This can be used for more fine-grained control of the scheme.
func NewConfigWithScheme(installers []AppInstaller, scheme *runtime.Scheme, codecs serializer.CodecFactory) (*Config, error) {
	c := &Config{
		scheme:     scheme,
		codecs:     codecs,
		installers: installers,
	}
	if err := c.addToScheme(); err != nil {
		return nil, err
	}
	c.Generic = genericapiserver.NewRecommendedConfig(codecs)
	return c, nil
}

func (c *Config) addToScheme() error {
	for _, installer := range c.installers {
		if err := installer.AddToScheme(c.scheme); err != nil {
			return err
		}
	}
	return nil
}

func (c *Config) UpdateOpenAPIConfig() {
	defGetter := func(callback common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		res := make(map[string]common.OpenAPIDefinition)
		maps.Copy(res, GetCommonOpenAPIDefinitions(callback))
		for _, installer := range c.installers {
			maps.Copy(res, installer.GetOpenAPIDefinitions(callback))
		}
		return res
	}

	c.Generic.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(defGetter, openapi.NewDefinitionNamer(c.scheme))
	c.Generic.OpenAPIConfig.Info.Title = "Core"
	c.Generic.OpenAPIConfig.Info.Version = "1.0"

	c.Generic.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(defGetter, openapi.NewDefinitionNamer(c.scheme))
	c.Generic.OpenAPIV3Config.Info.Title = "Core"
	c.Generic.OpenAPIV3Config.Info.Version = "1.0"
}

func (c *Config) NewServer(delegate genericapiserver.DelegationTarget) (*genericapiserver.GenericAPIServer, error) {
	loopbackConfig := *c.Generic.LoopbackClientConfig
	loopbackConfig.APIPath = "/apis"
	for _, installer := range c.installers {
		md := installer.ManifestData()
		if md == nil {
			return nil, fmt.Errorf("no manifest data for installer for GroupVersions %v", installer.GroupVersions())
		}
		err := installer.InitializeApp(loopbackConfig)
		if err != nil {
			return nil, err
		}
	}
	c.Generic.EffectiveVersion = compatibility.DefaultBuildEffectiveVersion()
	completedConfig := c.Generic.Complete()
	server, err := completedConfig.New("grafana-app-sdk", delegate)
	if err != nil {
		return nil, err
	}
	for _, installer := range c.installers {
		err = installer.InstallAPIs(NewKubernetesGenericAPIServer(server), c.Generic.RESTOptionsGetter)
		if err != nil {
			return nil, err
		}
	}
	err = server.AddPostStartHook("app runners", func(context genericapiserver.PostStartHookContext) error {
		runner := app.NewMultiRunner()
		for _, installer := range c.installers {
			installerApp, err := installer.App()
			if err != nil {
				return fmt.Errorf("error getting app on startup: %w", err)
			}
			runner.AddRunnable(installerApp.Runner())
		}
		return runner.Run(context.Context)
	})
	if err != nil {
		return nil, err
	}
	return server, nil
}
