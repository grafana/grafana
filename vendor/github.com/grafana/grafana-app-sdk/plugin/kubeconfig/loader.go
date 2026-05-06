package kubeconfig

import (
	"encoding/base64"
	"errors"
	"hash"
	"hash/crc32"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/grafana/grafana-app-sdk/k8s"
)

var (
	// ErrConfigMissing is the error returned when secureJsonData
	// does not contain serialized kubeconfig value.
	ErrConfigMissing = errors.New("config is missing from secureJsonData")
)

// ConfigLoader loads NamespacedConfig from serialized config and namespace values.
type ConfigLoader interface {
	Load(config, namespace string, dst *NamespacedConfig) error
	LoadFromSettings(set backend.AppInstanceSettings, dst *NamespacedConfig) error
}

// ChecksumLoader is a ConfigLoader that can also compute a CRC32 of serialized values.
type ChecksumLoader interface {
	ConfigLoader
	CRC32(config, namespace string) (uint32, error)
}

// Loader is a ConfigLoader that loads NamespacedConfig
// from serialized config and namespace values.
//
// The loader is safe for concurrent use, but MUST NOT be copied after initialization.
type Loader struct {
	hash hash.Hash32
	lock sync.Mutex
}

// NewLoader returns a new Loader.
func NewLoader() *Loader {
	return &Loader{
		hash: crc32.NewIEEE(),
	}
}

// Load loads the NamespacedConfig into dst.
// An error will be returned upon any failures (e.g. missing or malformed data).
// Load IS NOT guaranteed to clear dst - the caller is responsible for that.
func (c *Loader) Load(config, namespace string, dst *NamespacedConfig) error {
	crc, err := c.CRC32(config, namespace)
	if err != nil {
		return err
	}

	if err := k8s.ValidateNamespace(namespace); err != nil {
		return err
	}

	var cfg *rest.Config
	if config == "cluster" { // A kubeconfig string of "cluster" means use the in-cluster config
		cfg, err = rest.InClusterConfig()
		if err != nil {
			return err
		}
	} else { // Otherwise, we try to load this as a valid kube config file
		ccfg, err := clientcmd.Load([]byte(config))
		if err != nil {
			return err
		}

		// TODO: figure out if we need to switch context and such.
		cfg, err = clientcmd.NewDefaultClientConfig(*ccfg, nil).ClientConfig()
		if err != nil {
			return err
		}
	}

	cfg.APIPath = "/apis"

	dst.CRC32 = crc
	dst.Namespace = namespace
	dst.RestConfig = *cfg

	return nil
}

// LoadFromSettings loads the config from the AppInstanceSettings.
func (c *Loader) LoadFromSettings(set backend.AppInstanceSettings, dst *NamespacedConfig) error {
	cf, ns, err := LoadRawConfig(set.DecryptedSecureJSONData)
	if err != nil {
		return err
	}

	return c.Load(cf, ns, dst)
}

// CRC32 returns the CRC 32 value of config and namespace strings.
func (c *Loader) CRC32(config, namespace string) (uint32, error) {
	c.lock.Lock()
	defer c.lock.Unlock()

	c.hash.Reset()

	if _, err := c.hash.Write([]byte(config)); err != nil {
		return 0, err
	}

	if _, err := c.hash.Write([]byte(namespace)); err != nil {
		return 0, err
	}

	return c.hash.Sum32(), nil
}

// CachingLoader is a ConfigLoader that loads NamespacedConfig
// from serialized config and namespace values
// and caches the result for the next calls.
//
// Caching is done based on a CRC32 of the config.
//
// The loader is safe for concurrent use, but MUST NOT be copied after initialization.
type CachingLoader struct {
	load ChecksumLoader
	stor sync.Map
}

// NewCachingLoader returns a new CachingLoader with an empty cache.
func NewCachingLoader() *CachingLoader {
	return NewCustomCachingLoader(NewLoader())
}

// NewCustomCachingLoader returns a new CachingLoader that uses loader for loading configs.
func NewCustomCachingLoader(loader ChecksumLoader) *CachingLoader {
	return &CachingLoader{
		load: loader,
	}
}

// Load tries to load the Config from the passed values.
// The result will be written to dst and an error will be returned upon any failures (e.g. missing or malformed data).
// Load IS NOT guaranteed to clear dst - the caller is responsible for that.
func (c *CachingLoader) Load(config, namespace string, dst *NamespacedConfig) error {
	crc, err := c.CRC32(config, namespace)
	if err != nil {
		return err
	}

	val, ok := c.stor.Load(crc)
	if ok {
		if res, ok := val.(NamespacedConfig); ok {
			// Only return cached config if it's OK.
			// Otherwise we reload it (e.g. upon corruption).
			*dst = res
			return nil
		}
	}

	if err := c.load.Load(config, namespace, dst); err != nil {
		return err
	}

	// Cache config for future use.
	// Make sure we cache by value, otherwise it can change (because pointers).
	c.stor.Store(crc, *dst)

	return nil
}

// LoadFromSettings loads the config from the AppInstanceSettings.
func (c *CachingLoader) LoadFromSettings(set backend.AppInstanceSettings, dst *NamespacedConfig) error {
	cf, ns, err := LoadRawConfig(set.DecryptedSecureJSONData)
	if err != nil {
		return err
	}

	return c.Load(cf, ns, dst)
}

// CRC32 returns the CRC 32 value of config and namespace strings.
func (c *CachingLoader) CRC32(config, namespace string) (uint32, error) {
	return c.load.CRC32(config, namespace)
}

const (
	// KeyConfig is the key in secureJsonData used for looking up kubeconfig.
	KeyConfig = "kubeconfig"

	// KeyNamespace is the key in secureJsonData used for looking up kube namespace.
	KeyNamespace = "kubenamespace"
)

// LoadRawConfig loads raw config data from decrypted secureJsonData.
func LoadRawConfig(src map[string]string) (cfg string, ns string, err error) {
	cval, ok := src[KeyConfig]
	if !ok {
		return "", "", ErrConfigMissing
	}

	nval, ok := src[KeyNamespace]
	if !ok {
		return "", "", ErrConfigMissing
	}

	// AppInstallation controller uses standard base64 encoding for setting kubeconfig / namespace values,
	// so we try to decode them here and if it fails we fall back gracefully to unencoded values.
	if dec, err := base64.StdEncoding.DecodeString(cval); err == nil {
		cval = string(dec)
	}

	if dec, err := base64.StdEncoding.DecodeString(nval); err == nil {
		nval = strings.TrimSpace(string(dec))
	}

	return cval, nval, nil
}
