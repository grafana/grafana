package apiserver

import (
	"fmt"
	"time"

	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericoptions "k8s.io/apiserver/pkg/server/options"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/rest"
)

type Options struct {
	RecommendedOptions *genericoptions.RecommendedOptions
	scheme             *runtime.Scheme
	codecs             serializer.CodecFactory
	installers         []AppInstaller
}

var defaultEtcdPathPrefix = "/registry/grafana.app"

func NewOptions(installers []AppInstaller) *Options {
	scheme := newScheme()
	codecs := serializer.NewCodecFactory(scheme)

	gvs := []schema.GroupVersion{}
	for _, installer := range installers {
		gvs = append(gvs, installer.GroupVersions()...)
	}

	return &Options{
		scheme:             scheme,
		codecs:             codecs,
		RecommendedOptions: genericoptions.NewRecommendedOptions(defaultEtcdPathPrefix, codecs.LegacyCodec(gvs...)),
		installers:         installers,
	}
}

func (o *Options) AddFlags(fs *pflag.FlagSet) {
	o.RecommendedOptions.AddFlags(fs)
}

func (o *Options) Validate() error {
	errs := []error{}
	errs = append(errs, o.RecommendedOptions.Validate()...)
	return utilerrors.NewAggregate(errs)
}

func (o *Options) ApplyTo(cfg *Config) error {
	// Ensure the config's scheme matches the options' scheme. Otherwise there can be problems with codecs
	cfg.scheme = o.scheme
	cfg.codecs = o.codecs
	if err := cfg.addToScheme(); err != nil {
		return err
	}

	for _, installer := range o.installers {
		md := installer.ManifestData()
		if md == nil {
			return fmt.Errorf("manifest is not initialized for installer for GroupVersions %v", installer.GroupVersions())
		}
		pluginName := md.AppName + " admission"
		plugin := installer.AdmissionPlugin()
		if plugin != nil {
			o.RecommendedOptions.Admission.Plugins.Register(pluginName, plugin)
			o.RecommendedOptions.Admission.RecommendedPluginOrder = append(o.RecommendedOptions.Admission.RecommendedPluginOrder, pluginName)
			o.RecommendedOptions.Admission.EnablePlugins = append(o.RecommendedOptions.Admission.EnablePlugins, pluginName)
		}
	}

	if o.RecommendedOptions.CoreAPI == nil {
		cs := &fake.Clientset{}
		sf := informers.NewSharedInformerFactory(cs, time.Duration(1)*time.Second)
		cfg.Generic.SharedInformerFactory = sf
		cfg.Generic.ClientConfig = &rest.Config{}
	}

	if err := o.RecommendedOptions.ApplyTo(cfg.Generic); err != nil {
		return err
	}

	cfg.UpdateOpenAPIConfig()

	return nil
}

// Config creates a config
func (o *Options) Config() (*Config, error) {
	cfg := &Config{
		Generic:    genericapiserver.NewRecommendedConfig(o.codecs),
		scheme:     o.scheme,
		codecs:     o.codecs,
		installers: o.installers,
	}

	if err := o.ApplyTo(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}
