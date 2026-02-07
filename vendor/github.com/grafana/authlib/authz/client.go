package authz

import (
	"bytes"
	"context"
	"encoding/gob"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/cache"
	"github.com/grafana/authlib/types"
)

var (
	checkResponseDenied = types.CheckResponse{Allowed: false, Zookie: types.NoopZookie{}}

	k6FolderUID = "k6-app"
)

var (
	ErrMissingAuthInfo   = errors.New("missing auth info")
	ErrNamespaceMismatch = errors.New("namespace mismatch")
)

func IsUnauthorizedErr(err error) bool {
	return errors.Is(err, ErrNamespaceMismatch)
}

// ClientImpl will implement the types.AccessClient interface
// Once we are able to deal with folder permissions expansion.
var _ types.AccessClient = (*ClientImpl)(nil)

type AuthzClientOption func(*ClientImpl)

type ClientImpl struct {
	clientV1 authzv1.AuthzServiceClient
	cache    cache.Cache
	tracer   trace.Tracer
}

// -----
// Options
// -----

func WithCacheClientOption(cache cache.Cache) AuthzClientOption {
	return func(c *ClientImpl) {
		c.cache = cache
	}
}

func WithTracerClientOption(tracer trace.Tracer) AuthzClientOption {
	return func(c *ClientImpl) {
		c.tracer = tracer
	}
}

// -----
// Initialization
// -----

func NewClient(cc grpc.ClientConnInterface, opts ...AuthzClientOption) *ClientImpl {
	client := &ClientImpl{
		clientV1: authzv1.NewAuthzServiceClient(cc),
		tracer:   noop.Tracer{},
	}

	// Apply options
	for _, opt := range opts {
		opt(client)
	}

	// Instantiate the cache
	if client.cache == nil {
		client.cache = cache.NewLocalCache(cache.Config{
			Expiry:          5 * time.Minute,
			CleanupInterval: 10 * time.Minute,
		})
	}

	return client
}

// -----
// Implementation
// -----

func (c *ClientImpl) check(ctx context.Context, authInfo types.AuthInfo, req *types.CheckRequest, folder string) (bool, int64, error) {
	ctx, span := c.tracer.Start(ctx, "ClientImpl.hasAccess")
	defer span.End()

	idIsServiceAccount := types.IsIdentityType(authInfo.GetIdentityType(), types.TypeServiceAccount)
	if !idIsServiceAccount && (req.Name == k6FolderUID || folder == k6FolderUID) {
		return false, time.Now().UnixMilli(), nil
	}

	key := checkCacheKey(authInfo.GetSubject(), req, folder)

	// Skip the cache if requested
	if !req.SkipCache {
		allowed, timestamp, err := c.getCachedCheck(ctx, key)
		if err == nil {
			return allowed, timestamp, nil
		}
	}

	checkReq := &authzv1.CheckRequest{
		Subject:     authInfo.GetUID(),
		Verb:        req.Verb,
		Group:       req.Group,
		Resource:    req.Resource,
		Namespace:   req.Namespace,
		Name:        req.Name,
		Subresource: req.Subresource,
		Path:        req.Path,
		Folder:      folder,
		Skipcache:   req.SkipCache,
	}

	// Instantiate a new context for the request
	outCtx := newOutgoingContext(ctx)

	// Query the authz service
	resp, err := c.clientV1.Check(outCtx, checkReq)
	if err != nil {
		return false, 0, err
	}

	// Ensure backward compatibility with older authz servers
	// that don't return a zookie
	ts := time.Now().UnixMilli()
	if resp.Zookie != nil {
		ts = resp.Zookie.Timestamp
	}

	// Cache the result
	err = c.cacheCheck(ctx, key, resp.Allowed, ts)

	return resp.Allowed, ts, err
}

func (c *ClientImpl) Check(ctx context.Context, authInfo types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
	ctx, span := c.tracer.Start(ctx, "ClientImpl.Check")
	defer span.End()

	if err := types.ValidateCheckRequest(req); err != nil {
		span.RecordError(err)
		return checkResponseDenied, err
	}

	if authInfo.GetSubject() == "" {
		span.RecordError(ErrMissingAuthInfo)
		return checkResponseDenied, ErrMissingAuthInfo
	}

	if !types.NamespaceMatches(authInfo.GetNamespace(), req.Namespace) {
		return checkResponseDenied, namespaceMismatchError(authInfo.GetNamespace(), req.Namespace)
	}

	checkServiceRes := CheckServicePermissions(authInfo, req.Group, req.Resource, req.Verb)

	span.SetAttributes(attribute.String("subject", authInfo.GetSubject()))
	span.SetAttributes(attribute.String("namespace", req.Namespace))
	span.SetAttributes(attribute.String("verb", req.Verb))
	span.SetAttributes(attribute.String("group", req.Group))
	span.SetAttributes(attribute.String("resource", req.Resource))
	if req.Name != "" {
		span.SetAttributes(attribute.String("name", req.Name))
	}
	if req.Path != "" {
		span.SetAttributes(attribute.String("path", req.Path))
	}
	span.SetAttributes(attribute.Bool("with_user", !checkServiceRes.ServiceCall))
	span.SetAttributes(attribute.Int("permissions", len(checkServiceRes.Permissions)))
	span.SetAttributes(attribute.Bool("service_allowed", checkServiceRes.Allowed))

	if checkServiceRes.ServiceCall {
		// No user => check on the service permissions only
		return types.CheckResponse{Allowed: checkServiceRes.Allowed, Zookie: types.NoopZookie{}}, nil
	}

	if !checkServiceRes.Allowed {
		// Service is not allowed => no need to check the user permissions
		return checkResponseDenied, nil
	}

	allowed, timestamp, err := c.check(ctx, authInfo, &req, folder)
	if err != nil {
		span.RecordError(err)
		return checkResponseDenied, err
	}

	// Check if the user has access to any of the requested resources
	span.SetAttributes(attribute.Bool("user_allowed", allowed))
	span.SetAttributes(attribute.Int64("zookie_timestamp", timestamp))
	return types.CheckResponse{Allowed: allowed, Zookie: NewTimestampZookie(timestamp)}, nil
}

func (c *ClientImpl) compile(ctx context.Context, authInfo types.AuthInfo, list *types.ListRequest) (*itemChecker, error) {
	key := itemCheckerCacheKey(authInfo.GetSubject(), list)

	// Skip the cache if requested
	if !list.SkipCache {
		checker, err := c.getCachedItemChecker(ctx, key)
		if err == nil {
			return checker, nil
		}
	}

	// Instantiate a new context for the request
	outCtx := newOutgoingContext(ctx)

	// Query the authz service
	listReq := &authzv1.ListRequest{
		Subject:     authInfo.GetUID(),
		Group:       list.Group,
		Resource:    list.Resource,
		Verb:        list.Verb,
		Namespace:   list.Namespace,
		Subresource: list.Subresource,
		Options: &authzv1.ListRequestOptions{
			Skipcache: list.SkipCache,
		},
	}

	resp, err := c.clientV1.List(outCtx, listReq)
	if err != nil {
		return nil, err
	}

	checker := newItemChecker(resp)
	err = c.cacheItemChecker(ctx, key, checker)

	return checker, err
}

func (c *ClientImpl) Compile(ctx context.Context, authInfo types.AuthInfo, list types.ListRequest) (types.ItemChecker, types.Zookie, error) {
	ctx, span := c.tracer.Start(ctx, "ClientImpl.List")
	defer span.End()

	if err := types.ValidateListRequest(list); err != nil {
		span.RecordError(err)
		return nil, nil, err
	}

	if authInfo.GetSubject() == "" {
		span.RecordError(ErrMissingAuthInfo)
		return nil, nil, ErrMissingAuthInfo
	}

	if !types.NamespaceMatches(authInfo.GetNamespace(), list.Namespace) {
		return nil, nil, namespaceMismatchError(authInfo.GetNamespace(), list.Namespace)
	}

	checkServiceRes := CheckServicePermissions(authInfo, list.Group, list.Resource, list.Verb)

	span.SetAttributes(attribute.String("namespace", list.Namespace))
	span.SetAttributes(attribute.String("group", list.Group))
	span.SetAttributes(attribute.String("resource", list.Resource))
	span.SetAttributes(attribute.String("verb", list.Verb))
	span.SetAttributes(attribute.Bool("with_user", !checkServiceRes.ServiceCall))
	span.SetAttributes(attribute.Int("permissions", len(checkServiceRes.Permissions)))
	span.SetAttributes(attribute.Bool("service_allowed", checkServiceRes.Allowed))

	if checkServiceRes.ServiceCall {
		// No user => check on the service permissions only
		if checkServiceRes.Allowed {
			return allowAllChecker(true), types.NoopZookie{}, nil
		}
		return denyAllChecker, types.NoopZookie{}, nil
	}

	if !checkServiceRes.Allowed {
		// Service is not allowed => no need to check the user permissions
		return denyAllChecker, types.NoopZookie{}, nil
	}

	checker, err := c.compile(ctx, authInfo, &list)
	if err != nil {
		span.RecordError(err)
		return denyAllChecker, types.NoopZookie{}, err
	}

	return checker.fn(authInfo), checker.Zookie(), nil
}

// BatchCheck performs multiple access checks in a single request.
func (c *ClientImpl) BatchCheck(ctx context.Context, authInfo types.AuthInfo, req types.BatchCheckRequest) (types.BatchCheckResponse, error) {
	ctx, span := c.tracer.Start(ctx, "ClientImpl.BatchCheck")
	defer span.End()

	// Validate the request
	if err := req.Validate(); err != nil {
		span.RecordError(err)
		return types.BatchCheckResponse{}, err
	}

	// Handle empty request
	if len(req.Checks) == 0 {
		return types.BatchCheckResponse{
			Results: make(map[string]types.BatchCheckResult),
		}, nil
	}

	if authInfo.GetSubject() == "" {
		span.RecordError(ErrMissingAuthInfo)
		return types.BatchCheckResponse{}, ErrMissingAuthInfo
	}

	// Validate namespace matches
	if !types.NamespaceMatches(authInfo.GetNamespace(), req.Namespace) {
		err := namespaceMismatchError(authInfo.GetNamespace(), req.Namespace)
		span.RecordError(err)
		return types.BatchCheckResponse{}, err
	}

	span.SetAttributes(attribute.String("subject", authInfo.GetSubject()))
	span.SetAttributes(attribute.String("namespace", req.Namespace))
	span.SetAttributes(attribute.Int("check_count", len(req.Checks)))
	span.SetAttributes(attribute.Bool("skip_cache", req.SkipCache))

	// Check service permissions for each item and determine which checks need to go to the AuthZ service
	results := make(map[string]types.BatchCheckResult, len(req.Checks))
	// Build the proto request
	protoChecks := make([]*authzv1.BatchCheckItem, 0, len(req.Checks))

	// Cache service permission results to avoid redundant checks for the same Group/Resource/Verb
	servicePermCache := make(map[string]ServiceEvaluationResult)

	for _, check := range req.Checks {
		// Use cached result if available for this Group/Resource/Verb combination
		permKey := check.Group + "/" + check.Resource + ":" + check.Verb
		checkServiceRes, cached := servicePermCache[permKey]
		if !cached {
			checkServiceRes = CheckServicePermissions(authInfo, check.Group, check.Resource, check.Verb)
			servicePermCache[permKey] = checkServiceRes
		}

		if checkServiceRes.ServiceCall {
			results[check.CorrelationID] = types.BatchCheckResult{Allowed: checkServiceRes.Allowed}
			continue
		}

		if !checkServiceRes.Allowed {
			results[check.CorrelationID] = types.BatchCheckResult{Allowed: false}
			continue
		}

		protoChecks = append(protoChecks, &authzv1.BatchCheckItem{
			CorrelationId:      check.CorrelationID,
			Verb:               check.Verb,
			Group:              check.Group,
			Resource:           check.Resource,
			Name:               check.Name,
			Subresource:        check.Subresource,
			Path:               check.Path,
			Folder:             check.Folder,
			FreshnessTimestamp: check.FreshnessTimestamp.UnixMilli(),
		})
	}

	span.SetAttributes(attribute.Int("authz_check_count", len(protoChecks)))

	// If all checks were resolved via service permissions, return early
	if len(protoChecks) == 0 {
		return types.BatchCheckResponse{
			Results: results,
		}, nil
	}

	protoReq := &authzv1.BatchCheckRequest{
		Subject:   authInfo.GetUID(),
		Namespace: req.Namespace,
		Checks:    protoChecks,
		Options: &authzv1.BatchCheckOptions{
			Skipcache: req.SkipCache,
		},
	}

	// Instantiate a new context for the request
	outCtx := newOutgoingContext(ctx)

	// Query the authz service
	resp, err := c.clientV1.BatchCheck(outCtx, protoReq)
	if err != nil {
		span.RecordError(err)
		return types.BatchCheckResponse{}, err
	}

	// Track which correlation IDs we sent to only process expected results
	sentIDs := make(map[string]struct{}, len(protoChecks))
	for _, check := range protoChecks {
		sentIDs[check.CorrelationId] = struct{}{}
	}

	for corrID, result := range resp.Results {
		// Only process results for checks we actually sent
		if _, sent := sentIDs[corrID]; !sent {
			continue
		}
		var resultErr error
		if result.Error != "" {
			resultErr = errors.New(result.Error)
		}
		results[corrID] = types.BatchCheckResult{
			Allowed: result.Allowed,
			Error:   resultErr,
		}
	}

	return types.BatchCheckResponse{
		Results: results,
	}, nil
}

// newOutgoingContext creates a new context that will be canceled when the input context is canceled.
func newOutgoingContext(ctx context.Context) context.Context {
	outCtx, cancel := context.WithCancel(context.Background())

	// Propagate the span into the new context
	spanContext := trace.SpanContextFromContext(ctx)
	if spanContext.IsValid() {
		outCtx = trace.ContextWithSpanContext(outCtx, spanContext)
	}

	go func() {
		select {
		case <-ctx.Done():
			cancel()
		case <-outCtx.Done():
			// exit
		}
	}()

	return outCtx
}

// -----
// CACHE
// -----

func checkCacheKey(subj string, req *types.CheckRequest, folder string) string {
	return fmt.Sprintf("check-%s-%s-%s-%s-%s-%s-%s-%s-%s", req.Namespace, subj, req.Group, req.Resource, req.Verb, req.Name, req.Subresource, req.Path, folder)
}

type checkCacheEntry struct {
	Allowed   bool
	Timestamp int64
}

func (c *ClientImpl) cacheCheck(ctx context.Context, key string, allowed bool, timestamp int64) error {
	ctx, span := c.tracer.Start(ctx, "ClientImpl.cacheCheck")
	defer span.End()

	entry := checkCacheEntry{Allowed: allowed, Timestamp: timestamp}
	buf := bytes.Buffer{}
	err := gob.NewEncoder(&buf).Encode(entry)
	if err != nil {
		return err
	}

	// Cache with default expiry
	return c.cache.Set(ctx, key, buf.Bytes(), cache.DefaultExpiration)
}

func (c *ClientImpl) getCachedCheck(ctx context.Context, key string) (bool, int64, error) {
	ctx, span := c.tracer.Start(ctx, "ClientImpl.getCachedCheck")
	defer span.End()

	data, err := c.cache.Get(ctx, key)
	if err != nil {
		return false, 0, err
	}

	var entry checkCacheEntry
	err = gob.NewDecoder(bytes.NewReader(data)).Decode(&entry)
	if err != nil {
		return false, 0, err
	}
	return entry.Allowed, entry.Timestamp, nil
}

func itemCheckerCacheKey(subj string, req *types.ListRequest) string {
	return fmt.Sprintf("list-%s-%s-%s-%s-%s-%s", req.Namespace, subj, req.Group, req.Resource, req.Verb, req.Subresource)
}

func (c *ClientImpl) cacheItemChecker(ctx context.Context, key string, checker *itemChecker) error {
	ctx, span := c.tracer.Start(ctx, "ClientImpl.cacheList")
	defer span.End()

	buf := bytes.Buffer{}
	err := gob.NewEncoder(&buf).Encode(checker)
	if err != nil {
		return err
	}

	// Cache with default expiry
	return c.cache.Set(ctx, key, buf.Bytes(), cache.DefaultExpiration)
}

func (c *ClientImpl) getCachedItemChecker(ctx context.Context, key string) (*itemChecker, error) {
	ctx, span := c.tracer.Start(ctx, "ClientImpl.getCachedList")
	defer span.End()

	data, err := c.cache.Get(ctx, key)
	if err != nil {
		return nil, err
	}

	resp := &itemChecker{}
	err = gob.NewDecoder(bytes.NewReader(data)).Decode(resp)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

var denyAllChecker = func(name, folder string) bool { return false }

func allowAllChecker(isServiceAccount bool) types.ItemChecker {
	return func(name, folder string) bool {
		if !isServiceAccount && (name == k6FolderUID || folder == k6FolderUID) {
			return false
		}

		return true
	}
}

type itemChecker struct {
	All       bool
	Items     map[string]bool
	Folders   map[string]bool
	Timestamp int64
}

func newItemChecker(resp *authzv1.ListResponse) *itemChecker {
	if resp == nil {
		return &itemChecker{Timestamp: time.Now().UnixMilli()}
	}

	// Ensure backward compatibility with older authz servers
	// that don't return a zookie
	if resp.Zookie == nil {
		resp.Zookie = &authzv1.Zookie{Timestamp: time.Now().UnixMilli()}
	}

	if resp.All {
		return &itemChecker{All: true, Timestamp: resp.Zookie.Timestamp}
	}

	res := &itemChecker{
		Items:     make(map[string]bool, len(resp.Items)),
		Folders:   make(map[string]bool, len(resp.Folders)),
		Timestamp: resp.Zookie.Timestamp,
	}
	for _, i := range resp.Items {
		res.Items[i] = true
	}
	for _, f := range resp.Folders {
		res.Folders[f] = true
	}
	return res
}

// fn generates a ItemChecker function that can check user access to items.
func (c *itemChecker) fn(authInfo types.AuthInfo) types.ItemChecker {
	idIsSvcAccount := types.IsIdentityType(authInfo.GetIdentityType(), types.TypeServiceAccount)
	if c.All {
		return allowAllChecker(idIsSvcAccount)
	}

	if len(c.Items) == 0 && len(c.Folders) == 0 {
		return denyAllChecker
	}

	return func(name, folder string) bool {
		if !idIsSvcAccount && (name == k6FolderUID || folder == k6FolderUID) {
			return false
		}
		return c.Items[name] || c.Folders[folder]
	}
}

func (c *itemChecker) Zookie() types.Zookie {
	return NewTimestampZookie(c.Timestamp)
}

// Zookie implementation based on a timestamp
type TimestampZookie struct {
	timestamp int64 // UnixMilli
}

// NewTimestampZookie creates a new TimestampZookie with the given timestamp in milliseconds.
func NewTimestampZookie(ts int64) *TimestampZookie {
	return &TimestampZookie{timestamp: ts}
}

func (t *TimestampZookie) IsFresherThan(d time.Time) bool {
	return t.timestamp > d.UnixMilli()
}

func namespaceMismatchError(a, b string) error {
	return fmt.Errorf("%w: got %s but expected %s", ErrNamespaceMismatch, a, b)
}
