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
	"io"
	"time"

	"cloud.google.com/go/iam/apiv1/iampb"
	gax "github.com/googleapis/gax-go/v2"
	"google.golang.org/api/option"
)

// TODO(noahdietz): Move existing factory methods to this file.

// storageClient is an internal-only interface designed to separate the
// transport-specific logic of making Storage API calls from the logic of the
// client library.
//
// Implementation requirements beyond implementing the interface include:
// * factory method(s) must accept a `userProject string` param
// * `settings` must be retained per instance
// * `storageOption`s must be resolved in the order they are received
// * all API errors must be wrapped in the gax-go APIError type
// * any unimplemented interface methods must return a StorageUnimplementedErr
//
// TODO(noahdietz): This interface is currently not used in the production code
// paths
type storageClient interface {

	// Top-level methods.

	GetServiceAccount(ctx context.Context, project string, opts ...storageOption) (string, error)
	CreateBucket(ctx context.Context, project, bucket string, attrs *BucketAttrs, enableObjectRetention *bool, opts ...storageOption) (*BucketAttrs, error)
	ListBuckets(ctx context.Context, project string, opts ...storageOption) *BucketIterator
	Close() error

	// Bucket methods.

	DeleteBucket(ctx context.Context, bucket string, conds *BucketConditions, opts ...storageOption) error
	GetBucket(ctx context.Context, bucket string, conds *BucketConditions, opts ...storageOption) (*BucketAttrs, error)
	UpdateBucket(ctx context.Context, bucket string, uattrs *BucketAttrsToUpdate, conds *BucketConditions, opts ...storageOption) (*BucketAttrs, error)
	LockBucketRetentionPolicy(ctx context.Context, bucket string, conds *BucketConditions, opts ...storageOption) error
	ListObjects(ctx context.Context, bucket string, q *Query, opts ...storageOption) *ObjectIterator

	// Object metadata methods.

	DeleteObject(ctx context.Context, bucket, object string, gen int64, conds *Conditions, opts ...storageOption) error
	GetObject(ctx context.Context, params *getObjectParams, opts ...storageOption) (*ObjectAttrs, error)
	UpdateObject(ctx context.Context, params *updateObjectParams, opts ...storageOption) (*ObjectAttrs, error)
	RestoreObject(ctx context.Context, params *restoreObjectParams, opts ...storageOption) (*ObjectAttrs, error)
	MoveObject(ctx context.Context, params *moveObjectParams, opts ...storageOption) (*ObjectAttrs, error)

	// Default Object ACL methods.

	DeleteDefaultObjectACL(ctx context.Context, bucket string, entity ACLEntity, opts ...storageOption) error
	ListDefaultObjectACLs(ctx context.Context, bucket string, opts ...storageOption) ([]ACLRule, error)
	UpdateDefaultObjectACL(ctx context.Context, bucket string, entity ACLEntity, role ACLRole, opts ...storageOption) error

	// Bucket ACL methods.

	DeleteBucketACL(ctx context.Context, bucket string, entity ACLEntity, opts ...storageOption) error
	ListBucketACLs(ctx context.Context, bucket string, opts ...storageOption) ([]ACLRule, error)
	UpdateBucketACL(ctx context.Context, bucket string, entity ACLEntity, role ACLRole, opts ...storageOption) error

	// Object ACL methods.

	DeleteObjectACL(ctx context.Context, bucket, object string, entity ACLEntity, opts ...storageOption) error
	ListObjectACLs(ctx context.Context, bucket, object string, opts ...storageOption) ([]ACLRule, error)
	UpdateObjectACL(ctx context.Context, bucket, object string, entity ACLEntity, role ACLRole, opts ...storageOption) error

	// Media operations.

	ComposeObject(ctx context.Context, req *composeObjectRequest, opts ...storageOption) (*ObjectAttrs, error)
	RewriteObject(ctx context.Context, req *rewriteObjectRequest, opts ...storageOption) (*rewriteObjectResponse, error)

	NewRangeReader(ctx context.Context, params *newRangeReaderParams, opts ...storageOption) (*Reader, error)
	OpenWriter(params *openWriterParams, opts ...storageOption) (*io.PipeWriter, error)

	// IAM methods.

	GetIamPolicy(ctx context.Context, resource string, version int32, opts ...storageOption) (*iampb.Policy, error)
	SetIamPolicy(ctx context.Context, resource string, policy *iampb.Policy, opts ...storageOption) error
	TestIamPermissions(ctx context.Context, resource string, permissions []string, opts ...storageOption) ([]string, error)

	// HMAC Key methods.

	GetHMACKey(ctx context.Context, project, accessID string, opts ...storageOption) (*HMACKey, error)
	ListHMACKeys(ctx context.Context, project, serviceAccountEmail string, showDeletedKeys bool, opts ...storageOption) *HMACKeysIterator
	UpdateHMACKey(ctx context.Context, project, serviceAccountEmail, accessID string, attrs *HMACKeyAttrsToUpdate, opts ...storageOption) (*HMACKey, error)
	CreateHMACKey(ctx context.Context, project, serviceAccountEmail string, opts ...storageOption) (*HMACKey, error)
	DeleteHMACKey(ctx context.Context, project, accessID string, opts ...storageOption) error

	// Notification methods.
	ListNotifications(ctx context.Context, bucket string, opts ...storageOption) (map[string]*Notification, error)
	CreateNotification(ctx context.Context, bucket string, n *Notification, opts ...storageOption) (*Notification, error)
	DeleteNotification(ctx context.Context, bucket string, id string, opts ...storageOption) error

	NewMultiRangeDownloader(ctx context.Context, params *newMultiRangeDownloaderParams, opts ...storageOption) (*MultiRangeDownloader, error)
}

// settings contains transport-agnostic configuration for API calls made via
// the storageClient inteface. All implementations must utilize settings
// and respect those that are applicable.
type settings struct {
	// retry is the complete retry configuration to use when evaluating if an
	// API call should be retried.
	retry *retryConfig

	// gax is a set of gax.CallOption to be conveyed to gax.Invoke.
	// Note: Not all storageClient interfaces will must use gax.Invoke.
	gax []gax.CallOption

	// idempotent indicates if the call is idempotent or not when considering
	// if the call should be retried or not.
	idempotent bool

	// clientOption is a set of option.ClientOption to be used during client
	// transport initialization. See https://pkg.go.dev/google.golang.org/api/option
	// for a list of supported options.
	clientOption []option.ClientOption

	// userProject is the user project that should be billed for the request.
	userProject string

	metricsContext *metricsContext
}

func initSettings(opts ...storageOption) *settings {
	s := &settings{}
	resolveOptions(s, opts...)
	return s
}

func resolveOptions(s *settings, opts ...storageOption) {
	for _, o := range opts {
		o.Apply(s)
	}
}

// callSettings is a helper for resolving storage options against the settings
// in the context of an individual call. This is to ensure that client-level
// default settings are not mutated by two different calls getting options.
//
// Example: s := callSettings(c.settings, opts...)
func callSettings(defaults *settings, opts ...storageOption) *settings {
	if defaults == nil {
		return nil
	}
	// This does not make a deep copy of the pointer/slice fields, but all
	// options replace the settings fields rather than modify their values in
	// place.
	cs := *defaults
	resolveOptions(&cs, opts...)
	return &cs
}

// makeStorageOpts is a helper for generating a set of storageOption based on
// idempotency, retryConfig, and userProject. All top-level client operations
// will generally have to pass these options through the interface.
func makeStorageOpts(isIdempotent bool, retry *retryConfig, userProject string) []storageOption {
	opts := []storageOption{idempotent(isIdempotent)}
	if retry != nil {
		opts = append(opts, withRetryConfig(retry))
	}
	if userProject != "" {
		opts = append(opts, withUserProject(userProject))
	}
	return opts
}

// storageOption is the transport-agnostic call option for the storageClient
// interface.
type storageOption interface {
	Apply(s *settings)
}

func withRetryConfig(rc *retryConfig) storageOption {
	return &retryOption{rc}
}

type retryOption struct {
	rc *retryConfig
}

func (o *retryOption) Apply(s *settings) { s.retry = o.rc }

func idempotent(i bool) storageOption {
	return &idempotentOption{i}
}

type idempotentOption struct {
	idempotency bool
}

func (o *idempotentOption) Apply(s *settings) { s.idempotent = o.idempotency }

func withClientOptions(opts ...option.ClientOption) storageOption {
	return &clientOption{opts: opts}
}

type clientOption struct {
	opts []option.ClientOption
}

func (o *clientOption) Apply(s *settings) { s.clientOption = o.opts }

func withUserProject(project string) storageOption {
	return &userProjectOption{project}
}

type userProjectOption struct {
	project string
}

func (o *userProjectOption) Apply(s *settings) { s.userProject = o.project }

type openWriterParams struct {
	// Writer configuration

	// ctx is the context used by the writer routine to make all network calls
	// and to manage the writer routine - see `Writer.ctx`.
	// Required.
	ctx context.Context
	// chunkSize - see `Writer.ChunkSize`.
	// Optional.
	chunkSize int
	// chunkRetryDeadline - see `Writer.ChunkRetryDeadline`.
	// Optional.
	chunkRetryDeadline   time.Duration
	chunkTransferTimeout time.Duration

	// Object/request properties

	// bucket - see `Writer.o.bucket`.
	// Required.
	bucket string
	// attrs - see `Writer.ObjectAttrs`.
	// Required.
	attrs *ObjectAttrs
	// forceEmptyContentType - Disables auto-detect of Content-Type
	// Optional.
	forceEmptyContentType bool
	// conds - see `Writer.o.conds`.
	// Optional.
	conds *Conditions
	// appendGen -- object generation to write to.
	// Optional; required for taking over appendable objects only
	appendGen int64
	// encryptionKey - see `Writer.o.encryptionKey`
	// Optional.
	encryptionKey []byte
	// sendCRC32C - see `Writer.SendCRC32C`.
	// Optional.
	sendCRC32C bool
	// append - Write with appendable object semantics.
	// Optional.
	append bool
	// finalizeOnClose - Finalize the object when the storage.Writer is closed
	// successfully.
	// Optional.
	finalizeOnClose bool

	// Writer callbacks

	// donec - see `Writer.donec`.
	// Required.
	donec chan struct{}
	// setError callback for reporting errors - see `Writer.error`.
	// Required.
	setError func(error)
	// progress callback for reporting upload progress - see `Writer.progress`.
	// Required.
	progress func(int64)
	// setObj callback for reporting the resulting object - see `Writer.obj`.
	// Required.
	setObj func(*ObjectAttrs)
	// setSize callback for updated the persisted size in Writer.obj.
	setSize func(int64)
	// setFlush callback for providing a Flush function implementation - see `Writer.Flush`.
	// Required.
	setFlush func(func() (int64, error))
	// setPipeWriter callback for reseting `Writer.pw` if needed.
	setPipeWriter func(*io.PipeWriter)
	// setTakeoverOffset callback for returning offset to start writing from to Writer.
	setTakeoverOffset func(int64)
}

type newMultiRangeDownloaderParams struct {
	bucket        string
	conds         *Conditions
	encryptionKey []byte
	gen           int64
	object        string
	handle        *ReadHandle
}

type newRangeReaderParams struct {
	bucket         string
	conds          *Conditions
	encryptionKey  []byte
	gen            int64
	length         int64
	object         string
	offset         int64
	readCompressed bool // Use accept-encoding: gzip. Only works for HTTP currently.
	handle         *ReadHandle
}

type getObjectParams struct {
	bucket, object string
	gen            int64
	encryptionKey  []byte
	conds          *Conditions
	softDeleted    bool
}

type updateObjectParams struct {
	bucket, object    string
	uattrs            *ObjectAttrsToUpdate
	gen               int64
	encryptionKey     []byte
	conds             *Conditions
	overrideRetention *bool
}

type restoreObjectParams struct {
	bucket, object string
	gen            int64
	encryptionKey  []byte
	conds          *Conditions
	copySourceACL  bool
}

type moveObjectParams struct {
	bucket, srcObject, dstObject string
	srcConds                     *Conditions
	dstConds                     *Conditions
	encryptionKey                []byte
}

type composeObjectRequest struct {
	dstBucket     string
	dstObject     destinationObject
	srcs          []sourceObject
	predefinedACL string
	sendCRC32C    bool
}

type sourceObject struct {
	name          string
	bucket        string
	gen           int64
	conds         *Conditions
	encryptionKey []byte
}

type destinationObject struct {
	name          string
	bucket        string
	conds         *Conditions
	attrs         *ObjectAttrs // attrs to set on the destination object.
	encryptionKey []byte
	keyName       string
}

type rewriteObjectRequest struct {
	srcObject                sourceObject
	dstObject                destinationObject
	predefinedACL            string
	token                    string
	maxBytesRewrittenPerCall int64
}

type rewriteObjectResponse struct {
	resource *ObjectAttrs
	done     bool
	written  int64
	size     int64
	token    string
}
