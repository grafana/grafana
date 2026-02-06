package backend

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// HTTPSettings is a convenient struct for holding decoded HTTP settings from
// jsonData and secureJSONData.
type HTTPSettings struct {
	Access            string
	URL               string
	BasicAuthEnabled  bool
	BasicAuthUser     string
	BasicAuthPassword string
	Header            http.Header

	Timeout               time.Duration
	DialTimeout           time.Duration
	KeepAlive             time.Duration
	TLSHandshakeTimeout   time.Duration
	ExpectContinueTimeout time.Duration
	MaxConnsPerHost       int
	MaxIdleConns          int
	MaxIdleConnsPerHost   int
	IdleConnTimeout       time.Duration

	TLSClientAuth     bool
	TLSAuthWithCACert bool
	TLSSkipVerify     bool
	TLSServerName     string
	TLSCACert         string
	TLSClientCert     string
	TLSClientKey      string

	SigV4Auth          bool
	SigV4Region        string
	SigV4AssumeRoleARN string
	SigV4AuthType      string
	SigV4ExternalID    string
	SigV4Profile       string
	SigV4AccessKey     string
	SigV4SecretKey     string
	SigV4SessionToken  string

	JSONData       map[string]interface{}
	SecureJSONData map[string]string
}

// HTTPClientOptions creates and returns httpclient.Options.
func (s *HTTPSettings) HTTPClientOptions() httpclient.Options {
	opts := httpclient.Options{
		Header:        s.Header,
		Labels:        map[string]string{},
		CustomOptions: map[string]interface{}{},
	}

	opts.Timeouts = &httpclient.TimeoutOptions{
		Timeout:               s.Timeout,
		DialTimeout:           s.DialTimeout,
		KeepAlive:             s.KeepAlive,
		TLSHandshakeTimeout:   s.TLSHandshakeTimeout,
		ExpectContinueTimeout: s.ExpectContinueTimeout,
		MaxConnsPerHost:       s.MaxConnsPerHost,
		MaxIdleConns:          s.MaxIdleConns,
		MaxIdleConnsPerHost:   s.MaxIdleConnsPerHost,
		IdleConnTimeout:       s.IdleConnTimeout,
	}

	if s.BasicAuthEnabled {
		opts.BasicAuth = &httpclient.BasicAuthOptions{
			User:     s.BasicAuthUser,
			Password: s.BasicAuthPassword,
		}
	}

	if s.TLSClientAuth || s.TLSAuthWithCACert || s.TLSSkipVerify {
		opts.TLS = &httpclient.TLSOptions{
			CACertificate:      s.TLSCACert,
			ClientCertificate:  s.TLSClientCert,
			ClientKey:          s.TLSClientKey,
			InsecureSkipVerify: s.TLSSkipVerify,
			ServerName:         s.TLSServerName,
		}
	}

	if s.SigV4Auth {
		opts.SigV4 = &httpclient.SigV4Config{
			AuthType:      s.SigV4AuthType,
			Profile:       s.SigV4Profile,
			AccessKey:     s.SigV4AccessKey,
			SecretKey:     s.SigV4SecretKey,
			SessionToken:  s.SigV4SessionToken,
			AssumeRoleARN: s.SigV4AssumeRoleARN,
			ExternalID:    s.SigV4ExternalID,
			Region:        s.SigV4Region,
		}
	}

	return opts
}

//gocyclo:ignore
func parseHTTPSettings(jsonData json.RawMessage, secureJSONData map[string]string) (*HTTPSettings, error) {
	s := &HTTPSettings{
		Header: http.Header{},
	}

	var dat map[string]interface{}
	if jsonData != nil {
		if err := json.Unmarshal(jsonData, &dat); err != nil {
			return nil, err
		}
	}

	if v, exists := dat["access"]; exists {
		s.Access = v.(string)
	} else {
		s.Access = "proxy"
	}

	if v, exists := dat["url"]; exists {
		s.URL = v.(string)
	}

	// Basic auth
	if v, exists := dat["basicAuth"]; exists {
		if basicAuth, ok := v.(bool); ok {
			s.BasicAuthEnabled = basicAuth
		}
	}
	if s.BasicAuthEnabled {
		if v, exists := dat["basicAuthUser"]; exists {
			s.BasicAuthUser = v.(string)
		}
		if v, exists := secureJSONData["basicAuthPassword"]; exists {
			s.BasicAuthPassword = v
		}
	}

	// Timeouts
	if v, exists := dat["timeout"]; exists {
		if iv, ok := v.(float64); ok {
			s.Timeout = time.Duration(iv) * time.Second
		}
	} else {
		s.Timeout = httpclient.DefaultTimeoutOptions.Timeout
	}

	if v, exists := dat["dialTimeout"]; exists {
		if iv, ok := v.(float64); ok {
			s.DialTimeout = time.Duration(iv) * time.Second
		}
	} else {
		s.DialTimeout = httpclient.DefaultTimeoutOptions.DialTimeout
	}

	if v, exists := dat["httpKeepAlive"]; exists {
		if iv, ok := v.(float64); ok {
			s.KeepAlive = time.Duration(iv) * time.Second
		}
	} else {
		s.KeepAlive = httpclient.DefaultTimeoutOptions.KeepAlive
	}

	if v, exists := dat["httpTLSHandshakeTimeout"]; exists {
		if iv, ok := v.(float64); ok {
			s.TLSHandshakeTimeout = time.Duration(iv) * time.Second
		}
	} else {
		s.TLSHandshakeTimeout = httpclient.DefaultTimeoutOptions.TLSHandshakeTimeout
	}

	if v, exists := dat["httpExpectContinueTimeout"]; exists {
		if iv, ok := v.(float64); ok {
			s.ExpectContinueTimeout = time.Duration(iv) * time.Second
		}
	} else {
		s.ExpectContinueTimeout = httpclient.DefaultTimeoutOptions.ExpectContinueTimeout
	}

	if v, exists := dat["httpMaxConnsPerHost"]; exists {
		if iv, ok := v.(float64); ok {
			s.MaxConnsPerHost = int(iv)
		}
	} else {
		s.MaxConnsPerHost = httpclient.DefaultTimeoutOptions.MaxConnsPerHost
	}

	if v, exists := dat["httpMaxIdleConns"]; exists {
		if iv, ok := v.(float64); ok {
			s.MaxIdleConns = int(iv)
		}
	} else {
		s.MaxIdleConns = httpclient.DefaultTimeoutOptions.MaxIdleConns
	}

	if v, exists := dat["httpMaxIdleConnsPerHost"]; exists {
		if iv, ok := v.(float64); ok {
			s.MaxIdleConnsPerHost = int(iv)
		}
	} else {
		s.MaxIdleConnsPerHost = httpclient.DefaultTimeoutOptions.MaxIdleConnsPerHost
	}

	if v, exists := dat["httpIdleConnTimeout"]; exists {
		if iv, ok := v.(float64); ok {
			s.IdleConnTimeout = time.Duration(iv) * time.Second
		}
	} else {
		s.IdleConnTimeout = httpclient.DefaultTimeoutOptions.IdleConnTimeout
	}

	// TLS
	if v, exists := dat["tlsAuth"]; exists {
		if tlsClientAuth, ok := v.(bool); ok {
			s.TLSClientAuth = tlsClientAuth
		}
	}
	if v, exists := dat["tlsAuthWithCACert"]; exists {
		if tslAuthCert, ok := v.(bool); ok {
			s.TLSAuthWithCACert = tslAuthCert
		}
	}
	if v, exists := dat["tlsSkipVerify"]; exists {
		if tlsSkipVerify, ok := v.(bool); ok {
			s.TLSSkipVerify = tlsSkipVerify
		}
	}

	if s.TLSClientAuth || s.TLSAuthWithCACert {
		if v, exists := dat["serverName"]; exists {
			s.TLSServerName = v.(string)
		}
		if v, exists := secureJSONData["tlsCACert"]; exists {
			s.TLSCACert = v
		}
		if v, exists := secureJSONData["tlsClientCert"]; exists {
			s.TLSClientCert = v
		}
		if v, exists := secureJSONData["tlsClientKey"]; exists {
			s.TLSClientKey = v
		}
	}

	// SigV4
	if v, exists := dat["sigV4Auth"]; exists {
		if sigV4Auth, ok := v.(bool); ok {
			s.SigV4Auth = sigV4Auth
		}
	}

	if s.SigV4Auth {
		if v, exists := dat["sigV4Region"]; exists {
			s.SigV4Region = v.(string)
		}
		if v, exists := dat["sigV4AssumeRoleArn"]; exists {
			s.SigV4AssumeRoleARN = v.(string)
		}
		if v, exists := dat["sigV4AuthType"]; exists {
			s.SigV4AuthType = v.(string)
		}
		if v, exists := dat["sigV4ExternalId"]; exists {
			s.SigV4ExternalID = v.(string)
		}
		if v, exists := dat["sigV4Profile"]; exists {
			s.SigV4Profile = v.(string)
		}
		if v, exists := secureJSONData["sigV4AccessKey"]; exists {
			s.SigV4AccessKey = v
		}
		if v, exists := secureJSONData["sigV4SecretKey"]; exists {
			s.SigV4SecretKey = v
		}
		if v, exists := secureJSONData["sigV4SessionToken"]; exists {
			s.SigV4SessionToken = v
		}
	}

	// headers
	index := 1
	for {
		headerNameSuffix := fmt.Sprintf("httpHeaderName%d", index)
		headerValueSuffix := fmt.Sprintf("httpHeaderValue%d", index)

		if key, exists := dat[headerNameSuffix]; exists {
			if value, exists := secureJSONData[headerValueSuffix]; exists {
				s.Header.Add(key.(string), value)
			}
		} else {
			// No (more) header values are available
			break
		}
		index++
	}

	s.JSONData = dat
	s.SecureJSONData = secureJSONData

	return s, nil
}
