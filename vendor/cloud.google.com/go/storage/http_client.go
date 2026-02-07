// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/iam/apiv1/iampb"
	"cloud.google.com/go/internal/optional"
	"cloud.google.com/go/internal/trace"
	"github.com/google/uuid"
	"github.com/googleapis/gax-go/v2/callctx"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/option/internaloption"
	raw "google.golang.org/api/storage/v1"
	htransport "google.golang.org/api/transport/http"
)

// httpStorageClient is the HTTP-JSON API implementation of the transport-agnostic
// storageClient interface.
type httpStorageClient struct {
	creds                      *auth.Credentials
	hc                         *http.Client
	xmlHost                    string
	raw                        *raw.Service
	scheme                     string
	settings                   *settings
	config                     *storageConfig
	dynamicReadReqStallTimeout *bucketDelayManager
}

// newHTTPStorageClient initializes a new storageClient that uses the HTTP-JSON
// Storage API.
func newHTTPStorageClient(ctx context.Context, opts ...storageOption) (storageClient, error) {
	s := initSettings(opts...)
	o := s.clientOption
	config := newStorageConfig(o...)

	var creds *auth.Credentials
	// In general, it is recommended to use raw.NewService instead of htransport.NewClient
	// since raw.NewService configures the correct default endpoints when initializing the
	// internal http client. However, in our case, "NewRangeReader" in reader.go needs to
	// access the http client directly to make requests, so we create the client manually
	// here so it can be re-used by both reader.go and raw.NewService. This means we need to
	// manually configure the default endpoint options on the http client. Furthermore, we
	// need to account for STORAGE_EMULATOR_HOST override when setting the default endpoints.
	if host := os.Getenv("STORAGE_EMULATOR_HOST"); host == "" {
		// Prepend default options to avoid overriding options passed by the user.
		o = append([]option.ClientOption{option.WithScopes(ScopeFullControl, "https://www.googleapis.com/auth/cloud-platform"), option.WithUserAgent(userAgent)}, o...)

		o = append(o, internaloption.WithDefaultEndpointTemplate("https://storage.UNIVERSE_DOMAIN/storage/v1/"),
			internaloption.WithDefaultMTLSEndpoint("https://storage.mtls.googleapis.com/storage/v1/"),
			internaloption.WithDefaultUniverseDomain("googleapis.com"),
		)
		// Don't error out here. The user may have passed in their own HTTP
		// client which does not auth with ADC or other common conventions.
		c, err := internaloption.AuthCreds(ctx, o)
		if err == nil {
			creds = c
			o = append(o, option.WithAuthCredentials(creds))
		}
	} else {
		var hostURL *url.URL

		if strings.Contains(host, "://") {
			h, err := url.Parse(host)
			if err != nil {
				return nil, err
			}
			hostURL = h
		} else {
			// Add scheme for user if not supplied in STORAGE_EMULATOR_HOST
			// URL is only parsed correctly if it has a scheme, so we build it ourselves
			hostURL = &url.URL{Scheme: "http", Host: host}
		}

		hostURL.Path = "storage/v1/"
		endpoint := hostURL.String()

		// Append the emulator host as default endpoint for the user
		o = append([]option.ClientOption{option.WithoutAuthentication()}, o...)

		o = append(o, internaloption.WithDefaultEndpointTemplate(endpoint))
		o = append(o, internaloption.WithDefaultMTLSEndpoint(endpoint))
	}
	s.clientOption = o

	// htransport selects the correct endpoint among WithEndpoint (user override), WithDefaultEndpointTemplate, and WithDefaultMTLSEndpoint.
	hc, ep, err := htransport.NewClient(ctx, s.clientOption...)
	if err != nil {
		return nil, fmt.Errorf("dialing: %w", err)
	}
	// RawService should be created with the chosen endpoint to take account of user override.
	rawService, err := raw.NewService(ctx, option.WithEndpoint(ep), option.WithHTTPClient(hc))
	if err != nil {
		return nil, fmt.Errorf("storage client: %w", err)
	}
	// Update xmlHost and scheme with the chosen endpoint.
	u, err := url.Parse(ep)
	if err != nil {
		return nil, fmt.Errorf("supplied endpoint %q is not valid: %w", ep, err)
	}

	var bd *bucketDelayManager
	if config.readStallTimeoutConfig != nil {
		drrstConfig := config.readStallTimeoutConfig
		bd, err = newBucketDelayManager(
			drrstConfig.TargetPercentile,
			getDynamicReadReqIncreaseRateFromEnv(),
			getDynamicReadReqInitialTimeoutSecFromEnv(drrstConfig.Min),
			drrstConfig.Min,
			defaultDynamicReqdReqMaxTimeout)
		if err != nil {
			return nil, fmt.Errorf("creating dynamic-delay: %w", err)
		}
	}

	return &httpStorageClient{
		creds:                      creds,
		hc:                         hc,
		xmlHost:                    u.Host,
		raw:                        rawService,
		scheme:                     u.Scheme,
		settings:                   s,
		config:                     &config,
		dynamicReadReqStallTimeout: bd,
	}, nil
}

func (c *httpStorageClient) Close() error {
	c.hc.CloseIdleConnections()
	return nil
}

// Top-level methods.

func (c *httpStorageClient) GetServiceAccount(ctx context.Context, project string, opts ...storageOption) (string, error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Projects.ServiceAccount.Get(project)
	var res *raw.ServiceAccount
	err := run(ctx, func(ctx context.Context) error {
		var err error
		res, err = call.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
	if err != nil {
		return "", err
	}
	return res.EmailAddress, nil
}

func (c *httpStorageClient) CreateBucket(ctx context.Context, project, bucket string, attrs *BucketAttrs, enableObjectRetention *bool, opts ...storageOption) (*BucketAttrs, error) {
	s := callSettings(c.settings, opts...)
	var bkt *raw.Bucket
	if attrs != nil {
		bkt = attrs.toRawBucket()
	} else {
		bkt = &raw.Bucket{}
	}
	bkt.Name = bucket
	// If there is lifecycle information but no location, explicitly set
	// the location. This is a GCS quirk/bug.
	if bkt.Location == "" && bkt.Lifecycle != nil {
		bkt.Location = "US"
	}
	req := c.raw.Buckets.Insert(project, bkt)
	if attrs != nil && attrs.PredefinedACL != "" {
		req.PredefinedAcl(attrs.PredefinedACL)
	}
	if attrs != nil && attrs.PredefinedDefaultObjectACL != "" {
		req.PredefinedDefaultObjectAcl(attrs.PredefinedDefaultObjectACL)
	}
	if enableObjectRetention != nil {
		req.EnableObjectRetention(*enableObjectRetention)
	}
	var battrs *BucketAttrs
	err := run(ctx, func(ctx context.Context) error {
		b, err := req.Context(ctx).Do()
		if err != nil {
			return err
		}
		battrs, err = newBucket(b)
		return err
	}, s.retry, s.idempotent)
	return battrs, err
}

func (c *httpStorageClient) ListBuckets(ctx context.Context, project string, opts ...storageOption) *BucketIterator {
	s := callSettings(c.settings, opts...)
	it := &BucketIterator{
		ctx:       ctx,
		projectID: project,
	}

	fetch := func(pageSize int, pageToken string) (token string, err error) {
		req := c.raw.Buckets.List(it.projectID)
		req.Projection("full")
		req.Prefix(it.Prefix)
		req.PageToken(pageToken)
		if pageSize > 0 {
			req.MaxResults(int64(pageSize))
		}
		var resp *raw.Buckets
		err = run(it.ctx, func(ctx context.Context) error {
			resp, err = req.Context(ctx).Do()
			return err
		}, s.retry, s.idempotent)
		if err != nil {
			return "", err
		}
		for _, item := range resp.Items {
			b, err := newBucket(item)
			if err != nil {
				return "", err
			}
			it.buckets = append(it.buckets, b)
		}
		return resp.NextPageToken, nil
	}

	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		fetch,
		func() int { return len(it.buckets) },
		func() interface{} { b := it.buckets; it.buckets = nil; return b })

	return it
}

// Bucket methods.

func (c *httpStorageClient) DeleteBucket(ctx context.Context, bucket string, conds *BucketConditions, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	req := c.raw.Buckets.Delete(bucket)
	if err := applyBucketConds("httpStorageClient.DeleteBucket", conds, req); err != nil {
		return err
	}
	if s.userProject != "" {
		req.UserProject(s.userProject)
	}

	return run(ctx, func(ctx context.Context) error { return req.Context(ctx).Do() }, s.retry, s.idempotent)
}

func (c *httpStorageClient) GetBucket(ctx context.Context, bucket string, conds *BucketConditions, opts ...storageOption) (*BucketAttrs, error) {
	s := callSettings(c.settings, opts...)
	req := c.raw.Buckets.Get(bucket).Projection("full")
	err := applyBucketConds("httpStorageClient.GetBucket", conds, req)
	if err != nil {
		return nil, err
	}
	if s.userProject != "" {
		req.UserProject(s.userProject)
	}

	var resp *raw.Bucket
	err = run(ctx, func(ctx context.Context) error {
		resp, err = req.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)

	if err != nil {
		return nil, formatBucketError(err)
	}
	return newBucket(resp)
}
func (c *httpStorageClient) UpdateBucket(ctx context.Context, bucket string, uattrs *BucketAttrsToUpdate, conds *BucketConditions, opts ...storageOption) (*BucketAttrs, error) {
	s := callSettings(c.settings, opts...)
	rb := uattrs.toRawBucket()
	req := c.raw.Buckets.Patch(bucket, rb).Projection("full")
	err := applyBucketConds("httpStorageClient.UpdateBucket", conds, req)
	if err != nil {
		return nil, err
	}
	if s.userProject != "" {
		req.UserProject(s.userProject)
	}
	if uattrs != nil && uattrs.PredefinedACL != "" {
		req.PredefinedAcl(uattrs.PredefinedACL)
	}
	if uattrs != nil && uattrs.PredefinedDefaultObjectACL != "" {
		req.PredefinedDefaultObjectAcl(uattrs.PredefinedDefaultObjectACL)
	}

	var rawBucket *raw.Bucket
	err = run(ctx, func(ctx context.Context) error {
		rawBucket, err = req.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
	if err != nil {
		return nil, err
	}
	return newBucket(rawBucket)
}

func (c *httpStorageClient) LockBucketRetentionPolicy(ctx context.Context, bucket string, conds *BucketConditions, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)

	var metageneration int64
	if conds != nil {
		metageneration = conds.MetagenerationMatch
	}
	req := c.raw.Buckets.LockRetentionPolicy(bucket, metageneration)

	return run(ctx, func(ctx context.Context) error {
		_, err := req.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
}
func (c *httpStorageClient) ListObjects(ctx context.Context, bucket string, q *Query, opts ...storageOption) *ObjectIterator {
	s := callSettings(c.settings, opts...)
	it := &ObjectIterator{
		ctx: ctx,
	}
	if q != nil {
		it.query = *q
	}
	fetch := func(pageSize int, pageToken string) (string, error) {
		var err error
		// Add trace span around List API call within the fetch.
		ctx, _ = startSpan(ctx, "httpStorageClient.ObjectsListCall")
		defer func() { endSpan(ctx, err) }()
		req := c.raw.Objects.List(bucket)
		if it.query.SoftDeleted {
			req.SoftDeleted(it.query.SoftDeleted)
		}
		projection := it.query.Projection
		if projection == ProjectionDefault {
			projection = ProjectionFull
		}
		req.Projection(projection.String())
		req.Delimiter(it.query.Delimiter)
		req.Prefix(it.query.Prefix)
		req.StartOffset(it.query.StartOffset)
		req.EndOffset(it.query.EndOffset)
		req.Versions(it.query.Versions)
		req.IncludeTrailingDelimiter(it.query.IncludeTrailingDelimiter)
		req.MatchGlob(it.query.MatchGlob)
		req.IncludeFoldersAsPrefixes(it.query.IncludeFoldersAsPrefixes)
		if selection := it.query.toFieldSelection(); selection != "" {
			req.Fields("nextPageToken", googleapi.Field(selection))
		}
		req.PageToken(pageToken)
		if s.userProject != "" {
			req.UserProject(s.userProject)
		}
		if pageSize > 0 {
			req.MaxResults(int64(pageSize))
		}
		var resp *raw.Objects
		err = run(it.ctx, func(ctx context.Context) error {
			resp, err = req.Context(ctx).Do()
			return err
		}, s.retry, s.idempotent)
		if err != nil {
			return "", formatBucketError(err)
		}
		for _, item := range resp.Items {
			it.items = append(it.items, newObject(item))
		}
		for _, prefix := range resp.Prefixes {
			it.items = append(it.items, &ObjectAttrs{Prefix: prefix})
		}
		return resp.NextPageToken, nil
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		fetch,
		func() int { return len(it.items) },
		func() interface{} { b := it.items; it.items = nil; return b })

	return it
}

// Object metadata methods.

func (c *httpStorageClient) DeleteObject(ctx context.Context, bucket, object string, gen int64, conds *Conditions, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	req := c.raw.Objects.Delete(bucket, object).Context(ctx)
	if err := applyConds("Delete", gen, conds, req); err != nil {
		return err
	}
	if s.userProject != "" {
		req.UserProject(s.userProject)
	}
	err := run(ctx, func(ctx context.Context) error { return req.Context(ctx).Do() }, s.retry, s.idempotent)
	return formatObjectErr(err)
}

func (c *httpStorageClient) GetObject(ctx context.Context, params *getObjectParams, opts ...storageOption) (*ObjectAttrs, error) {
	s := callSettings(c.settings, opts...)
	req := c.raw.Objects.Get(params.bucket, params.object).Projection("full").Context(ctx)
	if err := applyConds("Attrs", params.gen, params.conds, req); err != nil {
		return nil, err
	}
	if s.userProject != "" {
		req.UserProject(s.userProject)
	}
	if err := setEncryptionHeaders(req.Header(), params.encryptionKey, false); err != nil {
		return nil, err
	}
	if params.softDeleted {
		req.SoftDeleted(params.softDeleted)
	}

	var obj *raw.Object
	var err error
	err = run(ctx, func(ctx context.Context) error {
		obj, err = req.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
	if err != nil {
		return nil, formatObjectErr(err)
	}
	return newObject(obj), nil
}

func (c *httpStorageClient) UpdateObject(ctx context.Context, params *updateObjectParams, opts ...storageOption) (*ObjectAttrs, error) {
	uattrs := params.uattrs
	s := callSettings(c.settings, opts...)

	var attrs ObjectAttrs
	// Lists of fields to send, and set to null, in the JSON.
	var forceSendFields, nullFields []string
	if uattrs.ContentType != nil {
		attrs.ContentType = optional.ToString(uattrs.ContentType)
		// For ContentType, sending the empty string is a no-op.
		// Instead we send a null.
		if attrs.ContentType == "" {
			nullFields = append(nullFields, "ContentType")
		} else {
			forceSendFields = append(forceSendFields, "ContentType")
		}
	}
	if uattrs.ContentLanguage != nil {
		attrs.ContentLanguage = optional.ToString(uattrs.ContentLanguage)
		// For ContentLanguage it's an error to send the empty string.
		// Instead we send a null.
		if attrs.ContentLanguage == "" {
			nullFields = append(nullFields, "ContentLanguage")
		} else {
			forceSendFields = append(forceSendFields, "ContentLanguage")
		}
	}
	if uattrs.ContentEncoding != nil {
		attrs.ContentEncoding = optional.ToString(uattrs.ContentEncoding)
		forceSendFields = append(forceSendFields, "ContentEncoding")
	}
	if uattrs.ContentDisposition != nil {
		attrs.ContentDisposition = optional.ToString(uattrs.ContentDisposition)
		forceSendFields = append(forceSendFields, "ContentDisposition")
	}
	if uattrs.CacheControl != nil {
		attrs.CacheControl = optional.ToString(uattrs.CacheControl)
		forceSendFields = append(forceSendFields, "CacheControl")
	}
	if uattrs.EventBasedHold != nil {
		attrs.EventBasedHold = optional.ToBool(uattrs.EventBasedHold)
		forceSendFields = append(forceSendFields, "EventBasedHold")
	}
	if uattrs.TemporaryHold != nil {
		attrs.TemporaryHold = optional.ToBool(uattrs.TemporaryHold)
		forceSendFields = append(forceSendFields, "TemporaryHold")
	}
	if !uattrs.CustomTime.IsZero() {
		attrs.CustomTime = uattrs.CustomTime
		forceSendFields = append(forceSendFields, "CustomTime")
	}
	if uattrs.Metadata != nil {
		attrs.Metadata = uattrs.Metadata
		if len(attrs.Metadata) == 0 {
			// Sending the empty map is a no-op. We send null instead.
			nullFields = append(nullFields, "Metadata")
		} else {
			forceSendFields = append(forceSendFields, "Metadata")
		}
	}
	if uattrs.ACL != nil {
		attrs.ACL = uattrs.ACL
		// It's an error to attempt to delete the ACL, so
		// we don't append to nullFields here.
		forceSendFields = append(forceSendFields, "Acl")
	}
	if uattrs.Retention != nil {
		// For ObjectRetention it's an error to send empty fields.
		// Instead we send a null as the user's intention is to remove.
		if uattrs.Retention.Mode == "" && uattrs.Retention.RetainUntil.IsZero() {
			nullFields = append(nullFields, "Retention")
		} else {
			attrs.Retention = uattrs.Retention
			forceSendFields = append(forceSendFields, "Retention")
		}
	}
	rawObj := attrs.toRawObject(params.bucket)
	rawObj.ForceSendFields = forceSendFields
	rawObj.NullFields = nullFields
	call := c.raw.Objects.Patch(params.bucket, params.object, rawObj).Projection("full")
	if err := applyConds("Update", params.gen, params.conds, call); err != nil {
		return nil, err
	}
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}
	if uattrs.PredefinedACL != "" {
		call.PredefinedAcl(uattrs.PredefinedACL)
	}
	if err := setEncryptionHeaders(call.Header(), params.encryptionKey, false); err != nil {
		return nil, err
	}

	if params.overrideRetention != nil {
		call.OverrideUnlockedRetention(*params.overrideRetention)
	}

	var obj *raw.Object
	var err error
	err = run(ctx, func(ctx context.Context) error { obj, err = call.Context(ctx).Do(); return err }, s.retry, s.idempotent)
	if err != nil {
		return nil, formatObjectErr(err)
	}
	return newObject(obj), nil
}

func (c *httpStorageClient) RestoreObject(ctx context.Context, params *restoreObjectParams, opts ...storageOption) (*ObjectAttrs, error) {
	s := callSettings(c.settings, opts...)
	req := c.raw.Objects.Restore(params.bucket, params.object, params.gen).Context(ctx)
	// Do not set the generation here since it's not an optional condition; it gets set above.
	if err := applyConds("RestoreObject", defaultGen, params.conds, req); err != nil {
		return nil, err
	}
	if s.userProject != "" {
		req.UserProject(s.userProject)
	}
	if params.copySourceACL {
		req.CopySourceAcl(params.copySourceACL)
	}
	if err := setEncryptionHeaders(req.Header(), params.encryptionKey, false); err != nil {
		return nil, err
	}

	var obj *raw.Object
	var err error
	err = run(ctx, func(ctx context.Context) error { obj, err = req.Context(ctx).Do(); return err }, s.retry, s.idempotent)
	if err != nil {
		return nil, formatObjectErr(err)
	}
	return newObject(obj), err
}

func (c *httpStorageClient) MoveObject(ctx context.Context, params *moveObjectParams, opts ...storageOption) (*ObjectAttrs, error) {
	s := callSettings(c.settings, opts...)
	req := c.raw.Objects.Move(params.bucket, params.srcObject, params.dstObject).Context(ctx)
	if err := applyConds("MoveObjectDestination", defaultGen, params.dstConds, req); err != nil {
		return nil, err
	}
	if err := applySourceConds("MoveObjectSource", defaultGen, params.srcConds, req); err != nil {
		return nil, err
	}
	if s.userProject != "" {
		req.UserProject(s.userProject)
	}
	if err := setEncryptionHeaders(req.Header(), params.encryptionKey, false); err != nil {
		return nil, err
	}
	var obj *raw.Object
	var err error
	err = run(ctx, func(ctx context.Context) error { obj, err = req.Context(ctx).Do(); return err }, s.retry, s.idempotent)
	if err != nil {
		return nil, formatObjectErr(err)
	}
	return newObject(obj), err
}

// Default Object ACL methods.

func (c *httpStorageClient) DeleteDefaultObjectACL(ctx context.Context, bucket string, entity ACLEntity, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	req := c.raw.DefaultObjectAccessControls.Delete(bucket, string(entity))
	configureACLCall(ctx, s.userProject, req)
	return run(ctx, func(ctx context.Context) error { return req.Context(ctx).Do() }, s.retry, s.idempotent)
}

func (c *httpStorageClient) ListDefaultObjectACLs(ctx context.Context, bucket string, opts ...storageOption) ([]ACLRule, error) {
	s := callSettings(c.settings, opts...)
	var acls *raw.ObjectAccessControls
	var err error
	req := c.raw.DefaultObjectAccessControls.List(bucket)
	configureACLCall(ctx, s.userProject, req)
	err = run(ctx, func(ctx context.Context) error {
		acls, err = req.Context(ctx).Do()
		return err
	}, s.retry, true)
	if err != nil {
		return nil, err
	}
	return toObjectACLRules(acls.Items), nil
}
func (c *httpStorageClient) UpdateDefaultObjectACL(ctx context.Context, bucket string, entity ACLEntity, role ACLRole, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	type setRequest interface {
		Do(opts ...googleapi.CallOption) (*raw.ObjectAccessControl, error)
		Header() http.Header
	}
	acl := &raw.ObjectAccessControl{
		Bucket: bucket,
		Entity: string(entity),
		Role:   string(role),
	}
	var err error
	req := c.raw.DefaultObjectAccessControls.Update(bucket, string(entity), acl)
	configureACLCall(ctx, s.userProject, req)
	return run(ctx, func(ctx context.Context) error {
		_, err = req.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
}

// Bucket ACL methods.

func (c *httpStorageClient) DeleteBucketACL(ctx context.Context, bucket string, entity ACLEntity, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	req := c.raw.BucketAccessControls.Delete(bucket, string(entity))
	configureACLCall(ctx, s.userProject, req)
	return run(ctx, func(ctx context.Context) error { return req.Context(ctx).Do() }, s.retry, s.idempotent)
}

func (c *httpStorageClient) ListBucketACLs(ctx context.Context, bucket string, opts ...storageOption) ([]ACLRule, error) {
	s := callSettings(c.settings, opts...)
	var acls *raw.BucketAccessControls
	var err error
	req := c.raw.BucketAccessControls.List(bucket)
	configureACLCall(ctx, s.userProject, req)
	err = run(ctx, func(ctx context.Context) error {
		acls, err = req.Context(ctx).Do()
		return err
	}, s.retry, true)
	if err != nil {
		return nil, err
	}
	return toBucketACLRules(acls.Items), nil
}

func (c *httpStorageClient) UpdateBucketACL(ctx context.Context, bucket string, entity ACLEntity, role ACLRole, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	acl := &raw.BucketAccessControl{
		Bucket: bucket,
		Entity: string(entity),
		Role:   string(role),
	}
	req := c.raw.BucketAccessControls.Update(bucket, string(entity), acl)
	configureACLCall(ctx, s.userProject, req)
	var err error
	return run(ctx, func(ctx context.Context) error {
		_, err = req.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
}

// configureACLCall sets the context and user project on the apiary library call.
// This will panic if the call does not have the correct methods.
func configureACLCall(ctx context.Context, userProject string, call interface{ Header() http.Header }) {
	vc := reflect.ValueOf(call)
	vc.MethodByName("Context").Call([]reflect.Value{reflect.ValueOf(ctx)})
	if userProject != "" {
		vc.MethodByName("UserProject").Call([]reflect.Value{reflect.ValueOf(userProject)})
	}
}

// Object ACL methods.

func (c *httpStorageClient) DeleteObjectACL(ctx context.Context, bucket, object string, entity ACLEntity, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	req := c.raw.ObjectAccessControls.Delete(bucket, object, string(entity))
	configureACLCall(ctx, s.userProject, req)
	return run(ctx, func(ctx context.Context) error { return req.Context(ctx).Do() }, s.retry, s.idempotent)
}

// ListObjectACLs retrieves object ACL entries. By default, it operates on the latest generation of this object.
// Selecting a specific generation of this object is not currently supported by the client.
func (c *httpStorageClient) ListObjectACLs(ctx context.Context, bucket, object string, opts ...storageOption) ([]ACLRule, error) {
	s := callSettings(c.settings, opts...)
	var acls *raw.ObjectAccessControls
	var err error
	req := c.raw.ObjectAccessControls.List(bucket, object)
	configureACLCall(ctx, s.userProject, req)
	err = run(ctx, func(ctx context.Context) error {
		acls, err = req.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
	if err != nil {
		return nil, err
	}
	return toObjectACLRules(acls.Items), nil
}

func (c *httpStorageClient) UpdateObjectACL(ctx context.Context, bucket, object string, entity ACLEntity, role ACLRole, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	type setRequest interface {
		Do(opts ...googleapi.CallOption) (*raw.ObjectAccessControl, error)
		Header() http.Header
	}

	acl := &raw.ObjectAccessControl{
		Bucket: bucket,
		Entity: string(entity),
		Role:   string(role),
	}
	var err error
	req := c.raw.ObjectAccessControls.Update(bucket, object, string(entity), acl)
	configureACLCall(ctx, s.userProject, req)
	return run(ctx, func(ctx context.Context) error {
		_, err = req.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
}

// Media operations.

func (c *httpStorageClient) ComposeObject(ctx context.Context, req *composeObjectRequest, opts ...storageOption) (*ObjectAttrs, error) {
	s := callSettings(c.settings, opts...)
	rawReq := &raw.ComposeRequest{}
	// Compose requires a non-empty Destination, so we always set it,
	// even if the caller-provided ObjectAttrs is the zero value.
	rawReq.Destination = req.dstObject.attrs.toRawObject(req.dstBucket)
	if req.sendCRC32C {
		rawReq.Destination.Crc32c = encodeUint32(req.dstObject.attrs.CRC32C)
	}
	for _, src := range req.srcs {
		srcObj := &raw.ComposeRequestSourceObjects{
			Name: src.name,
		}
		if err := applyConds("ComposeFrom source", src.gen, src.conds, composeSourceObj{srcObj}); err != nil {
			return nil, err
		}
		rawReq.SourceObjects = append(rawReq.SourceObjects, srcObj)
	}

	call := c.raw.Objects.Compose(req.dstBucket, req.dstObject.name, rawReq)
	if err := applyConds("ComposeFrom destination", defaultGen, req.dstObject.conds, call); err != nil {
		return nil, err
	}
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}
	if req.predefinedACL != "" {
		call.DestinationPredefinedAcl(req.predefinedACL)
	}
	if err := setEncryptionHeaders(call.Header(), req.dstObject.encryptionKey, false); err != nil {
		return nil, err
	}
	var obj *raw.Object

	var err error
	retryCall := func(ctx context.Context) error { obj, err = call.Context(ctx).Do(); return err }

	if err := run(ctx, retryCall, s.retry, s.idempotent); err != nil {
		return nil, formatObjectErr(err)
	}
	return newObject(obj), nil
}
func (c *httpStorageClient) RewriteObject(ctx context.Context, req *rewriteObjectRequest, opts ...storageOption) (*rewriteObjectResponse, error) {
	s := callSettings(c.settings, opts...)
	rawObject := req.dstObject.attrs.toRawObject("")
	call := c.raw.Objects.Rewrite(req.srcObject.bucket, req.srcObject.name, req.dstObject.bucket, req.dstObject.name, rawObject)

	call.Projection("full")
	if req.token != "" {
		call.RewriteToken(req.token)
	}
	if req.dstObject.keyName != "" {
		call.DestinationKmsKeyName(req.dstObject.keyName)
	}
	if req.predefinedACL != "" {
		call.DestinationPredefinedAcl(req.predefinedACL)
	}
	if err := applyConds("Copy destination", defaultGen, req.dstObject.conds, call); err != nil {
		return nil, err
	}
	if err := applySourceConds("Copy source", req.srcObject.gen, req.srcObject.conds, call); err != nil {
		return nil, err
	}
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}
	// Set destination encryption headers.
	if err := setEncryptionHeaders(call.Header(), req.dstObject.encryptionKey, false); err != nil {
		return nil, err
	}
	// Set source encryption headers.
	if err := setEncryptionHeaders(call.Header(), req.srcObject.encryptionKey, true); err != nil {
		return nil, err
	}

	if req.maxBytesRewrittenPerCall != 0 {
		call.MaxBytesRewrittenPerCall(req.maxBytesRewrittenPerCall)
	}

	var res *raw.RewriteResponse
	var err error

	retryCall := func(ctx context.Context) error { res, err = call.Context(ctx).Do(); return err }

	if err := run(ctx, retryCall, s.retry, s.idempotent); err != nil {
		return nil, formatObjectErr(err)
	}

	r := &rewriteObjectResponse{
		done:     res.Done,
		written:  res.TotalBytesRewritten,
		size:     res.ObjectSize,
		token:    res.RewriteToken,
		resource: newObject(res.Resource),
	}

	return r, nil
}

// NewMultiRangeDownloader is not supported by http client.
func (c *httpStorageClient) NewMultiRangeDownloader(ctx context.Context, params *newMultiRangeDownloaderParams, opts ...storageOption) (mr *MultiRangeDownloader, err error) {
	return nil, errMethodNotSupported
}

func (c *httpStorageClient) NewRangeReader(ctx context.Context, params *newRangeReaderParams, opts ...storageOption) (r *Reader, err error) {
	ctx = trace.StartSpan(ctx, "cloud.google.com/go/storage.httpStorageClient.NewRangeReader")
	defer func() { trace.EndSpan(ctx, err) }()

	s := callSettings(c.settings, opts...)

	if c.config.useJSONforReads {
		return c.newRangeReaderJSON(ctx, params, s)
	}
	return c.newRangeReaderXML(ctx, params, s)
}

func (c *httpStorageClient) newRangeReaderXML(ctx context.Context, params *newRangeReaderParams, s *settings) (r *Reader, err error) {
	requestID := uuid.New()
	u := &url.URL{
		Scheme:  c.scheme,
		Host:    c.xmlHost,
		Path:    fmt.Sprintf("/%s/%s", params.bucket, params.object),
		RawPath: fmt.Sprintf("/%s/%s", params.bucket, url.PathEscape(params.object)),
	}
	verb := "GET"
	if params.length == 0 {
		verb = "HEAD"
	}
	req, err := http.NewRequest(verb, u.String(), nil)
	if err != nil {
		return nil, err
	}

	if s.userProject != "" {
		req.Header.Set("X-Goog-User-Project", s.userProject)
	}

	if err := setRangeReaderHeaders(req.Header, params); err != nil {
		return nil, err
	}

	reopen := readerReopen(ctx, req.Header, params, s,
		func(ctx context.Context) (*http.Response, error) {
			setHeadersFromCtx(ctx, req.Header)

			if c.dynamicReadReqStallTimeout == nil {
				return c.hc.Do(req.WithContext(ctx))
			}

			cancelCtx, cancel := context.WithCancel(ctx)
			var (
				res *http.Response
				err error
			)

			done := make(chan bool)
			go func() {
				reqStartTime := time.Now()
				res, err = c.hc.Do(req.WithContext(cancelCtx))
				if err == nil {
					reqLatency := time.Since(reqStartTime)
					c.dynamicReadReqStallTimeout.update(params.bucket, reqLatency)
				} else if errors.Is(err, context.Canceled) {
					// context.Canceled means operation took more than current dynamicTimeout,
					// hence should be increased.
					c.dynamicReadReqStallTimeout.increase(params.bucket)
				}
				done <- true
			}()

			// Wait until stall timeout or request is successful.
			stallTimeout := c.dynamicReadReqStallTimeout.getValue(params.bucket)
			timer := time.After(stallTimeout)
			select {
			case <-timer:
				log.Printf("[%s] stalled read-req cancelled after %fs", requestID, stallTimeout.Seconds())
				cancel()
				<-done
				if res != nil && res.Body != nil {
					res.Body.Close()
				}
				return res, context.DeadlineExceeded
			case <-done:
				cancel = nil
			}
			return res, err
		},
		func() error { return setConditionsHeaders(req.Header, params.conds) },
		func() { req.URL.RawQuery = fmt.Sprintf("generation=%d", params.gen) })

	res, err := reopen(0)
	if err != nil {
		return nil, err
	}
	return parseReadResponse(res, params, reopen)
}

func (c *httpStorageClient) newRangeReaderJSON(ctx context.Context, params *newRangeReaderParams, s *settings) (r *Reader, err error) {
	call := c.raw.Objects.Get(params.bucket, params.object)

	call.Projection("full")

	if s.userProject != "" {
		call.UserProject(s.userProject)
	}

	if err := setRangeReaderHeaders(call.Header(), params); err != nil {
		return nil, err
	}

	reopen := readerReopen(ctx, call.Header(), params, s, func(ctx context.Context) (*http.Response, error) { return call.Context(ctx).Download() },
		func() error { return applyConds("NewReader", params.gen, params.conds, call) },
		func() { call.Generation(params.gen) })

	res, err := reopen(0)
	if err != nil {
		return nil, err
	}
	return parseReadResponse(res, params, reopen)
}

func (c *httpStorageClient) OpenWriter(params *openWriterParams, opts ...storageOption) (*io.PipeWriter, error) {
	if params.append {
		return nil, errors.New("storage: append not supported on HTTP Client; use gRPC")
	}

	s := callSettings(c.settings, opts...)
	errorf := params.setError
	setObj := params.setObj
	progress := params.progress
	attrs := params.attrs
	params.setFlush(func() (int64, error) {
		return 0, errors.New("Writer.Flush is only supported for gRPC-based clients")
	})

	mediaOpts := []googleapi.MediaOption{
		googleapi.ChunkSize(params.chunkSize),
	}
	if c := attrs.ContentType; c != "" || params.forceEmptyContentType {
		mediaOpts = append(mediaOpts, googleapi.ContentType(c))
	}
	if params.chunkRetryDeadline != 0 {
		mediaOpts = append(mediaOpts, googleapi.ChunkRetryDeadline(params.chunkRetryDeadline))
	}
	if params.chunkTransferTimeout != 0 {
		mediaOpts = append(mediaOpts, googleapi.ChunkTransferTimeout(params.chunkTransferTimeout))
	}

	pr, pw := io.Pipe()

	go func() {
		defer close(params.donec)

		rawObj := attrs.toRawObject(params.bucket)
		if params.sendCRC32C {
			rawObj.Crc32c = encodeUint32(attrs.CRC32C)
		}
		if attrs.MD5 != nil {
			rawObj.Md5Hash = base64.StdEncoding.EncodeToString(attrs.MD5)
		}
		call := c.raw.Objects.Insert(params.bucket, rawObj).
			Media(pr, mediaOpts...).
			Projection("full").
			Context(params.ctx).
			Name(params.attrs.Name)
		call.ProgressUpdater(func(n, _ int64) { progress(n) })

		if attrs.KMSKeyName != "" {
			call.KmsKeyName(attrs.KMSKeyName)
		}
		if attrs.PredefinedACL != "" {
			call.PredefinedAcl(attrs.PredefinedACL)
		}
		if err := setEncryptionHeaders(call.Header(), params.encryptionKey, false); err != nil {
			errorf(err)
			pr.CloseWithError(err)
			return
		}
		var resp *raw.Object
		err := applyConds("NewWriter", defaultGen, params.conds, call)
		if err == nil {
			if s.userProject != "" {
				call.UserProject(s.userProject)
			}
			// TODO(tritone): Remove this code when Uploads begin to support
			// retry attempt header injection with "client header" injection.
			setClientHeader(call.Header())

			// The internals that perform call.Do automatically retry both the initial
			// call to set up the upload as well as calls to upload individual chunks
			// for a resumable upload (as long as the chunk size is non-zero). Hence
			// there is no need to add retries here.

			// Retry only when the operation is idempotent or the retry policy is RetryAlways.
			var useRetry bool
			if (s.retry == nil || s.retry.policy == RetryIdempotent) && s.idempotent {
				useRetry = true
			} else if s.retry != nil && s.retry.policy == RetryAlways {
				useRetry = true
			}
			if useRetry {
				if s.retry != nil {
					call.WithRetry(s.retry.backoff, s.retry.shouldRetry)
				} else {
					call.WithRetry(nil, nil)
				}
			}
			resp, err = call.Do()
		}
		if err != nil {
			errorf(err)
			pr.CloseWithError(err)
			return
		}
		setObj(newObject(resp))
	}()

	return pw, nil
}

// IAM methods.

func (c *httpStorageClient) GetIamPolicy(ctx context.Context, resource string, version int32, opts ...storageOption) (*iampb.Policy, error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Buckets.GetIamPolicy(resource).OptionsRequestedPolicyVersion(int64(version))
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}
	var rp *raw.Policy
	err := run(ctx, func(ctx context.Context) error {
		var err error
		rp, err = call.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
	if err != nil {
		return nil, err
	}
	return iamFromStoragePolicy(rp), nil
}

func (c *httpStorageClient) SetIamPolicy(ctx context.Context, resource string, policy *iampb.Policy, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)

	rp := iamToStoragePolicy(policy)
	call := c.raw.Buckets.SetIamPolicy(resource, rp)
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}

	return run(ctx, func(ctx context.Context) error {
		_, err := call.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
}

func (c *httpStorageClient) TestIamPermissions(ctx context.Context, resource string, permissions []string, opts ...storageOption) ([]string, error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Buckets.TestIamPermissions(resource, permissions)
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}
	var res *raw.TestIamPermissionsResponse
	err := run(ctx, func(ctx context.Context) error {
		var err error
		res, err = call.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
	if err != nil {
		return nil, err
	}
	return res.Permissions, nil
}

// HMAC Key methods.

func (c *httpStorageClient) GetHMACKey(ctx context.Context, project, accessID string, opts ...storageOption) (*HMACKey, error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Projects.HmacKeys.Get(project, accessID)
	if s.userProject != "" {
		call = call.UserProject(s.userProject)
	}

	var metadata *raw.HmacKeyMetadata
	var err error
	if err := run(ctx, func(ctx context.Context) error {
		metadata, err = call.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent); err != nil {
		return nil, err
	}
	hk := &raw.HmacKey{
		Metadata: metadata,
	}
	return toHMACKeyFromRaw(hk, false)
}

func (c *httpStorageClient) ListHMACKeys(ctx context.Context, project, serviceAccountEmail string, showDeletedKeys bool, opts ...storageOption) *HMACKeysIterator {
	s := callSettings(c.settings, opts...)
	it := &HMACKeysIterator{
		ctx:       ctx,
		raw:       c.raw.Projects.HmacKeys,
		projectID: project,
		retry:     s.retry,
	}
	fetch := func(pageSize int, pageToken string) (token string, err error) {
		call := c.raw.Projects.HmacKeys.List(project)
		if pageToken != "" {
			call = call.PageToken(pageToken)
		}
		if pageSize > 0 {
			call = call.MaxResults(int64(pageSize))
		}
		if showDeletedKeys {
			call = call.ShowDeletedKeys(true)
		}
		if s.userProject != "" {
			call = call.UserProject(s.userProject)
		}
		if serviceAccountEmail != "" {
			call = call.ServiceAccountEmail(serviceAccountEmail)
		}

		var resp *raw.HmacKeysMetadata
		err = run(it.ctx, func(ctx context.Context) error {
			resp, err = call.Context(ctx).Do()
			return err
		}, s.retry, s.idempotent)
		if err != nil {
			return "", err
		}

		for _, metadata := range resp.Items {
			hk := &raw.HmacKey{
				Metadata: metadata,
			}
			hkey, err := toHMACKeyFromRaw(hk, true)
			if err != nil {
				return "", err
			}
			it.hmacKeys = append(it.hmacKeys, hkey)
		}
		return resp.NextPageToken, nil
	}

	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		fetch,
		func() int { return len(it.hmacKeys) - it.index },
		func() interface{} {
			prev := it.hmacKeys
			it.hmacKeys = it.hmacKeys[:0]
			it.index = 0
			return prev
		})
	return it
}

func (c *httpStorageClient) UpdateHMACKey(ctx context.Context, project, serviceAccountEmail, accessID string, attrs *HMACKeyAttrsToUpdate, opts ...storageOption) (*HMACKey, error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Projects.HmacKeys.Update(project, accessID, &raw.HmacKeyMetadata{
		Etag:  attrs.Etag,
		State: string(attrs.State),
	})
	if s.userProject != "" {
		call = call.UserProject(s.userProject)
	}

	var metadata *raw.HmacKeyMetadata
	var err error
	if err := run(ctx, func(ctx context.Context) error {
		metadata, err = call.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent); err != nil {
		return nil, err
	}
	hk := &raw.HmacKey{
		Metadata: metadata,
	}
	return toHMACKeyFromRaw(hk, false)
}

func (c *httpStorageClient) CreateHMACKey(ctx context.Context, project, serviceAccountEmail string, opts ...storageOption) (*HMACKey, error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Projects.HmacKeys.Create(project, serviceAccountEmail)
	if s.userProject != "" {
		call = call.UserProject(s.userProject)
	}

	var hk *raw.HmacKey
	if err := run(ctx, func(ctx context.Context) error {
		h, err := call.Context(ctx).Do()
		hk = h
		return err
	}, s.retry, s.idempotent); err != nil {
		return nil, err
	}
	return toHMACKeyFromRaw(hk, true)
}

func (c *httpStorageClient) DeleteHMACKey(ctx context.Context, project string, accessID string, opts ...storageOption) error {
	s := callSettings(c.settings, opts...)
	call := c.raw.Projects.HmacKeys.Delete(project, accessID)
	if s.userProject != "" {
		call = call.UserProject(s.userProject)
	}
	return run(ctx, func(ctx context.Context) error {
		return call.Context(ctx).Do()
	}, s.retry, s.idempotent)
}

// Notification methods.

// ListNotifications returns all the Notifications configured for this bucket, as a map indexed by notification ID.
//
// Note: This API does not support pagination. However, entity limits cap the number of notifications on a single bucket,
// so all results will be returned in the first response. See https://cloud.google.com/storage/quotas#buckets.
func (c *httpStorageClient) ListNotifications(ctx context.Context, bucket string, opts ...storageOption) (n map[string]*Notification, err error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Notifications.List(bucket)
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}
	var res *raw.Notifications
	err = run(ctx, func(ctx context.Context) error {
		res, err = call.Context(ctx).Do()
		return err
	}, s.retry, true)
	if err != nil {
		return nil, err
	}
	return notificationsToMap(res.Items), nil
}

func (c *httpStorageClient) CreateNotification(ctx context.Context, bucket string, n *Notification, opts ...storageOption) (ret *Notification, err error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Notifications.Insert(bucket, toRawNotification(n))
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}
	var rn *raw.Notification
	err = run(ctx, func(ctx context.Context) error {
		rn, err = call.Context(ctx).Do()
		return err
	}, s.retry, s.idempotent)
	if err != nil {
		return nil, err
	}
	return toNotification(rn), nil
}

func (c *httpStorageClient) DeleteNotification(ctx context.Context, bucket string, id string, opts ...storageOption) (err error) {
	s := callSettings(c.settings, opts...)
	call := c.raw.Notifications.Delete(bucket, id)
	if s.userProject != "" {
		call.UserProject(s.userProject)
	}
	return run(ctx, func(ctx context.Context) error {
		return call.Context(ctx).Do()
	}, s.retry, s.idempotent)
}

type httpReader struct {
	body     io.ReadCloser
	seen     int64
	reopen   func(seen int64) (*http.Response, error)
	checkCRC bool   // should we check the CRC?
	wantCRC  uint32 // the CRC32c value the server sent in the header
	gotCRC   uint32 // running crc
}

func (r *httpReader) Read(p []byte) (int, error) {
	n := 0
	for len(p[n:]) > 0 {
		m, err := r.body.Read(p[n:])
		n += m
		r.seen += int64(m)
		if r.checkCRC {
			r.gotCRC = crc32.Update(r.gotCRC, crc32cTable, p[:n])
		}
		if err == nil {
			return n, nil
		}
		if err == io.EOF {
			// Check CRC here. It would be natural to check it in Close, but
			// everybody defers Close on the assumption that it doesn't return
			// anything worth looking at.
			if r.checkCRC {
				if r.gotCRC != r.wantCRC {
					return n, fmt.Errorf("storage: bad CRC on read: got %d, want %d",
						r.gotCRC, r.wantCRC)
				}
			}
			return n, err
		}
		// Read failed (likely due to connection issues), but we will try to reopen
		// the pipe and continue. Send a ranged read request that takes into account
		// the number of bytes we've already seen.
		res, err := r.reopen(r.seen)
		if err != nil {
			// reopen already retries
			return n, err
		}
		r.body.Close()
		r.body = res.Body
	}
	return n, nil
}

func (r *httpReader) Close() error {
	return r.body.Close()
}

func setRangeReaderHeaders(h http.Header, params *newRangeReaderParams) error {
	if params.readCompressed {
		h.Set("Accept-Encoding", "gzip")
	}
	if err := setEncryptionHeaders(h, params.encryptionKey, false); err != nil {
		return err
	}
	return nil
}

// readerReopen initiates a Read with offset and length, assuming we
// have already read seen bytes.
func readerReopen(ctx context.Context, header http.Header, params *newRangeReaderParams, s *settings,
	doDownload func(context.Context) (*http.Response, error), applyConditions func() error, setGeneration func()) func(int64) (*http.Response, error) {
	return func(seen int64) (*http.Response, error) {
		// If the context has already expired, return immediately without making a
		// call.
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		start := params.offset + seen
		if params.length < 0 && start < 0 {
			header.Set("Range", fmt.Sprintf("bytes=%d", start))
		} else if params.length < 0 && start > 0 {
			header.Set("Range", fmt.Sprintf("bytes=%d-", start))
		} else if params.length > 0 {
			// The end character isn't affected by how many bytes we've seen.
			header.Set("Range", fmt.Sprintf("bytes=%d-%d", start, params.offset+params.length-1))
		}
		// We wait to assign conditions here because the generation number can change in between reopen() runs.
		if err := applyConditions(); err != nil {
			return nil, err
		}
		// If an object generation is specified, include generation as query string parameters.
		if params.gen >= 0 {
			setGeneration()
		}

		var err error
		var res *http.Response
		err = run(ctx, func(ctx context.Context) error {
			res, err = doDownload(ctx)
			if err != nil {
				return formatObjectErr(err)
			}

			if res.StatusCode == http.StatusNotFound {
				// this check is necessary only for XML
				res.Body.Close()
				return ErrObjectNotExist
			}
			if res.StatusCode < 200 || res.StatusCode > 299 {
				body, _ := io.ReadAll(res.Body)
				res.Body.Close()
				return &googleapi.Error{
					Code:   res.StatusCode,
					Header: res.Header,
					Body:   string(body),
				}
			}

			partialContentNotSatisfied :=
				!decompressiveTranscoding(res) &&
					start > 0 && params.length != 0 &&
					res.StatusCode != http.StatusPartialContent

			if partialContentNotSatisfied {
				res.Body.Close()
				return errors.New("storage: partial request not satisfied")
			}

			// With "Content-Encoding": "gzip" aka decompressive transcoding, GCS serves
			// back the whole file regardless of the range count passed in as per:
			//      https://cloud.google.com/storage/docs/transcoding#range,
			// thus we have to manually move the body forward by seen bytes.
			if decompressiveTranscoding(res) && seen > 0 {
				_, _ = io.CopyN(io.Discard, res.Body, seen)
			}

			// If a generation hasn't been specified, and this is the first response we get, let's record the
			// generation. In future requests we'll use this generation as a precondition to avoid data races.
			if params.gen < 0 && res.Header.Get("X-Goog-Generation") != "" {
				gen64, err := strconv.ParseInt(res.Header.Get("X-Goog-Generation"), 10, 64)
				if err != nil {
					return err
				}
				params.gen = gen64
			}
			return nil
		}, s.retry, s.idempotent)
		if err != nil {
			return nil, err
		}
		return res, nil
	}
}

func parseReadResponse(res *http.Response, params *newRangeReaderParams, reopen func(int64) (*http.Response, error)) (*Reader, error) {
	var err error
	var (
		size        int64 // total size of object, even if a range was requested.
		checkCRC    bool
		crc         uint32
		startOffset int64 // non-zero if range request.
	)
	if res.StatusCode == http.StatusPartialContent {
		cr := strings.TrimSpace(res.Header.Get("Content-Range"))
		if !strings.HasPrefix(cr, "bytes ") || !strings.Contains(cr, "/") {
			return nil, fmt.Errorf("storage: invalid Content-Range %q", cr)
		}
		// Content range is formatted <first byte>-<last byte>/<total size>. We take
		// the total size.
		size, err = strconv.ParseInt(cr[strings.LastIndex(cr, "/")+1:], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("storage: invalid Content-Range %q", cr)
		}

		dashIndex := strings.Index(cr, "-")
		if dashIndex >= 0 {
			startOffset, err = strconv.ParseInt(cr[len("bytes="):dashIndex], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("storage: invalid Content-Range %q: %w", cr, err)
			}
		}
	} else {
		size = res.ContentLength
	}

	// Check the CRC iff all of the following hold:
	// - We asked for content (length != 0).
	// - We got all the content (status != PartialContent).
	// - The server sent a CRC header.
	// - The Go http stack did not uncompress the file.
	// - We were not served compressed data that was uncompressed on download.
	// The problem with the last two cases is that the CRC will not match -- GCS
	// computes it on the compressed contents, but we compute it on the
	// uncompressed contents.
	crc, checkCRC = parseCRC32c(res)
	if params.length == 0 || res.StatusCode == http.StatusPartialContent || res.Uncompressed || uncompressedByServer(res) {
		checkCRC = false
	}

	remain := res.ContentLength
	body := res.Body
	// If the user requested zero bytes, explicitly close and remove the request
	// body.
	if params.length == 0 {
		remain = 0
		body.Close()
		body = emptyBody
	}
	var metaGen int64
	if res.Header.Get("X-Goog-Metageneration") != "" {
		metaGen, err = strconv.ParseInt(res.Header.Get("X-Goog-Metageneration"), 10, 64)
		if err != nil {
			return nil, err
		}
	}

	var lm time.Time
	if res.Header.Get("Last-Modified") != "" {
		lm, err = http.ParseTime(res.Header.Get("Last-Modified"))
		if err != nil {
			return nil, err
		}
	}

	metadata := map[string]string{}
	for key, values := range res.Header {
		if len(values) > 0 && strings.HasPrefix(key, "X-Goog-Meta-") {
			key := key[len("X-Goog-Meta-"):]
			metadata[key] = values[0]
		}
	}

	attrs := ReaderObjectAttrs{
		Size:            size,
		ContentType:     res.Header.Get("Content-Type"),
		ContentEncoding: res.Header.Get("Content-Encoding"),
		CacheControl:    res.Header.Get("Cache-Control"),
		LastModified:    lm,
		StartOffset:     startOffset,
		Generation:      params.gen,
		Metageneration:  metaGen,
		CRC32C:          crc,
		Decompressed:    res.Uncompressed || uncompressedByServer(res),
	}
	return &Reader{
		Attrs:          attrs,
		objectMetadata: &metadata,
		size:           size,
		remain:         remain,
		checkCRC:       checkCRC,
		reader: &httpReader{
			reopen:   reopen,
			body:     body,
			wantCRC:  crc,
			checkCRC: checkCRC,
		},
	}, nil
}

// setHeadersFromCtx sets custom headers passed in via the context on the header,
// replacing any header with the same key (which avoids duplicating invocation headers).
// This is only required for XML; for gRPC & JSON requests this is handled in
// the GAPIC and Apiary layers respectively.
func setHeadersFromCtx(ctx context.Context, header http.Header) {
	ctxHeaders := callctx.HeadersFromContext(ctx)
	for k, vals := range ctxHeaders {
		// Merge x-goog-api-client values into a single space-separated value.
		if strings.EqualFold(k, xGoogHeaderKey) {
			alreadySetValues := header.Values(xGoogHeaderKey)
			vals = append(vals, alreadySetValues...)

			if len(vals) > 0 {
				xGoogHeader := vals[0]
				for _, v := range vals[1:] {
					xGoogHeader = strings.Join([]string{xGoogHeader, v}, " ")
				}
				header.Set(k, xGoogHeader)
			}
		} else {
			for _, v := range vals {
				header.Set(k, v)
			}
		}
	}
}
