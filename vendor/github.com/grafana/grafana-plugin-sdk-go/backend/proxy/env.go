package proxy

import (
	"os"
	"strconv"
	"strings"
)

const (
	// Deprecated: PluginSecureSocksProxyEnabledEnvVarName is a constant for the GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_ENABLED
	// environment variable used to specify if a secure socks proxy is allowed to be used for datasource connections.
	PluginSecureSocksProxyEnabledEnvVarName = "GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_ENABLED"
	// Deprecated: PluginSecureSocksProxyClientCertFilePathEnvVarName is a constant for the GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_CERT
	// environment variable used to specify the file location of the client cert for the secure socks proxy.
	PluginSecureSocksProxyClientCertFilePathEnvVarName = "GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_CERT"
	// Deprecated: PluginSecureSocksProxyClientKeyFilePathEnvVarName is a constant for the GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_KEY
	// environment variable used to specify the file location of the client key for the secure socks proxy.
	PluginSecureSocksProxyClientKeyFilePathEnvVarName = "GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_KEY"
	// Deprecated: PluginSecureSocksProxyRootCACertFilePathsEnvVarName is a constant for the GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT
	// environment variable used to specify the file location of the root ca for the secure socks proxy.
	PluginSecureSocksProxyRootCACertFilePathsEnvVarName = "GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT"
	// Deprecated: PluginSecureSocksProxyAddressEnvVarName is a constant for the GF_SECURE_SOCKS_DATASOURCE_PROXY_PROXY_ADDRESS
	// environment variable used to specify the secure socks proxy server address to proxy the connections to.
	PluginSecureSocksProxyAddressEnvVarName = "GF_SECURE_SOCKS_DATASOURCE_PROXY_PROXY_ADDRESS"
	// Deprecated: PluginSecureSocksProxyServerNameEnvVarName is a constant for the GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_NAME
	// environment variable used to specify the server name of the secure socks proxy.
	PluginSecureSocksProxyServerNameEnvVarName = "GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_NAME"
	// Deprecated: PluginSecureSocksProxyAllowInsecureEnvVarName is a constant for the GF_SECURE_SOCKS_DATASOURCE_PROXY_ALLOW_INSECURE
	// environment variable used to specify if the proxy should use a TLS dialer.
	PluginSecureSocksProxyAllowInsecureEnvVarName = "GF_SECURE_SOCKS_DATASOURCE_PROXY_ALLOW_INSECURE"
)

// Deprecated: clientCfgFromEnv gets the needed proxy information from the env variables that Grafana set with the values from the config ini
func clientCfgFromEnv() *ClientCfg {
	if value, ok := os.LookupEnv(PluginSecureSocksProxyEnabledEnvVarName); ok {
		enabled, err := strconv.ParseBool(value)
		if err != nil || !enabled {
			return nil
		}
	}

	proxyAddress := ""
	if value, ok := os.LookupEnv(PluginSecureSocksProxyAddressEnvVarName); ok {
		proxyAddress = value
	} else {
		return nil
	}

	allowInsecure := false
	if value, ok := os.LookupEnv(PluginSecureSocksProxyAllowInsecureEnvVarName); ok {
		allowInsecure, _ = strconv.ParseBool(value)
	}

	// We only need to fill these fields on insecure mode.
	if allowInsecure {
		return &ClientCfg{
			ProxyAddress:  proxyAddress,
			AllowInsecure: allowInsecure,
		}
	}

	clientCert := ""
	if value, ok := os.LookupEnv(PluginSecureSocksProxyClientCertFilePathEnvVarName); ok {
		certPEMBlock, err := os.ReadFile(value)
		if err != nil {
			return nil
		}
		clientCert = string(certPEMBlock)
	} else {
		return nil
	}

	clientKey := ""
	if value, ok := os.LookupEnv(PluginSecureSocksProxyClientKeyFilePathEnvVarName); ok {
		keyPEMBlock, err := os.ReadFile(value)
		if err != nil {
			return nil
		}
		clientKey = string(keyPEMBlock)
	} else {
		return nil
	}

	var rootCAs []string
	if value, ok := os.LookupEnv(PluginSecureSocksProxyRootCACertFilePathsEnvVarName); ok {
		for _, rootCA := range strings.Split(value, " ") {
			certPEMBlock, err := os.ReadFile(rootCA)
			if err != nil {
				return nil
			}
			rootCAs = append(rootCAs, string(certPEMBlock))
		}
	} else {
		return nil
	}

	serverName := ""
	if value, ok := os.LookupEnv(PluginSecureSocksProxyServerNameEnvVarName); ok {
		serverName = value
	} else {
		return nil
	}

	return &ClientCfg{
		ClientCertVal: clientCert,
		ClientKeyVal:  clientKey,
		RootCAsVals:   rootCAs,
		ProxyAddress:  proxyAddress,
		ServerName:    serverName,
		AllowInsecure: false,
	}
}
