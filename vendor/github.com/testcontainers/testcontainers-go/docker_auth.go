package testcontainers

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"sync"

	"github.com/cpuguy83/dockercfg"
	"github.com/docker/docker/api/types/registry"

	"github.com/testcontainers/testcontainers-go/internal/core"
)

// defaultRegistryFn is variable overwritten in tests to check for behaviour with different default values.
var defaultRegistryFn = defaultRegistry

// getRegistryCredentials is a variable overwritten in tests to mock the dockercfg.GetRegistryCredentials function.
var getRegistryCredentials = dockercfg.GetRegistryCredentials

// DockerImageAuth returns the auth config for the given Docker image, extracting first its Docker registry.
// Finally, it will use the credential helpers to extract the information from the docker config file
// for that registry, if it exists.
func DockerImageAuth(ctx context.Context, image string) (string, registry.AuthConfig, error) {
	configs, err := getDockerAuthConfigs()
	if err != nil {
		reg := core.ExtractRegistry(image, defaultRegistryFn(ctx))
		return reg, registry.AuthConfig{}, err
	}

	return dockerImageAuth(ctx, image, configs)
}

// dockerImageAuth returns the auth config for the given Docker image.
func dockerImageAuth(ctx context.Context, image string, configs map[string]registry.AuthConfig) (string, registry.AuthConfig, error) {
	defaultRegistry := defaultRegistryFn(ctx)
	reg := core.ExtractRegistry(image, defaultRegistry)

	if cfg, ok := getRegistryAuth(reg, configs); ok {
		return reg, cfg, nil
	}

	return reg, registry.AuthConfig{}, dockercfg.ErrCredentialsNotFound
}

func getRegistryAuth(reg string, cfgs map[string]registry.AuthConfig) (registry.AuthConfig, bool) {
	if cfg, ok := cfgs[reg]; ok {
		return cfg, true
	}

	// fallback match using authentication key host
	for k, cfg := range cfgs {
		keyURL, err := url.Parse(k)
		if err != nil {
			continue
		}

		host := keyURL.Host
		if keyURL.Scheme == "" {
			// url.Parse: The url may be relative (a path, without a host) [...]
			host = keyURL.Path
		}

		if host == reg {
			return cfg, true
		}
	}

	return registry.AuthConfig{}, false
}

// defaultRegistry returns the default registry to use when pulling images
// It will use the docker daemon to get the default registry, returning "https://index.docker.io/v1/" if
// it fails to get the information from the daemon
func defaultRegistry(ctx context.Context) string {
	client, err := NewDockerClientWithOpts(ctx)
	if err != nil {
		return core.IndexDockerIO
	}
	defer client.Close()

	info, err := client.Info(ctx)
	if err != nil {
		return core.IndexDockerIO
	}

	return info.IndexServerAddress
}

// authConfigResult is a result looking up auth details for key.
type authConfigResult struct {
	key string
	cfg registry.AuthConfig
	err error
}

// credentialsCache is a cache for registry credentials.
type credentialsCache struct {
	entries map[string]credentials
	mtx     sync.RWMutex
}

// credentials represents the username and password for a registry.
type credentials struct {
	username string
	password string
}

var creds = &credentialsCache{entries: map[string]credentials{}}

// AuthConfig updates the details in authConfig for the given hostname
// as determined by the details in configKey.
func (c *credentialsCache) AuthConfig(hostname, configKey string, authConfig *registry.AuthConfig) error {
	u, p, err := creds.get(hostname, configKey)
	if err != nil {
		return err
	}

	if u != "" {
		authConfig.Username = u
		authConfig.Password = p
	} else {
		authConfig.IdentityToken = p
	}

	return nil
}

// get returns the username and password for the given hostname
// as determined by the details in configPath.
// If the username is empty, the password is an identity token.
func (c *credentialsCache) get(hostname, configKey string) (string, string, error) {
	key := configKey + ":" + hostname
	c.mtx.RLock()
	entry, ok := c.entries[key]
	c.mtx.RUnlock()

	if ok {
		return entry.username, entry.password, nil
	}

	// No entry found, request and cache.
	user, password, err := getRegistryCredentials(hostname)
	if err != nil {
		return "", "", fmt.Errorf("getting credentials for %s: %w", hostname, err)
	}

	c.mtx.Lock()
	c.entries[key] = credentials{username: user, password: password}
	c.mtx.Unlock()

	return user, password, nil
}

// configKey returns a key to use for caching credentials based on
// the contents of the currently active config.
func configKey(cfg *dockercfg.Config) (string, error) {
	h := md5.New()
	if err := json.NewEncoder(h).Encode(cfg); err != nil {
		return "", fmt.Errorf("encode config: %w", err)
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

// getDockerAuthConfigs returns a map with the auth configs from the docker config file
// using the registry as the key
func getDockerAuthConfigs() (map[string]registry.AuthConfig, error) {
	cfg, err := getDockerConfig()
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return map[string]registry.AuthConfig{}, nil
		}

		return nil, err
	}

	key, err := configKey(cfg)
	if err != nil {
		return nil, err
	}

	size := len(cfg.AuthConfigs) + len(cfg.CredentialHelpers)
	cfgs := make(map[string]registry.AuthConfig, size)
	results := make(chan authConfigResult, size)
	var wg sync.WaitGroup
	wg.Add(size)
	for k, v := range cfg.AuthConfigs {
		go func(k string, v dockercfg.AuthConfig) {
			defer wg.Done()

			ac := registry.AuthConfig{
				Auth:          v.Auth,
				Email:         v.Email,
				IdentityToken: v.IdentityToken,
				Password:      v.Password,
				RegistryToken: v.RegistryToken,
				ServerAddress: v.ServerAddress,
				Username:      v.Username,
			}

			switch {
			case ac.Username == "" && ac.Password == "":
				// Look up credentials from the credential store.
				if err := creds.AuthConfig(k, key, &ac); err != nil {
					results <- authConfigResult{err: err}
					return
				}
			case ac.Auth == "":
				// Create auth from the username and password encoding.
				ac.Auth = base64.StdEncoding.EncodeToString([]byte(ac.Username + ":" + ac.Password))
			}

			results <- authConfigResult{key: k, cfg: ac}
		}(k, v)
	}

	// In the case where the auth field in the .docker/conf.json is empty, and the user has
	// credential helpers registered the auth comes from there.
	for k := range cfg.CredentialHelpers {
		go func(k string) {
			defer wg.Done()

			var ac registry.AuthConfig
			if err := creds.AuthConfig(k, key, &ac); err != nil {
				results <- authConfigResult{err: err}
				return
			}

			results <- authConfigResult{key: k, cfg: ac}
		}(k)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var errs []error
	for result := range results {
		if result.err != nil {
			errs = append(errs, result.err)
			continue
		}

		cfgs[result.key] = result.cfg
	}

	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}

	return cfgs, nil
}

// getDockerConfig returns the docker config file. It will internally check, in this particular order:
// 1. the DOCKER_AUTH_CONFIG environment variable, unmarshalling it into a dockercfg.Config
// 2. the DOCKER_CONFIG environment variable, as the path to the config file
// 3. else it will load the default config file, which is ~/.docker/config.json
func getDockerConfig() (*dockercfg.Config, error) {
	if env := os.Getenv("DOCKER_AUTH_CONFIG"); env != "" {
		var cfg dockercfg.Config
		if err := json.Unmarshal([]byte(env), &cfg); err != nil {
			return nil, fmt.Errorf("unmarshal DOCKER_AUTH_CONFIG: %w", err)
		}

		return &cfg, nil
	}

	cfg, err := dockercfg.LoadDefaultConfig()
	if err != nil {
		return nil, fmt.Errorf("load default config: %w", err)
	}

	return &cfg, nil
}
