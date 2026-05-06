//go:build !ios && !iossimulator
// +build !ios,!iossimulator

package ieproxy

import (
	"net/http"
	"net/url"

	"golang.org/x/net/http/httpproxy"
)

func proxyMiddleman() func(req *http.Request) (i *url.URL, e error) {
	// Get the proxy configuration
	conf := GetConf()
	envCfg := httpproxy.FromEnvironment()

	if envCfg.HTTPProxy != "" || envCfg.HTTPSProxy != "" {
		// If the user manually specifies environment variables, prefer those over the MacOS config.
		return http.ProxyFromEnvironment
	}

	return func(req *http.Request) (i *url.URL, e error) {
		if conf.Automatic.Active {
			host := conf.Automatic.FindProxyForURL(req.URL.String())
			if host != "" {
				return &url.URL{Host: host}, nil
			}
		}
		if conf.Static.Active {
			return staticProxy(conf, req)
		}
		// Should return no proxy; fallthrough.
		return http.ProxyFromEnvironment(req)
	}
}

func staticProxy(conf ProxyConf, req *http.Request) (i *url.URL, e error) {
	// If static proxy obtaining is specified
	proxy := httpproxy.Config{
		HTTPSProxy: conf.Static.Protocols["https"],
		HTTPProxy:  conf.Static.Protocols["http"],
		NoProxy:    conf.Static.NoProxy,
	}
	return proxy.ProxyFunc()(req.URL)
}
