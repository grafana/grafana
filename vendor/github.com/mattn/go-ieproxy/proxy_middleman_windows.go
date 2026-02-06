package ieproxy

import (
	"net/http"
	"net/url"

	"golang.org/x/net/http/httpproxy"
)

func proxyMiddleman() func(req *http.Request) (i *url.URL, e error) {
	// Get the proxy configuration
	conf := GetConf()
	envcfg := httpproxy.FromEnvironment()

	if envcfg.HTTPProxy != "" || envcfg.HTTPSProxy != "" {
		// If the user manually specifies environment variables, prefer those over the Windows config.
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
	prox := httpproxy.Config{
		HTTPSProxy: mapFallback("https", "", conf.Static.Protocols),
		HTTPProxy:  mapFallback("http", "", conf.Static.Protocols),
		NoProxy:    conf.Static.NoProxy,
	}
	return prox.ProxyFunc()(req.URL)
}

// Return oKey or fbKey if oKey doesn't exist in the map.
func mapFallback(oKey, fbKey string, m map[string]string) string {
	if v, ok := m[oKey]; ok {
		return v
	} else {
		return m[fbKey]
	}
}
