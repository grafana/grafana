# E2E HTTP Fixture Proxy  <!-- omit in toc -->

![Proxy](proxy.png)

The goal of the proxy is to provide a way to record and replay HTTP interactions between a data source backend and the target API. The use of recorded fixtures makes testing infrastructure simpler, and the stability of response data makes it easier to achieve deterministic tests.

- [Quick Setup](#quick-setup)
- [CA Certificate Setup](#ca-certificate-setup)
	- [Debian & Ubuntu](#debian--ubuntu)
	- [MacOS](#macos)
- [Config File](#config-file)
	- [address](#address)
	- [hosts](#hosts)
	- [storage](#storage)
	- [ca_keypair](#ca_keypair)
- [Mage Commands](#mage-commands)
	- [Append mode](#append-mode)
	- [Overwrite mode](#overwrite-mode)
	- [Replay mode](#replay-mode)
	- [CA Certificate](#ca-certificate)
- [Reviewing Recorded Traffic](#reviewing-recorded-traffic)
- [Modifying Default Behavior](#modifying-default-behavior)

## Quick Setup

1. Create a `proxy.json` config file in the root of your plugin repo and replace `example.com` with the `host` or `host:port` of the API you wish to capture:

```json
{
	"storage": [{
		"type": "har",
		"path": "fixtures/e2e.har"
	}],
	"address": "127.0.0.1:9999",
	"hosts": ["example.com"]
}
```

2. Add the proxy's CA certificate to your environment ([instructions](#ca-certificate-setup)).

3. Start proxy using one of the [commands listed below](#mage-commands). For example:

```
mage e2e:append
```

4. Point Grafana at the proxy by exporting the `HTTP_PROXY` and `HTTPS_PROXY` environment variables:

```
export HTTP_PROXY=127.0.0.1:9999
export HTTPS_PROXY=127.0.0.1:9999
```

5. Start Grafana

**Note:** Only queries with **absolute time ranges** should be used with the proxy. Relative time ranges are not supported in the default matcher.

## CA Certificate Setup

This step is needed so that the proxy can intercept HTTPS traffic. By default, the bundled [certificate](certificate_authority/grafana-e2e-ca.pem) and [private key](certificate_authority/grafana-e2e-ca.key.pem) are used. For more information about using a custom CA key pair, see the [ca_keypair](#ca_keypair) config section.

### Debian & Ubuntu

1. Add CA certificate:

```
mage e2e:certificate && sudo tee /usr/share/ca-certificates/extra/ca.crt
```

2. Update the CA store:

```
sudo update-ca-certificates --fresh
```

### MacOS

1. Create a temporary copy of the CA certificate:

```
mage e2e:certificate > /tmp/grafana-e2e.crt
```

2. Add CA certificate:

```
sudo security add-trusted-cert -d -p ssl -p basic -k /Library/Keychains/System.keychain /tmp/grafana-e2e.crt
```

## Config File

The E2E proxy can be configured by adding a `proxy.json` file to the root of your plugin's repo.

Default configuration:
```json
{
	"storage": [{
		"type": "har",
		"path": "fixtures/e2e.har"
	}],
	"address": "127.0.0.1:9999",
	"hosts": [],
	"ca_keypair": {
		"cert": null,
		"private_key": null
	}
}
```

### address

The hostname or IP address and port for the proxy server.

Default: `127.0.0.1:9999`

### hosts

An allow list can be used to restrict captured traffic to a specific set of hosts.

Default: `[]` (traffic for all hosts will be captured)

### storage

An array of storage configurations.

Default: 
```json
[{
	"type": "har",
	"path": "fixtures/e2e.har"
}]
```

OpenAPI documentation is also supported as a storage type:

```json
[{
	"type": "openapi",
	"path": "fixtures/openapi.yml"
}]
```

Limitations:
* The documentation must include examples for each supported endpoint
* [Replay mode](#replay-mode) is the only supported mode for OpenAPI documentation

In certain situations it can be useful to replay responses from multiple data sources.
```json
[
	{
		"type": "har",
		"path": "fixtures/ds_one.har"
	},
	{
		"type": "har",
		"path": "fixtures/ds_two.har"
	},
]
```

**Note:** Multiple storage configurations are only supported in replay mode.

### ca_keypair

An object used define paths to a custom CA certificate and private key in PEM format. By default, the bundled [certificate](certificate_authority/grafana-e2e-ca.pem) and [private key](certificate_authority/grafana-e2e-ca.key.pem) are used. For more information about generating a custom self-signed CA certificate, see the [Certificate Authority Key Pair Generation](certificate_authority/README.md) documentation.

Default:
```json
{
	"cert": null,
	"private_key": null
}
```

Example configuration:
```json
{
	"cert": "./cert.pem",
	"private_key": "./key.pem"
}
```

## Mage Commands

### Append mode

Append mode should be used to record interactions for any new tests. It will record requests and responses for any requests that haven't been seen before, and return recorded responses for any requests that match previously recorded interactions.

```
mage e2e:append
```

### Overwrite mode

Overwrite mode should be used if previously recorded interactions need to be replaced with new data.

```
mage e2e:overwrite
```

### Replay mode

Replay mode should be used in CI or locally if only playback of recorded data is needed. Replay mode will return recorded responses for any matching requests, and pass any requests that don't match recorded interactions to the target API.

```
mage e2e:replay
```

### CA Certificate

This command prints the CA certificate to stdout so that it can be added to the local test environment. For more information, see the [CA Setup](#ca-certificate-setup) section above.

```
mage e2e:certificate
```

If you wish to provide a custom CA certificate and private key, see the [ca_keypair](#ca_keypair) section above. If configured, this command will print the custom CA certificate to stdout.

## Reviewing Recorded Traffic

The default storage for recorded interactions are [HAR](https://en.wikipedia.org/wiki/HAR_(file_format)) files. Using the HAR format allows recorded interactions to be easily reviewed in tools like Postman or in browser dev tools.

To review the saved requests and responses, drag the HAR file into the network panel of your favorite browser.

![HAR](har.gif)

## Modifying Default Behavior

You can modify the default request processor, response processor, and matching behavior in your plugin project by modifying the `Magefile.go` in the root of your project:

```go
//go:build mage
// +build mage

package main

import (
	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"

	"bytes"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/config"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/fixture"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/storage"
)

// Default configures the default target.
var Default = build.BuildAll

func CustomE2E() error {
	cfg, err := config.LoadConfig("proxy.json")
	if err != nil {
		return err
	}

	fixtures := make([]*fixture.Fixture, 0)
	for _, s := range cfg.Storage {
		if s.Type == config.StorageTypeHAR {
			continue
		}

		store := storage.NewHARStorage(s.Path)
		f := fixture.NewFixture(store)

		// modify incoming requests
		f.WithRequestProcessor(func(req *http.Request) *http.Request {
			req.URL.Host = "example.com"
			req.URL.Path = "/hello/world"
			return req
		})

		// modify outgoing responses
		f.WithResponseProcessor(func(res *http.Response) *http.Response {
			res.Header.Set("X-Custom-Header", "custom-value")
			return res
		})

		// modify matching behavior
		f.WithMatcher(func(req *http.Request) *http.Response {
			if req.URL.Path == "/hello/world" {
				return &http.Response{
					StatusCode: http.StatusNotFound,
					Header:     http.Header{},
					Body:       io.NopCloser(bytes.NewBufferString("Not found")),
				}
			}
			return nil
		})

		fixtures = append(fixtures, fixture.NewFixture(store))
	}

	proxy := e2e.NewProxy(e2e.ProxyModeAppend, fixtures, cfg)
	return proxy.Start()
}
```

Start the proxy using the new `CustomE2E` mage target:

```
mage CustomE2E
```

In a separate terminal, use `curl` to test the new mage target:

```
curl --proxy 127.0.0.1:9999 -i http://example.com
HTTP/1.1 404 Not Found
Date: Mon, 21 Feb 2022 20:27:52 GMT
Content-Length: 9
Content-Type: text/plain; charset=utf-8
X-Custom-Header: custom-value

Not found
```

You should now see the following output in the proxy window:

```
mage CustomE2E
Starting proxy mode append addr 127.0.0.1:9999
Match url: http://example.com/hello/world status: 404
```
