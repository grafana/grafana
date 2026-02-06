// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

// Package influxdb2 provides API for using InfluxDB client in Go.
// It's intended to use with InfluxDB 2 server. WriteAPI, QueryAPI and Health work also with InfluxDB 1.8
package influxdb2

import (
	"context"
	"errors"
	httpnet "net/http"
	"strings"
	"sync"
	"time"

	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/influxdata/influxdb-client-go/v2/api/http"
	"github.com/influxdata/influxdb-client-go/v2/domain"
	ilog "github.com/influxdata/influxdb-client-go/v2/internal/log"
	"github.com/influxdata/influxdb-client-go/v2/log"
)

// Client provides API to communicate with InfluxDBServer.
// There two APIs for writing, WriteAPI and WriteAPIBlocking.
// WriteAPI provides asynchronous, non-blocking, methods for writing time series data.
// WriteAPIBlocking provides blocking methods for writing time series data.
type Client interface {
	// Setup sends request to initialise new InfluxDB server with user, org and bucket, and data retention period
	// and returns details about newly created entities along with the authorization object.
	// Retention period of zero will result to infinite retention.
	Setup(ctx context.Context, username, password, org, bucket string, retentionPeriodHours int) (*domain.OnboardingResponse, error)
	// SetupWithToken sends request to initialise new InfluxDB server with user, org and bucket, data retention period and token
	// and returns details about newly created entities along with the authorization object.
	// Retention period of zero will result to infinite retention.
	SetupWithToken(ctx context.Context, username, password, org, bucket string, retentionPeriodHours int, token string) (*domain.OnboardingResponse, error)
	// Ready returns InfluxDB uptime info of server. It doesn't validate authentication params.
	Ready(ctx context.Context) (*domain.Ready, error)
	// Health returns an InfluxDB server health check result. Read the HealthCheck.Status field to get server status.
	// Health doesn't validate authentication params.
	Health(ctx context.Context) (*domain.HealthCheck, error)
	// Ping validates whether InfluxDB server is running. It doesn't validate authentication params.
	Ping(ctx context.Context) (bool, error)
	// Close ensures all ongoing asynchronous write clients finish.
	// Also closes all idle connections, in case of HTTP client was created internally.
	Close()
	// Options returns the options associated with client
	Options() *Options
	// ServerURL returns the url of the server url client talks to
	ServerURL() string
	// HTTPService returns underlying HTTP service object used by client
	HTTPService() http.Service
	// WriteAPI returns the asynchronous, non-blocking, Write client.
	// Ensures using a single WriteAPI instance for each org/bucket pair.
	WriteAPI(org, bucket string) api.WriteAPI
	// WriteAPIBlocking returns the synchronous, blocking, Write client.
	// Ensures using a single WriteAPIBlocking instance for each org/bucket pair.
	WriteAPIBlocking(org, bucket string) api.WriteAPIBlocking
	// QueryAPI returns Query client.
	// Ensures using a single QueryAPI instance each org.
	QueryAPI(org string) api.QueryAPI
	// AuthorizationsAPI returns Authorizations API client.
	AuthorizationsAPI() api.AuthorizationsAPI
	// OrganizationsAPI returns Organizations API client
	OrganizationsAPI() api.OrganizationsAPI
	// UsersAPI returns Users API client.
	UsersAPI() api.UsersAPI
	// DeleteAPI returns Delete API client
	DeleteAPI() api.DeleteAPI
	// BucketsAPI returns Buckets API client
	BucketsAPI() api.BucketsAPI
	// LabelsAPI returns Labels API client
	LabelsAPI() api.LabelsAPI
	// TasksAPI returns Tasks API client
	TasksAPI() api.TasksAPI

	APIClient() *domain.Client
}

// clientImpl implements Client interface
type clientImpl struct {
	serverURL     string
	options       *Options
	writeAPIs     map[string]api.WriteAPI
	syncWriteAPIs map[string]api.WriteAPIBlocking
	lock          sync.Mutex
	httpService   http.Service
	apiClient     *domain.Client
	authAPI       api.AuthorizationsAPI
	orgAPI        api.OrganizationsAPI
	usersAPI      api.UsersAPI
	deleteAPI     api.DeleteAPI
	bucketsAPI    api.BucketsAPI
	labelsAPI     api.LabelsAPI
	tasksAPI      api.TasksAPI
}

type clientDoer struct {
	service http.Service
}

// NewClient creates Client for connecting to given serverURL with provided authentication token, with the default options.
// serverURL is the InfluxDB server base URL, e.g. http://localhost:8086,
// authToken is an authentication token. It can be empty in case of connecting to newly installed InfluxDB server, which has not been set up yet.
// In such case, calling Setup() will set the authentication token.
func NewClient(serverURL string, authToken string) Client {
	return NewClientWithOptions(serverURL, authToken, DefaultOptions())
}

// NewClientWithOptions creates Client for connecting to given serverURL with provided authentication token
// and configured with custom Options.
// serverURL is the InfluxDB server base URL, e.g. http://localhost:8086,
// authToken is an authentication token. It can be empty in case of connecting to newly installed InfluxDB server, which has not been set up yet.
// In such case, calling Setup() will set authentication token
func NewClientWithOptions(serverURL string, authToken string, options *Options) Client {
	normServerURL := serverURL
	if !strings.HasSuffix(normServerURL, "/") {
		// For subsequent path parts concatenation, url has to end with '/'
		normServerURL = serverURL + "/"
	}
	authorization := ""
	if len(authToken) > 0 {
		authorization = "Token " + authToken
	}
	service := http.NewService(normServerURL, authorization, options.httpOptions)
	doer := &clientDoer{service}

	apiClient, _ := domain.NewClient(service.ServerURL(), doer)

	client := &clientImpl{
		serverURL:     serverURL,
		options:       options,
		writeAPIs:     make(map[string]api.WriteAPI, 5),
		syncWriteAPIs: make(map[string]api.WriteAPIBlocking, 5),
		httpService:   service,
		apiClient:     apiClient,
	}
	if log.Log != nil {
		log.Log.SetLogLevel(options.LogLevel())
	}
	if ilog.Level() >= log.InfoLevel {
		tokenStr := ""
		if len(authToken) > 0 {
			tokenStr = ", token '******'"
		}
		ilog.Infof("Using URL '%s'%s", serverURL, tokenStr)
	}
	if options.ApplicationName() == "" {
		ilog.Warn("Application name is not set")
	}
	return client
}

func (c *clientImpl) APIClient() *domain.Client {
	return c.apiClient
}

func (c *clientImpl) Options() *Options {
	return c.options
}

func (c *clientImpl) ServerURL() string {
	return c.serverURL
}

func (c *clientImpl) HTTPService() http.Service {
	return c.httpService
}

func (c *clientDoer) Do(req *httpnet.Request) (*httpnet.Response, error) {
	return c.service.DoHTTPRequestWithResponse(req, nil)
}

func (c *clientImpl) Ready(ctx context.Context) (*domain.Ready, error) {
	params := &domain.GetReadyParams{}
	return c.apiClient.GetReady(ctx, params)
}

func (c *clientImpl) Setup(ctx context.Context, username, password, org, bucket string, retentionPeriodHours int) (*domain.OnboardingResponse, error) {
	return c.SetupWithToken(ctx, username, password, org, bucket, retentionPeriodHours, "")
}

func (c *clientImpl) SetupWithToken(ctx context.Context, username, password, org, bucket string, retentionPeriodHours int, token string) (*domain.OnboardingResponse, error) {
	if username == "" || password == "" {
		return nil, errors.New("a username and a password is required for a setup")
	}
	c.lock.Lock()
	defer c.lock.Unlock()
	params := &domain.PostSetupAllParams{}
	retentionPeriodSeconds := int64(retentionPeriodHours * 3600)
	retentionPeriodHrs := int(time.Duration(retentionPeriodSeconds) * time.Second)
	params.Body = domain.PostSetupJSONRequestBody{
		Bucket:                 bucket,
		Org:                    org,
		Password:               &password,
		RetentionPeriodSeconds: &retentionPeriodSeconds,
		RetentionPeriodHrs:     &retentionPeriodHrs,
		Username:               username,
	}
	if token != "" {
		params.Body.Token = &token
	}
	return c.apiClient.PostSetup(ctx, params)
}

func (c *clientImpl) Health(ctx context.Context) (*domain.HealthCheck, error) {
	params := &domain.GetHealthParams{}
	return c.apiClient.GetHealth(ctx, params)
}

func (c *clientImpl) Ping(ctx context.Context) (bool, error) {
	err := c.apiClient.GetPing(ctx)
	if err != nil {
		return false, err
	}
	return true, nil
}

func createKey(org, bucket string) string {
	return org + "\t" + bucket
}

func (c *clientImpl) WriteAPI(org, bucket string) api.WriteAPI {
	c.lock.Lock()
	defer c.lock.Unlock()
	key := createKey(org, bucket)
	if _, ok := c.writeAPIs[key]; !ok {
		w := api.NewWriteAPI(org, bucket, c.httpService, c.options.writeOptions)
		c.writeAPIs[key] = w
	}
	return c.writeAPIs[key]
}

func (c *clientImpl) WriteAPIBlocking(org, bucket string) api.WriteAPIBlocking {
	c.lock.Lock()
	defer c.lock.Unlock()
	key := createKey(org, bucket)
	if _, ok := c.syncWriteAPIs[key]; !ok {
		w := api.NewWriteAPIBlocking(org, bucket, c.httpService, c.options.writeOptions)
		c.syncWriteAPIs[key] = w
	}
	return c.syncWriteAPIs[key]
}

func (c *clientImpl) Close() {
	for key, w := range c.writeAPIs {
		wa := w.(*api.WriteAPIImpl)
		wa.Close()
		delete(c.writeAPIs, key)
	}
	for key := range c.syncWriteAPIs {
		delete(c.syncWriteAPIs, key)
	}
	if c.options.HTTPOptions().OwnHTTPClient() {
		c.options.HTTPOptions().HTTPClient().CloseIdleConnections()
	}
}

func (c *clientImpl) QueryAPI(org string) api.QueryAPI {
	return api.NewQueryAPI(org, c.httpService)
}

func (c *clientImpl) AuthorizationsAPI() api.AuthorizationsAPI {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.authAPI == nil {
		c.authAPI = api.NewAuthorizationsAPI(c.apiClient)
	}
	return c.authAPI
}

func (c *clientImpl) OrganizationsAPI() api.OrganizationsAPI {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.orgAPI == nil {
		c.orgAPI = api.NewOrganizationsAPI(c.apiClient)
	}
	return c.orgAPI
}

func (c *clientImpl) UsersAPI() api.UsersAPI {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.usersAPI == nil {
		c.usersAPI = api.NewUsersAPI(c.apiClient, c.httpService, c.options.HTTPClient())
	}
	return c.usersAPI
}

func (c *clientImpl) DeleteAPI() api.DeleteAPI {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.deleteAPI == nil {
		c.deleteAPI = api.NewDeleteAPI(c.apiClient)
	}
	return c.deleteAPI
}

func (c *clientImpl) BucketsAPI() api.BucketsAPI {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.bucketsAPI == nil {
		c.bucketsAPI = api.NewBucketsAPI(c.apiClient)
	}
	return c.bucketsAPI
}

func (c *clientImpl) LabelsAPI() api.LabelsAPI {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.labelsAPI == nil {
		c.labelsAPI = api.NewLabelsAPI(c.apiClient)
	}
	return c.labelsAPI
}

func (c *clientImpl) TasksAPI() api.TasksAPI {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c.tasksAPI == nil {
		c.tasksAPI = api.NewTasksAPI(c.apiClient)
	}
	return c.tasksAPI
}
