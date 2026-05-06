package integratedauth

import (
	"github.com/microsoft/go-mssqldb/msdsn"
)

// Provider returns an SSPI compatible authentication provider
type Provider interface {
	// GetIntegratedAuthenticator is responsible for returning an instance of the required IntegratedAuthenticator interface
	GetIntegratedAuthenticator(config msdsn.Config) (IntegratedAuthenticator, error)
}

// IntegratedAuthenticator is the interface for SSPI Login Authentication providers
type IntegratedAuthenticator interface {
	InitialBytes() ([]byte, error)
	NextBytes([]byte) ([]byte, error)
	Free()
}

// ProviderFunc is an adapter to convert a GetIntegratedAuthenticator func into a Provider
type ProviderFunc func(config msdsn.Config) (IntegratedAuthenticator, error)

func (f ProviderFunc) GetIntegratedAuthenticator(config msdsn.Config) (IntegratedAuthenticator, error) {
	return f(config)
}
