package schema

func V0ProxyConfigOptions() []Field {
	return []Field{
		{
			Label:        "Proxy URL",
			Description:  "HTTP proxy server to use to connect to the targets.",
			Element:      ElementTypeInput,
			InputType:    InputTypeText,
			PropertyName: "proxy_url",
		},
		{
			Label:        "No Proxy",
			Description:  "Comma-separated list of domains for which the proxy should not be used.",
			Element:      ElementTypeInput,
			InputType:    InputTypeText,
			PropertyName: "no_proxy",
		},
		{
			Label:        "Proxy From Environment",
			Description:  "Makes use of net/http ProxyFromEnvironment function to determine proxies.",
			Element:      ElementTypeCheckbox,
			PropertyName: "proxy_from_environment",
		},
		{
			Label:        "Proxy Header Environment",
			Description:  "Headers to send to proxies during CONNECT requests.",
			Element:      ElementTypeKeyValueMap,
			PropertyName: "proxy_connect_header",
		},
	}
}

func V0TLSConfigOption(propertyName string) Field {
	return Field{
		Label:        "TLS config",
		Description:  "Configures the TLS settings.",
		PropertyName: propertyName,
		Element:      ElementTypeSubform,
		SubformOptions: []Field{
			{
				Label:        "Server name",
				Description:  "ServerName extension to indicate the name of the server.",
				Element:      ElementTypeInput,
				InputType:    InputTypeText,
				PropertyName: "server_name",
			},
			{
				Label:        "Skip verify",
				Description:  "Disable validation of the server certificate.",
				Element:      ElementTypeCheckbox,
				PropertyName: "insecure_skip_verify",
			},
			{
				Label:        "Min TLS Version",
				Element:      ElementTypeInput,
				InputType:    InputTypeText,
				PropertyName: "min_version",
			},
			{
				Label:        "Max TLS Version",
				Element:      ElementTypeInput,
				InputType:    InputTypeText,
				PropertyName: "max_version",
			},
		},
	}
}

func V0HttpConfigOption() Field {
	oauth2ConfigOption := func() Field {
		return Field{
			Label:        "OAuth2",
			Description:  "Configures the OAuth2 settings.",
			PropertyName: "oauth2",
			Element:      ElementTypeSubform,
			SubformOptions: []Field{
				{
					Label:        "Client ID",
					Description:  "The OAuth2 client ID",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "client_id",
					Required:     true,
				},
				{
					Label:        "Client secret",
					Description:  "The OAuth2 client secret",
					Element:      ElementTypeInput,
					InputType:    InputTypePassword,
					PropertyName: "client_secret",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Token URL",
					Description:  "The OAuth2 token exchange URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "token_url",
					Required:     true,
				},
				{
					Label:        "Scopes",
					Description:  "Comma-separated list of scopes",
					Element:      ElementStringArray,
					PropertyName: "scopes",
				},
				{
					Label:        "Additional parameters",
					Element:      ElementTypeKeyValueMap,
					PropertyName: "endpoint_params",
				},
				V0TLSConfigOption("TLSConfig"),
			},
		}
	}
	return Field{
		Label:        "HTTP Config",
		Description:  "Note that `basic_auth` and `bearer_token` options are mutually exclusive.",
		PropertyName: "http_config",
		Element:      ElementTypeSubform,
		SubformOptions: append([]Field{
			{
				Label:        "Basic auth",
				Description:  "Sets the `Authorization` header with the configured username and password.",
				PropertyName: "basic_auth",
				Element:      ElementTypeSubform,
				SubformOptions: []Field{
					{
						Label:        "Username",
						Element:      ElementTypeInput,
						InputType:    InputTypeText,
						PropertyName: "username",
					},
					{
						Label:        "Password",
						Element:      ElementTypeInput,
						InputType:    InputTypePassword,
						PropertyName: "password",
						Secure:       true,
					},
				},
			},
			{
				Label:        "Authorization",
				Description:  "The HTTP authorization credentials for the targets.",
				Element:      ElementTypeSubform,
				PropertyName: "authorization",
				SubformOptions: []Field{
					{
						Label:        "Type",
						Element:      ElementTypeInput,
						InputType:    InputTypeText,
						PropertyName: "type",
					},
					{
						Label:        "Credentials",
						Element:      ElementTypeInput,
						InputType:    InputTypePassword,
						PropertyName: "credentials",
						Secure:       true,
					},
				},
			},
			{
				Label:        "Follow redirects",
				Description:  "Whether the client should follow HTTP 3xx redirects.",
				Element:      ElementTypeCheckbox,
				PropertyName: "follow_redirects",
			},
			{
				Label:        "Enable HTTP2",
				Description:  "Whether the client should configure HTTP2.",
				Element:      ElementTypeCheckbox,
				PropertyName: "enable_http2",
			},
			{
				Label:        "HTTP Headers",
				Description:  "Headers to inject in the requests.",
				Element:      ElementTypeKeyValueMap,
				PropertyName: "http_headers",
			},
		}, append(
			V0ProxyConfigOptions(),
			V0TLSConfigOption("tls_config"),
			oauth2ConfigOption())...,
		),
	}
}

func V1TLSSubformOptions() []Field {
	return []Field{
		{
			Label:        "Disable certificate verification",
			Element:      ElementTypeCheckbox,
			Description:  "Do not verify the server's certificate chain and host name.",
			PropertyName: "insecureSkipVerify",
			Required:     false,
		},
		{
			Label:        "CA Certificate",
			Element:      ElementTypeTextArea,
			Description:  "Certificate in PEM format to use when verifying the server's certificate chain.",
			InputType:    InputTypeText,
			PropertyName: "caCertificate",
			Required:     false,
			Secure:       true,
		},
		{
			Label:        "Client Certificate",
			Element:      ElementTypeTextArea,
			Description:  "Client certificate in PEM format to use when connecting to the server.",
			InputType:    InputTypeText,
			PropertyName: "clientCertificate",
			Required:     false,
			Secure:       true,
		},
		{
			Label:        "Client Key",
			Element:      ElementTypeTextArea,
			Description:  "Client key in PEM format to use when connecting to the server.",
			InputType:    InputTypeText,
			PropertyName: "clientKey",
			Required:     false,
			Secure:       true,
		},
	}
}

func V1ProxyOption() Field {
	return Field{ // New in 12.1.
		Label:        "Proxy Config",
		PropertyName: "proxy_config",
		Description:  "Optional proxy configuration.",
		Element:      ElementTypeSubform,
		SubformOptions: []Field{
			{
				Label:        "Proxy URL",
				PropertyName: "proxy_url",
				Description:  "HTTP proxy server to use to connect to the targets.",
				Element:      ElementTypeInput,
				InputType:    InputTypeText,
				Placeholder:  "https://proxy.example.com",
				Required:     false,
				Secure:       false,
				Protected:    true,
			},
			{
				Label:        "Proxy from environment",
				PropertyName: "proxy_from_environment",
				Description:  "Use environment HTTP_PROXY, HTTPS_PROXY and NO_PROXY to determine proxies.",
				Element:      ElementTypeCheckbox,
				Required:     false,
				Secure:       false,
			},
			{
				Label:        "No Proxy",
				PropertyName: "no_proxy",
				Description:  "Comma-separated list of addresses that should not use a proxy.",
				Element:      ElementTypeInput,
				InputType:    InputTypeText,
				Placeholder:  "example.com,1.2.3.4",
				Required:     false,
				Secure:       false,
			},
			{
				Label:        "Proxy Connect Header",
				PropertyName: "proxy_connect_header",
				Description:  "Optional headers to send to proxies during CONNECT requests.",
				Element:      ElementTypeKeyValueMap,
				InputType:    InputTypeText,
				Required:     false,
				Secure:       false,
			},
		},
	}
}

func V1HttpClientOption() Field {
	return Field{ // New in 12.1.
		Label:        "HTTP Config",
		PropertyName: "http_config",
		Description:  "Common HTTP client options.",
		Element:      ElementTypeSubform,
		SubformOptions: []Field{
			{ // New in 12.1.
				Label:        "OAuth2",
				PropertyName: "oauth2",
				Description:  "OAuth2 configuration options",
				Element:      ElementTypeSubform,
				SubformOptions: []Field{
					{
						Label:        "Token URL",
						PropertyName: "token_url",
						Element:      ElementTypeInput,
						Description:  "URL for the access token endpoint.",
						InputType:    InputTypeText,
						Required:     true,
						Secure:       false,
						Protected:    true,
					},
					{
						Label:        "Client ID",
						PropertyName: "client_id",
						Element:      ElementTypeInput,
						Description:  "Client ID to use when authenticating.",
						InputType:    InputTypeText,
						Required:     true,
						Secure:       false,
					},
					{
						Label:        "Client Secret",
						PropertyName: "client_secret",
						Element:      ElementTypeInput,
						Description:  "Client secret to use when authenticating.",
						InputType:    InputTypeText,
						Required:     true,
						Secure:       true,
					},
					{
						Label:        "Scopes",
						PropertyName: "scopes",
						Element:      ElementStringArray,
						Description:  "Optional scopes to request when obtaining an access token.",
						Required:     false,
						Secure:       false,
					},
					{
						Label:        "Endpoint Parameters",
						PropertyName: "endpoint_params",
						Element:      ElementTypeKeyValueMap,
						Description:  "Optional parameters to append to the access token request.",
						Required:     false,
						Secure:       false,
					},
					{
						Label:          "TLS",
						PropertyName:   "tls_config",
						Description:    "Optional TLS configuration options for OAuth2 requests.",
						Element:        ElementTypeSubform,
						SubformOptions: V1TLSSubformOptions(),
					},
					V1ProxyOption(),
				},
			},
		},
	}
}
