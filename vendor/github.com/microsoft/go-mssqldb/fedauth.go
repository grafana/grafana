package mssql

import (
	"context"
	"errors"

	"github.com/microsoft/go-mssqldb/msdsn"
)

// Federated authentication library affects the login data structure and message sequence.
const (
	// FedAuthLibraryLiveIDCompactToken specifies the Microsoft Live ID Compact Token authentication scheme
	FedAuthLibraryLiveIDCompactToken = 0x00

	// FedAuthLibrarySecurityToken specifies a token-based authentication where the token is available
	// without additional information provided during the login sequence.
	FedAuthLibrarySecurityToken = 0x01

	// FedAuthLibraryADAL specifies a token-based authentication where a token is obtained during the
	// login sequence using the server SPN and STS URL provided by the server during login.
	FedAuthLibraryADAL = 0x02

	// FedAuthLibraryReserved is used to indicate that no federated authentication scheme applies.
	FedAuthLibraryReserved = 0x7F
)

// Federated authentication ADAL workflow affects the mechanism used to authenticate.
const (
	// FedAuthADALWorkflowPassword uses a username/password to obtain a token from Active Directory
	FedAuthADALWorkflowPassword = 0x01

	// fedAuthADALWorkflowPassword uses the Windows identity to obtain a token from Active Directory
	FedAuthADALWorkflowIntegrated = 0x02

	// FedAuthADALWorkflowMSI uses the managed identity service to obtain a token
	FedAuthADALWorkflowMSI = 0x03

	// FedAuthADALWorkflowNone does not need to obtain token
	FedAuthADALWorkflowNone = 0x04
)

// newSecurityTokenConnector creates a new connector from a Config and a token provider.
// When invoked, token provider implementations should contact the security token
// service specified and obtain the appropriate token, or return an error
// to indicate why a token is not available.
// The returned connector may be used with sql.OpenDB.
func NewSecurityTokenConnector(config msdsn.Config, tokenProvider func(ctx context.Context) (string, error)) (*Connector, error) {
	if tokenProvider == nil {
		return nil, errors.New("mssql: tokenProvider cannot be nil")
	}

	conn := NewConnectorConfig(config)
	conn.fedAuthRequired = true
	conn.fedAuthLibrary = FedAuthLibrarySecurityToken
	conn.securityTokenProvider = tokenProvider

	return conn, nil
}

// newADALTokenConnector creates a new connector from a Config and a Active Directory token provider.
// Token provider implementations are called during federated
// authentication login sequences where the server provides a service
// principal name and security token service endpoint that should be used
// to obtain the token. Implementations should contact the security token
// service specified and obtain the appropriate token, or return an error
// to indicate why a token is not available.
//
// The returned connector may be used with sql.OpenDB.
func NewActiveDirectoryTokenConnector(config msdsn.Config, adalWorkflow byte, tokenProvider func(ctx context.Context, serverSPN, stsURL string) (string, error)) (*Connector, error) {
	if tokenProvider == nil {
		return nil, errors.New("mssql: tokenProvider cannot be nil")
	}

	conn := NewConnectorConfig(config)
	conn.fedAuthRequired = true
	conn.fedAuthLibrary = FedAuthLibraryADAL
	conn.fedAuthADALWorkflow = adalWorkflow
	conn.adalTokenProvider = tokenProvider

	return conn, nil
}
