package e2e

import (
	"crypto/x509"
	_ "embed" // used for embedding the CA certificate and key
	"fmt"
	"net/http"
	"strings"

	"github.com/elazarl/goproxy"

	ca "github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/certificate_authority"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/config"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/fixture"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/utils"
)

// ProxyMode is the record or playback mode of the Proxy.
type ProxyMode int

func (m ProxyMode) String() string {
	switch m {
	case ProxyModeReplay:
		return "replay"
	case ProxyModeAppend:
		return "append"
	case ProxyModeOverwrite:
		return "overwrite"
	default:
		return "unknown"
	}
}

const (
	// ProxyModeAppend records new requests and responses, and replays existing responses if they match.
	ProxyModeAppend ProxyMode = iota
	// ProxyModeOverwrite records new requests and responses.
	ProxyModeOverwrite
	// ProxyModeReplay replays existing responses if they match.
	ProxyModeReplay
)

// Proxy is a proxy server used for recording and replaying E2E test fixtures.
type Proxy struct {
	Mode     ProxyMode
	Fixtures []*fixture.Fixture
	Server   *goproxy.ProxyHttpServer
	Config   *config.Config
}

// NewProxy creates a new Proxy.
func NewProxy(mode ProxyMode, fixture []*fixture.Fixture, config *config.Config) *Proxy {
	err := setupCA(config)
	if err != nil {
		panic(err)
	}

	p := &Proxy{
		Mode:     mode,
		Fixtures: fixture,
		Server:   goproxy.NewProxyHttpServer(),
		Config:   config,
	}

	p.Server.OnRequest().HandleConnect(goproxy.AlwaysMitm)

	// Replay mode
	if p.Mode == ProxyModeReplay {
		p.Server.OnRequest().DoFunc(p.replay)
		return p
	}

	if len(p.Fixtures) > 1 {
		panic("Multiple storage configurations are not supported in append or overwrite mode")
	}

	// Append mode
	if p.Mode == ProxyModeAppend {
		p.Server.OnRequest().DoFunc(p.replay)
		p.Server.OnResponse().DoFunc(p.append)
		return p
	}

	// Overwrite mode
	p.Server.OnRequest().DoFunc(p.request)
	p.Server.OnResponse().DoFunc(p.overwrite)
	return p
}

// Start starts the proxy server.
func (p *Proxy) Start() error {
	fmt.Println("Starting proxy", "mode", p.Mode.String(), "addr", p.Config.Address)
	//nolint:gosec
	return http.ListenAndServe(p.Config.Address, p.Server)
}

// request sends a request to the destination server.
func (p *Proxy) request(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
	ctx.RoundTripper = goproxy.RoundTripperFunc(utils.RoundTripper)
	return req, nil
}

// replay returns a saved response for any matching request, and falls back to sending a request to the destination server.
func (p *Proxy) replay(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
	ctx.RoundTripper = goproxy.RoundTripperFunc(utils.RoundTripper)
	if !p.matchesHosts(req.URL.Host) {
		return req, nil
	}

	for _, f := range p.Fixtures {
		if res := f.Match(req); res != nil {
			fmt.Println("Match", "url:", res.Request.URL.String(), "status:", res.StatusCode)
			return req, res
		}
	}
	fmt.Println("Miss", "url:", req.URL.String())
	return req, nil
}

// append appends a response to the fixture store if there currently is not a match for the request.
func (p *Proxy) append(res *http.Response, _ *goproxy.ProxyCtx) *http.Response {
	if !p.matchesHosts(res.Request.URL.Host) {
		return res
	}
	f := p.Fixtures[0]
	if matched := f.Match(res.Request); matched != nil {
		return matched
	}
	err := f.Add(res.Request, res)
	if err != nil {
		fmt.Println("Failed to append response", "url:", res.Request.URL.String(), "status:", res.StatusCode, "error:", err)
		return res
	}
	fmt.Println("Append", "url:", res.Request.URL.String(), "status:", res.StatusCode)
	return res
}

// overwrite replaces a response in the fixture store if there currently is a match for the request.
func (p *Proxy) overwrite(res *http.Response, _ *goproxy.ProxyCtx) *http.Response {
	if !p.matchesHosts(res.Request.URL.Host) {
		return res
	}
	f := p.Fixtures[0]
	if f.Delete(res.Request) {
		fmt.Println("Removed existing match", "url:", res.Request.URL.String(), "status:", res.StatusCode)
	}
	err := f.Add(res.Request, res)
	if err != nil {
		fmt.Println("Failed to overwrite response", "url:", res.Request.URL.String(), "status:", res.StatusCode, "error:", err)
		return res
	}
	fmt.Println("Overwrite", "url:", res.Request.URL.String(), "status:", res.StatusCode)
	return res
}

func (p *Proxy) matchesHosts(h string) bool {
	// Match all hosts if no hosts are configured.
	if len(p.Config.Hosts) == 0 {
		return true
	}
	for _, host := range p.Config.Hosts {
		if strings.Contains(h, host) {
			return true
		}
	}
	return false
}

func setupCA(cfg *config.Config) error {
	goproxyCa, err := ca.GetCertificate(cfg.CAConfig.Cert, cfg.CAConfig.PrivateKey)
	if err != nil {
		return err
	}
	if goproxyCa.Leaf, err = x509.ParseCertificate(goproxyCa.Certificate[0]); err != nil {
		return err
	}
	goproxy.GoproxyCa = goproxyCa
	goproxy.OkConnect = &goproxy.ConnectAction{Action: goproxy.ConnectAccept, TLSConfig: goproxy.TLSConfigFromCA(&goproxyCa)}
	goproxy.MitmConnect = &goproxy.ConnectAction{Action: goproxy.ConnectMitm, TLSConfig: goproxy.TLSConfigFromCA(&goproxyCa)}
	goproxy.HTTPMitmConnect = &goproxy.ConnectAction{Action: goproxy.ConnectHTTPMitm, TLSConfig: goproxy.TLSConfigFromCA(&goproxyCa)}
	goproxy.RejectConnect = &goproxy.ConnectAction{Action: goproxy.ConnectReject, TLSConfig: goproxy.TLSConfigFromCA(&goproxyCa)}
	return nil
}
