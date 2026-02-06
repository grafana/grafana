// +build !windows

package mssql

import (
	"github.com/microsoft/go-mssqldb/integratedauth"
	// nolint importing the ntlm package causes it to be registered as an available authentication provider
	_ "github.com/microsoft/go-mssqldb/integratedauth/ntlm"
)

func init() {
	// we set the default authentication provider name here, rather than within each imported package,
	// to force a known default. Go will order execution of init() calls but it is better to be explicit.
	integratedauth.DefaultProviderName = "ntlm"
}
