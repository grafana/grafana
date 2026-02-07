package integratedauth

import (
	"errors"
	"fmt"

	"github.com/microsoft/go-mssqldb/msdsn"
)

var (
	providers           map[string]Provider
	DefaultProviderName string

	ErrProviderCannotBeNil         = errors.New("provider cannot be nil")
	ErrProviderNameMustBePopulated = errors.New("provider name must be populated")
)

func init() {
	providers = make(map[string]Provider)
}

// GetIntegratedAuthenticator calls the authProvider specified in the 'authenticator' connection string parameter, if supplied.
// Otherwise fails back to the DefaultProviderName implementation for the platform.
func GetIntegratedAuthenticator(config msdsn.Config) (IntegratedAuthenticator, error) {
	authenticatorName, ok := config.Parameters["authenticator"]
	if !ok {
		provider, err := getProvider(DefaultProviderName)
		if err != nil {
			return nil, err
		}

		p, err := provider.GetIntegratedAuthenticator(config)
		// we ignore the error in this case to force a fallback to sqlserver authentication.
		// this preserves the original behaviour
		if err != nil {
			return nil, nil
		}

		return p, nil
	}

	provider, err := getProvider(authenticatorName)
	if err != nil {
		return nil, err
	}

	return provider.GetIntegratedAuthenticator(config)
}

func getProvider(name string) (Provider, error) {
	provider, ok := providers[name]

	if !ok {
		return nil, fmt.Errorf("provider %v not found", name)
	}

	return provider, nil
}

// SetIntegratedAuthenticationProvider stores a named authentication provider. It should be called before any connections are created.
func SetIntegratedAuthenticationProvider(providerName string, p Provider) error {
	if p == nil {
		return ErrProviderCannotBeNil
	}

	if providerName == "" {
		return ErrProviderNameMustBePopulated
	}

	providers[providerName] = p

	return nil
}
