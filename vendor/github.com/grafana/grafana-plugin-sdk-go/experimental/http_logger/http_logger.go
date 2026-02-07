package httplogger

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/fixture"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/storage"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/utils"
)

const (
	// PluginHARLogEnabledEnv is a constant for the GF_PLUGIN_HAR_LOG_ENABLED environment variable used to enable HTTP request and responses in HAR format for debugging purposes.
	PluginHARLogEnabledEnv = "GF_PLUGIN_HAR_LOG_ENABLED"
	// PluginHARLogPathEnv is a constant for the GF_PLUGIN_HAR_LOG_PATH environment variable used to specify a path to store HTTP request and responses in HAR format for debugging purposes.
	PluginHARLogPathEnv = "GF_PLUGIN_HAR_LOG_PATH"
)

// HTTPLogger is a http.RoundTripper that logs requests and responses in HAR format.
type HTTPLogger struct {
	pluginID string
	enabled  func() bool
	proxied  http.RoundTripper
	fixture  *fixture.Fixture
}

type Options struct {
	Path      string
	EnabledFn func() bool
}

// NewHTTPLogger creates a new HTTPLogger.
func NewHTTPLogger(pluginID string, proxied http.RoundTripper, opts ...Options) *HTTPLogger {
	if len(opts) > 1 {
		panic("too many Options arguments provided")
	}

	loggerOpts := getOptions(pluginID, opts...)
	s := storage.NewHARStorage(loggerOpts.Path)
	f := fixture.NewFixture(s)

	return &HTTPLogger{
		pluginID: pluginID,
		proxied:  proxied,
		fixture:  f,
		enabled:  loggerOpts.EnabledFn,
	}
}

// RoundTrip implements the http.RoundTripper interface.
func (hl *HTTPLogger) RoundTrip(req *http.Request) (*http.Response, error) {
	if !hl.enabled() {
		return hl.proxied.RoundTrip(req)
	}

	buf := []byte{}
	if req.Body != nil {
		if b, err := utils.ReadRequestBody(req); err == nil {
			req.Body = io.NopCloser(bytes.NewReader(b))
			buf = b
		}
	}

	res, err := hl.proxied.RoundTrip(req)
	if err != nil {
		return res, err
	}

	// reset the request body before saving
	if req.Body != nil {
		req.Body = io.NopCloser(bytes.NewBuffer(buf))
	}

	// skip saving if there's an existing entry for this request
	if exists := hl.fixture.Match(req); exists != nil {
		return res, err
	}

	err = hl.fixture.Add(req, res)
	return res, err
}

func defaultPath(pluginID string) string {
	if path, ok := os.LookupEnv(PluginHARLogPathEnv); ok {
		return path
	}
	return getTempFilePath(pluginID)
}

func defaultEnabledCheck() bool {
	if v, ok := os.LookupEnv(PluginHARLogEnabledEnv); ok && v == "true" {
		return true
	}
	return false
}

func getTempFilePath(pluginID string) string {
	filename := fmt.Sprintf("%s_%d.har", pluginID, time.Now().UnixMilli())
	return path.Join(os.TempDir(), filename)
}

func getOptions(pluginID string, opts ...Options) Options {
	o := Options{EnabledFn: defaultEnabledCheck, Path: defaultPath(pluginID)}

	// if there's not one set of options provided, return the defaults
	if len(opts) != 1 {
		return o
	}

	if opts[0].Path != "" {
		o.Path = opts[0].Path
	}

	if opts[0].EnabledFn != nil {
		o.EnabledFn = opts[0].EnabledFn
	}

	return o
}
