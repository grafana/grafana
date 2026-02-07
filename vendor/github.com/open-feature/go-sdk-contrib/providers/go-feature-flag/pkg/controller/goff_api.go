package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"

	"github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg/model"
)

type GoFeatureFlagApiOptions struct {
	// Endpoint contains the DNS of your GO Feature Flag relay proxy (ex: http://localhost:1031)
	Endpoint string
	// HTTPClient (optional) is the HTTP Client we will use to contact GO Feature Flag.
	// By default, we are using a custom HTTPClient with a timeout configure to 10000 milliseconds.
	HTTPClient *http.Client
	// APIKey  (optional) If the relay proxy is configured to authenticate the requests, you should provide
	// an API Key to the provider. Please ask the administrator of the relay proxy to provide an API Key.
	// (This feature is available only if you are using GO Feature Flag relay proxy v1.7.0 or above)
	// Default: null
	APIKey string
	// ExporterMetadata (optional) If we set metadata, it will be sent with every data collection requests along with the events.
	ExporterMetadata map[string]interface{}
}

type GoFeatureFlagAPI struct {
	options GoFeatureFlagApiOptions

	// --- internal properties
	// configChangeEtag is the etag of the last configuration change
	configChangeEtag string
}

func NewGoFeatureFlagAPI(options GoFeatureFlagApiOptions) GoFeatureFlagAPI {
	return GoFeatureFlagAPI{options: options}
}

func (g *GoFeatureFlagAPI) CollectData(events []model.FeatureEvent) error {
	u, _ := url.Parse(g.options.Endpoint)
	u.Path = path.Join(u.Path, "v1", "data", "collector")

	reqBody := model.DataCollectorRequest{
		Events: events,
		Meta:   g.options.ExporterMetadata,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set(ContentTypeHeader, ApplicationJson)
	if g.options.APIKey != "" {
		req.Header.Set(AuthorizationHeader, BearerPrefix+g.options.APIKey)
	}

	response, err := g.getHttpClient().Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("request failed with status: %v", response.Status)
	}
	return nil
}

// ConfigurationHasChanged checks if the configuration has changed since the last call.
func (g *GoFeatureFlagAPI) ConfigurationHasChanged() (ConfigurationChangeStatus, error) {
	u, _ := url.Parse(g.options.Endpoint)
	u.Path = path.Join(u.Path, "v1", "flag", "change")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return ErrorConfigurationChange, err
	}
	req.Header.Set(ContentTypeHeader, ApplicationJson)
	if g.options.APIKey != "" {
		req.Header.Set(AuthorizationHeader, BearerPrefix+g.options.APIKey)
	}
	if g.configChangeEtag != "" {
		req.Header.Set(IfNoneMatchHeader, g.configChangeEtag)
	}

	response, err := g.getHttpClient().Do(req)
	if err != nil {
		return ErrorConfigurationChange, err
	}
	_ = response.Body.Close()

	switch response.StatusCode {
	case http.StatusOK:
		if g.configChangeEtag == "" {
			g.configChangeEtag = response.Header.Get("ETag")
			return FlagConfigurationInitialized, nil
		}
		g.configChangeEtag = response.Header.Get("ETag")
		return FlagConfigurationUpdated, nil
	case http.StatusNotModified:
		return FlagConfigurationNotChanged, nil
	default:
		return ErrorConfigurationChange, fmt.Errorf("request failed with status: %v", response.Status)
	}
}

// getHttpClient returns the HTTP Client to use for the request.
func (g *GoFeatureFlagAPI) getHttpClient() *http.Client {
	client := g.options.HTTPClient
	if client == nil {
		client = DefaultHTTPClient()
	}
	return client
}
