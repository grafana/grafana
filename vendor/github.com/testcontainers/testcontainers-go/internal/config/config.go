package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/magiconair/properties"
)

const ReaperDefaultImage = "testcontainers/ryuk:0.11.0"

var (
	tcConfig     Config
	tcConfigOnce = new(sync.Once)
)

// testcontainersConfig {

// Config represents the configuration for Testcontainers.
// User values are read from ~/.testcontainers.properties file which can be overridden
// using the specified environment variables. For more information, see [Custom Configuration].
//
// The Ryuk prefixed fields controls the [Garbage Collector] feature, which ensures that
// resources are cleaned up after the test execution.
//
// [Garbage Collector]: https://golang.testcontainers.org/features/garbage_collector/
// [Custom Configuration]: https://golang.testcontainers.org/features/configuration/
type Config struct {
	// Host is the address of the Docker daemon.
	//
	// Environment variable: DOCKER_HOST
	Host string `properties:"docker.host,default="`

	// TLSVerify is a flag to enable or disable TLS verification when connecting to a Docker daemon.
	//
	// Environment variable: DOCKER_TLS_VERIFY
	TLSVerify int `properties:"docker.tls.verify,default=0"`

	// CertPath is the path to the directory containing the Docker certificates.
	// This is used when connecting to a Docker daemon over TLS.
	//
	// Environment variable: DOCKER_CERT_PATH
	CertPath string `properties:"docker.cert.path,default="`

	// HubImageNamePrefix is the prefix used for the images pulled from the Docker Hub.
	// This is useful when running tests in environments with restricted internet access.
	//
	// Environment variable: TESTCONTAINERS_HUB_IMAGE_NAME_PREFIX
	HubImageNamePrefix string `properties:"hub.image.name.prefix,default="`

	// RyukDisabled is a flag to enable or disable the Garbage Collector.
	// Setting this to true will prevent testcontainers from automatically cleaning up
	// resources, which is particularly important in tests which timeout as they
	// don't run test clean up.
	//
	// Environment variable: TESTCONTAINERS_RYUK_DISABLED
	RyukDisabled bool `properties:"ryuk.disabled,default=false"`

	// RyukPrivileged is a flag to enable or disable the privileged mode for the Garbage Collector container.
	// Setting this to true will run the Garbage Collector container in privileged mode.
	//
	// Environment variable: TESTCONTAINERS_RYUK_CONTAINER_PRIVILEGED
	RyukPrivileged bool `properties:"ryuk.container.privileged,default=false"`

	// RyukReconnectionTimeout is the time to wait before attempting to reconnect to the Garbage Collector container.
	//
	// Environment variable: RYUK_RECONNECTION_TIMEOUT
	RyukReconnectionTimeout time.Duration `properties:"ryuk.reconnection.timeout,default=10s"`

	// RyukConnectionTimeout is the time to wait before timing out when connecting to the Garbage Collector container.
	//
	// Environment variable: RYUK_CONNECTION_TIMEOUT
	RyukConnectionTimeout time.Duration `properties:"ryuk.connection.timeout,default=1m"`

	// RyukVerbose is a flag to enable or disable verbose logging for the Garbage Collector.
	//
	// Environment variable: RYUK_VERBOSE
	RyukVerbose bool `properties:"ryuk.verbose,default=false"`

	// TestcontainersHost is the address of the Testcontainers host.
	//
	// Environment variable: TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE
	TestcontainersHost string `properties:"tc.host,default="`
}

// }

// Read reads from testcontainers properties file, if it exists
// it is possible that certain values get overridden when set as environment variables
func Read() Config {
	tcConfigOnce.Do(func() {
		tcConfig = read()
	})

	return tcConfig
}

// Reset resets the singleton instance of the Config struct,
// allowing to read the configuration again.
// Handy for testing, so do not use it in production code
// This function is not thread-safe
func Reset() {
	tcConfigOnce = new(sync.Once)
}

func read() Config {
	config := Config{}

	applyEnvironmentConfiguration := func(config Config) Config {
		ryukDisabledEnv := os.Getenv("TESTCONTAINERS_RYUK_DISABLED")
		if parseBool(ryukDisabledEnv) {
			config.RyukDisabled = ryukDisabledEnv == "true"
		}

		hubImageNamePrefix := os.Getenv("TESTCONTAINERS_HUB_IMAGE_NAME_PREFIX")
		if hubImageNamePrefix != "" {
			config.HubImageNamePrefix = hubImageNamePrefix
		}

		ryukPrivilegedEnv := os.Getenv("TESTCONTAINERS_RYUK_CONTAINER_PRIVILEGED")
		if parseBool(ryukPrivilegedEnv) {
			config.RyukPrivileged = ryukPrivilegedEnv == "true"
		}

		ryukVerboseEnv := readTestcontainersEnv("RYUK_VERBOSE")
		if parseBool(ryukVerboseEnv) {
			config.RyukVerbose = ryukVerboseEnv == "true"
		}

		ryukReconnectionTimeoutEnv := readTestcontainersEnv("RYUK_RECONNECTION_TIMEOUT")
		if timeout, err := time.ParseDuration(ryukReconnectionTimeoutEnv); err == nil {
			config.RyukReconnectionTimeout = timeout
		}

		ryukConnectionTimeoutEnv := readTestcontainersEnv("RYUK_CONNECTION_TIMEOUT")
		if timeout, err := time.ParseDuration(ryukConnectionTimeoutEnv); err == nil {
			config.RyukConnectionTimeout = timeout
		}

		return config
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return applyEnvironmentConfiguration(config)
	}

	tcProp := filepath.Join(home, ".testcontainers.properties")
	// init from a file
	properties, err := properties.LoadFile(tcProp, properties.UTF8)
	if err != nil {
		return applyEnvironmentConfiguration(config)
	}

	if err := properties.Decode(&config); err != nil {
		fmt.Printf("invalid testcontainers properties file, returning an empty Testcontainers configuration: %v\n", err)
		return applyEnvironmentConfiguration(config)
	}

	return applyEnvironmentConfiguration(config)
}

func parseBool(input string) bool {
	_, err := strconv.ParseBool(input)
	return err == nil
}

// readTestcontainersEnv reads the environment variable with the given name.
// It checks for the environment variable with the given name first, and then
// checks for the environment variable with the given name prefixed with "TESTCONTAINERS_".
func readTestcontainersEnv(envVar string) string {
	value := os.Getenv(envVar)
	if value != "" {
		return value
	}

	// TODO: remove this prefix after the next major release
	const prefix string = "TESTCONTAINERS_"

	return os.Getenv(prefix + envVar)
}
