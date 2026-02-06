// Copyright 2014 Google LLC
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
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/internal/optional"
	"cloud.google.com/go/storage/internal/apiv2/storagepb"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/iamcredentials/v1"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	raw "google.golang.org/api/storage/v1"
	dpb "google.golang.org/genproto/googleapis/type/date"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/durationpb"
)

// BucketHandle provides operations on a Google Cloud Storage bucket.
// Use Client.Bucket to get a handle.
type BucketHandle struct {
	c                     *Client
	name                  string
	acl                   ACLHandle
	defaultObjectACL      ACLHandle
	conds                 *BucketConditions
	userProject           string // project for Requester Pays buckets
	retry                 *retryConfig
	enableObjectRetention *bool
}

// Bucket returns a BucketHandle, which provides operations on the named bucket.
// This call does not perform any network operations.
//
// The supplied name must contain only lowercase letters, numbers, dashes,
// underscores, and dots. The full specification for valid bucket names can be
// found at:
//
//	https://cloud.google.com/storage/docs/bucket-naming
func (c *Client) Bucket(name string) *BucketHandle {
	retry := c.retry.clone()
	return &BucketHandle{
		c:    c,
		name: name,
		acl: ACLHandle{
			c:      c,
			bucket: name,
			retry:  retry,
		},
		defaultObjectACL: ACLHandle{
			c:         c,
			bucket:    name,
			isDefault: true,
			retry:     retry,
		},
		retry: retry,
	}
}

// Create creates the Bucket in the project.
// If attrs is nil the API defaults will be used.
func (b *BucketHandle) Create(ctx context.Context, projectID string, attrs *BucketAttrs) (err error) {
	ctx, _ = startSpan(ctx, "Bucket.Create")
	defer func() { endSpan(ctx, err) }()

	o := makeStorageOpts(true, b.retry, b.userProject)

	if _, err := b.c.tc.CreateBucket(ctx, projectID, b.name, attrs, b.enableObjectRetention, o...); err != nil {
		return err
	}
	return nil
}

// Delete deletes the Bucket.
func (b *BucketHandle) Delete(ctx context.Context) (err error) {
	ctx, _ = startSpan(ctx, "Bucket.Delete")
	defer func() { endSpan(ctx, err) }()

	o := makeStorageOpts(true, b.retry, b.userProject)
	return b.c.tc.DeleteBucket(ctx, b.name, b.conds, o...)
}

// ACL returns an ACLHandle, which provides access to the bucket's access control list.
// This controls who can list, create or overwrite the objects in a bucket.
// This call does not perform any network operations.
func (b *BucketHandle) ACL() *ACLHandle {
	return &b.acl
}

// DefaultObjectACL returns an ACLHandle, which provides access to the bucket's default object ACLs.
// These ACLs are applied to newly created objects in this bucket that do not have a defined ACL.
// This call does not perform any network operations.
func (b *BucketHandle) DefaultObjectACL() *ACLHandle {
	return &b.defaultObjectACL
}

// BucketName returns the name of the bucket.
func (b *BucketHandle) BucketName() string {
	return b.name
}

// Object returns an ObjectHandle, which provides operations on the named object.
// This call does not perform any network operations such as fetching the object or verifying its existence.
// Use methods on ObjectHandle to perform network operations.
//
// name must consist entirely of valid UTF-8-encoded runes. The full specification
// for valid object names can be found at:
//
//	https://cloud.google.com/storage/docs/naming-objects
func (b *BucketHandle) Object(name string) *ObjectHandle {
	retry := b.retry.clone()
	return &ObjectHandle{
		c:      b.c,
		bucket: b.name,
		object: name,
		acl: ACLHandle{
			c:           b.c,
			bucket:      b.name,
			object:      name,
			userProject: b.userProject,
			retry:       retry,
		},
		gen:         -1,
		userProject: b.userProject,
		retry:       retry,
	}
}

// Attrs returns the metadata for the bucket.
func (b *BucketHandle) Attrs(ctx context.Context) (attrs *BucketAttrs, err error) {
	ctx, _ = startSpan(ctx, "Bucket.Attrs")
	defer func() { endSpan(ctx, err) }()

	o := makeStorageOpts(true, b.retry, b.userProject)
	return b.c.tc.GetBucket(ctx, b.name, b.conds, o...)
}

// Update updates a bucket's attributes.
func (b *BucketHandle) Update(ctx context.Context, uattrs BucketAttrsToUpdate) (attrs *BucketAttrs, err error) {
	ctx, _ = startSpan(ctx, "Bucket.Update")
	defer func() { endSpan(ctx, err) }()

	isIdempotent := b.conds != nil && b.conds.MetagenerationMatch != 0
	o := makeStorageOpts(isIdempotent, b.retry, b.userProject)
	return b.c.tc.UpdateBucket(ctx, b.name, &uattrs, b.conds, o...)
}

// SignedURL returns a URL for the specified object. Signed URLs allow anyone
// access to a restricted resource for a limited time without needing a Google
// account or signing in.
// For more information about signed URLs, see "[Overview of access control]."
//
// This method requires the Method and Expires fields in the specified
// SignedURLOptions to be non-nil. You may need to set the GoogleAccessID and
// PrivateKey fields in some cases. Read more on the [automatic detection of credentials]
// for this method.
//
// [Overview of access control]: https://cloud.google.com/storage/docs/accesscontrol#signed_urls_query_string_authentication
// [automatic detection of credentials]: https://pkg.go.dev/cloud.google.com/go/storage#hdr-Credential_requirements_for_signing
func (b *BucketHandle) SignedURL(object string, opts *SignedURLOptions) (string, error) {
	// Make a copy of opts so we don't modify the pointer parameter.
	newopts := opts.clone()

	if newopts.Hostname == "" {
		// Extract the correct host from the readhost set on the client
		newopts.Hostname = b.c.xmlHost
	}

	if opts.GoogleAccessID != "" && (opts.SignBytes != nil || len(opts.PrivateKey) > 0) {
		return SignedURL(b.name, object, newopts)
	}

	if newopts.GoogleAccessID == "" {
		id, err := b.detectDefaultGoogleAccessID()
		if err != nil {
			return "", err
		}
		newopts.GoogleAccessID = id
	}
	if newopts.SignBytes == nil && len(newopts.PrivateKey) == 0 {
		if j, ok := b.c.credsJSON(); ok {
			var sa struct {
				PrivateKey string `json:"private_key"`
			}
			err := json.Unmarshal(j, &sa)
			if err == nil && sa.PrivateKey != "" {
				newopts.PrivateKey = []byte(sa.PrivateKey)
			}
		}

		// Don't error out if we can't unmarshal the private key from the client,
		// fallback to the default sign function for the service account.
		if len(newopts.PrivateKey) == 0 {
			newopts.SignBytes = b.defaultSignBytesFunc(newopts.GoogleAccessID)
		}
	}
	return SignedURL(b.name, object, newopts)
}

// GenerateSignedPostPolicyV4 generates a PostPolicyV4 value from bucket, object and opts.
// The generated URL and fields will then allow an unauthenticated client to perform multipart uploads.
//
// This method requires the Expires field in the specified PostPolicyV4Options
// to be non-nil. You may need to set the GoogleAccessID and PrivateKey fields
// in some cases. Read more on the [automatic detection of credentials] for this method.
//
// [automatic detection of credentials]: https://pkg.go.dev/cloud.google.com/go/storage#hdr-Credential_requirements_for_signing
func (b *BucketHandle) GenerateSignedPostPolicyV4(object string, opts *PostPolicyV4Options) (*PostPolicyV4, error) {
	// Make a copy of opts so we don't modify the pointer parameter.
	newopts := opts.clone()

	if newopts.Hostname == "" {
		// Extract the correct host from the readhost set on the client
		newopts.Hostname = b.c.xmlHost
	}

	if opts.GoogleAccessID != "" && (opts.SignRawBytes != nil || opts.SignBytes != nil || len(opts.PrivateKey) > 0) {
		return GenerateSignedPostPolicyV4(b.name, object, newopts)
	}

	if newopts.GoogleAccessID == "" {
		id, err := b.detectDefaultGoogleAccessID()
		if err != nil {
			return nil, err
		}
		newopts.GoogleAccessID = id
	}
	if newopts.SignBytes == nil && newopts.SignRawBytes == nil && len(newopts.PrivateKey) == 0 {
		if j, ok := b.c.credsJSON(); ok {
			var sa struct {
				PrivateKey string `json:"private_key"`
			}
			err := json.Unmarshal(j, &sa)
			if err == nil && sa.PrivateKey != "" {
				newopts.PrivateKey = []byte(sa.PrivateKey)
			}
		}

		// Don't error out if we can't unmarshal the private key from the client,
		// fallback to the default sign function for the service account.
		if len(newopts.PrivateKey) == 0 {
			newopts.SignRawBytes = b.defaultSignBytesFunc(newopts.GoogleAccessID)
		}
	}
	return GenerateSignedPostPolicyV4(b.name, object, newopts)
}

func (b *BucketHandle) detectDefaultGoogleAccessID() (string, error) {
	returnErr := errors.New("no credentials found on client and not on GCE (Google Compute Engine)")

	if j, ok := b.c.credsJSON(); ok {
		var sa struct {
			ClientEmail        string `json:"client_email"`
			SAImpersonationURL string `json:"service_account_impersonation_url"`
			CredType           string `json:"type"`
		}

		err := json.Unmarshal(j, &sa)
		if err != nil {
			returnErr = err
		} else {
			switch sa.CredType {
			case "impersonated_service_account", "external_account":
				start, end := strings.LastIndex(sa.SAImpersonationURL, "/"), strings.LastIndex(sa.SAImpersonationURL, ":")

				if end <= start {
					returnErr = errors.New("error parsing external or impersonated service account credentials")
				} else {
					return sa.SAImpersonationURL[start+1 : end], nil
				}
			case "service_account":
				if sa.ClientEmail != "" {
					return sa.ClientEmail, nil
				}
				returnErr = errors.New("empty service account client email")
			default:
				returnErr = errors.New("unable to parse credentials; only service_account, external_account and impersonated_service_account credentials are supported")
			}
		}
	}

	// Don't error out if we can't unmarshal, fallback to GCE check.
	if metadata.OnGCE() {
		email, err := metadata.Email("default")
		if err == nil && email != "" {
			return email, nil
		} else if err != nil {
			returnErr = err
		} else {
			returnErr = errors.New("empty email from GCE metadata service")
		}

	}
	return "", fmt.Errorf("storage: unable to detect default GoogleAccessID: %w. Please provide the GoogleAccessID or use a supported means for autodetecting it (see https://pkg.go.dev/cloud.google.com/go/storage#hdr-Credential_requirements_for_signing)", returnErr)
}

func (b *BucketHandle) defaultSignBytesFunc(email string) func([]byte) ([]byte, error) {
	return func(in []byte) ([]byte, error) {
		ctx := context.Background()

		opts := []option.ClientOption{option.WithHTTPClient(b.c.hc)}

		if b.c.creds != nil {
			universeDomain, err := b.c.creds.UniverseDomain(ctx)
			if err != nil {
				return nil, err
			}
			opts = append(opts, option.WithUniverseDomain(universeDomain))
		}

		// It's ok to recreate this service per call since we pass in the http client,
		// circumventing the cost of recreating the auth/transport layer
		svc, err := iamcredentials.NewService(ctx, opts...)
		if err != nil {
			return nil, fmt.Errorf("unable to create iamcredentials client: %w", err)
		}
		// Do the SignBlob call with a retry for transient errors.
		var resp *iamcredentials.SignBlobResponse
		if err := run(ctx, func(ctx context.Context) error {
			resp, err = svc.Projects.ServiceAccounts.SignBlob(fmt.Sprintf("projects/-/serviceAccounts/%s", email), &iamcredentials.SignBlobRequest{
				Payload: base64.StdEncoding.EncodeToString(in),
			}).Do()
			return err
		}, b.retry, true); err != nil {
			return nil, fmt.Errorf("unable to sign bytes: %w", err)
		}
		out, err := base64.StdEncoding.DecodeString(resp.SignedBlob)
		if err != nil {
			return nil, fmt.Errorf("unable to base64 decode response: %w", err)
		}
		return out, nil
	}
}

// BucketAttrs represents the metadata for a Google Cloud Storage bucket.
// Read-only fields are ignored by BucketHandle.Create.
type BucketAttrs struct {
	// Name is the name of the bucket.
	// This field is read-only.
	Name string

	// ACL is the list of access control rules on the bucket.
	ACL []ACLRule

	// BucketPolicyOnly is an alias for UniformBucketLevelAccess. Use of
	// UniformBucketLevelAccess is recommended above the use of this field.
	// Setting BucketPolicyOnly.Enabled OR UniformBucketLevelAccess.Enabled to
	// true, will enable UniformBucketLevelAccess.
	BucketPolicyOnly BucketPolicyOnly

	// UniformBucketLevelAccess configures access checks to use only bucket-level IAM
	// policies and ignore any ACL rules for the bucket.
	// See https://cloud.google.com/storage/docs/uniform-bucket-level-access
	// for more information.
	UniformBucketLevelAccess UniformBucketLevelAccess

	// PublicAccessPrevention is the setting for the bucket's
	// PublicAccessPrevention policy, which can be used to prevent public access
	// of data in the bucket. See
	// https://cloud.google.com/storage/docs/public-access-prevention for more
	// information.
	PublicAccessPrevention PublicAccessPrevention

	// DefaultObjectACL is the list of access controls to
	// apply to new objects when no object ACL is provided.
	DefaultObjectACL []ACLRule

	// DefaultEventBasedHold is the default value for event-based hold on
	// newly created objects in this bucket. It defaults to false.
	DefaultEventBasedHold bool

	// If not empty, applies a predefined set of access controls. It should be set
	// only when creating a bucket.
	// It is always empty for BucketAttrs returned from the service.
	// See https://cloud.google.com/storage/docs/json_api/v1/buckets/insert
	// for valid values.
	PredefinedACL string

	// If not empty, applies a predefined set of default object access controls.
	// It should be set only when creating a bucket.
	// It is always empty for BucketAttrs returned from the service.
	// See https://cloud.google.com/storage/docs/json_api/v1/buckets/insert
	// for valid values.
	PredefinedDefaultObjectACL string

	// Location is the location of the bucket. It defaults to "US".
	// If specifying a dual-region, CustomPlacementConfig should be set in conjunction.
	Location string

	// The bucket's custom placement configuration that holds a list of
	// regional locations for custom dual regions.
	CustomPlacementConfig *CustomPlacementConfig

	// MetaGeneration is the metadata generation of the bucket.
	// This field is read-only.
	MetaGeneration int64

	// StorageClass is the default storage class of the bucket. This defines
	// how objects in the bucket are stored and determines the SLA
	// and the cost of storage. Typical values are "STANDARD", "NEARLINE",
	// "COLDLINE" and "ARCHIVE". Defaults to "STANDARD".
	// See https://cloud.google.com/storage/docs/storage-classes for all
	// valid values.
	StorageClass string

	// Created is the creation time of the bucket.
	// This field is read-only.
	Created time.Time

	// Updated is the time at which the bucket was last modified.
	// This field is read-only.
	Updated time.Time

	// VersioningEnabled reports whether this bucket has versioning enabled.
	VersioningEnabled bool

	// Labels are the bucket's labels.
	Labels map[string]string

	// RequesterPays reports whether the bucket is a Requester Pays bucket.
	// Clients performing operations on Requester Pays buckets must provide
	// a user project (see BucketHandle.UserProject), which will be billed
	// for the operations.
	RequesterPays bool

	// Lifecycle is the lifecycle configuration for objects in the bucket.
	Lifecycle Lifecycle

	// Retention policy enforces a minimum retention time for all objects
	// contained in the bucket. A RetentionPolicy of nil implies the bucket
	// has no minimum data retention.
	//
	// This feature is in private alpha release. It is not currently available to
	// most customers. It might be changed in backwards-incompatible ways and is not
	// subject to any SLA or deprecation policy.
	RetentionPolicy *RetentionPolicy

	// The bucket's Cross-Origin Resource Sharing (CORS) configuration.
	CORS []CORS

	// The encryption configuration used by default for newly inserted objects.
	Encryption *BucketEncryption

	// The logging configuration.
	Logging *BucketLogging

	// The website configuration.
	Website *BucketWebsite

	// Etag is the HTTP/1.1 Entity tag for the bucket.
	// This field is read-only.
	Etag string

	// LocationType describes how data is stored and replicated.
	// Typical values are "multi-region", "region" and "dual-region".
	// This field is read-only.
	LocationType string

	// The project number of the project the bucket belongs to.
	// This field is read-only.
	ProjectNumber uint64

	// RPO configures the Recovery Point Objective (RPO) policy of the bucket.
	// Set to RPOAsyncTurbo to turn on Turbo Replication for a bucket.
	// See https://cloud.google.com/storage/docs/managing-turbo-replication for
	// more information.
	RPO RPO

	// Autoclass holds the bucket's autoclass configuration. If enabled,
	// allows for the automatic selection of the best storage class
	// based on object access patterns.
	Autoclass *Autoclass

	// ObjectRetentionMode reports whether individual objects in the bucket can
	// be configured with a retention policy. An empty value means that object
	// retention is disabled.
	// This field is read-only. Object retention can be enabled only by creating
	// a bucket with SetObjectRetention set to true on the BucketHandle. It
	// cannot be modified once the bucket is created.
	// ObjectRetention cannot be configured or reported through the gRPC API.
	ObjectRetentionMode string

	// SoftDeletePolicy contains the bucket's soft delete policy, which defines
	// the period of time that soft-deleted objects will be retained, and cannot
	// be permanently deleted. By default, new buckets will be created with a
	// 7 day retention duration. In order to fully disable soft delete, you need
	// to set a policy with a RetentionDuration of 0.
	SoftDeletePolicy *SoftDeletePolicy

	// HierarchicalNamespace contains the bucket's hierarchical namespace
	// configuration. Hierarchical namespace enabled buckets can contain
	// [cloud.google.com/go/storage/control/apiv2/controlpb.Folder] resources.
	// It cannot be modified after bucket creation time.
	// UniformBucketLevelAccess must also also be enabled on the bucket.
	HierarchicalNamespace *HierarchicalNamespace

	// OwnerEntity contains entity information in the form "project-owner-projectId".
	OwnerEntity string
}

// BucketPolicyOnly is an alias for UniformBucketLevelAccess.
// Use of UniformBucketLevelAccess is preferred above BucketPolicyOnly.
type BucketPolicyOnly struct {
	// Enabled specifies whether access checks use only bucket-level IAM
	// policies. Enabled may be disabled until the locked time.
	Enabled bool
	// LockedTime specifies the deadline for changing Enabled from true to
	// false.
	LockedTime time.Time
}

// UniformBucketLevelAccess configures access checks to use only bucket-level IAM
// policies.
type UniformBucketLevelAccess struct {
	// Enabled specifies whether access checks use only bucket-level IAM
	// policies. Enabled may be disabled until the locked time.
	Enabled bool
	// LockedTime specifies the deadline for changing Enabled from true to
	// false.
	LockedTime time.Time
}

// PublicAccessPrevention configures the Public Access Prevention feature, which
// can be used to disallow public access to any data in a bucket. See
// https://cloud.google.com/storage/docs/public-access-prevention for more
// information.
type PublicAccessPrevention int

const (
	// PublicAccessPreventionUnknown is a zero value, used only if this field is
	// not set in a call to GCS.
	PublicAccessPreventionUnknown PublicAccessPrevention = iota

	// PublicAccessPreventionUnspecified corresponds to a value of "unspecified".
	// Deprecated: use PublicAccessPreventionInherited
	PublicAccessPreventionUnspecified

	// PublicAccessPreventionEnforced corresponds to a value of "enforced". This
	// enforces Public Access Prevention on the bucket.
	PublicAccessPreventionEnforced

	// PublicAccessPreventionInherited corresponds to a value of "inherited"
	// and is the default for buckets.
	PublicAccessPreventionInherited

	publicAccessPreventionUnknown string = ""
	// TODO: remove unspecified when change is fully completed
	publicAccessPreventionUnspecified = "unspecified"
	publicAccessPreventionEnforced    = "enforced"
	publicAccessPreventionInherited   = "inherited"
)

func (p PublicAccessPrevention) String() string {
	switch p {
	case PublicAccessPreventionInherited, PublicAccessPreventionUnspecified:
		return publicAccessPreventionInherited
	case PublicAccessPreventionEnforced:
		return publicAccessPreventionEnforced
	default:
		return publicAccessPreventionUnknown
	}
}

// Lifecycle is the lifecycle configuration for objects in the bucket.
type Lifecycle struct {
	Rules []LifecycleRule
}

// RetentionPolicy enforces a minimum retention time for all objects
// contained in the bucket.
//
// Any attempt to overwrite or delete objects younger than the retention
// period will result in an error. An unlocked retention policy can be
// modified or removed from the bucket via the Update method. A
// locked retention policy cannot be removed or shortened in duration
// for the lifetime of the bucket.
//
// This feature is in private alpha release. It is not currently available to
// most customers. It might be changed in backwards-incompatible ways and is not
// subject to any SLA or deprecation policy.
type RetentionPolicy struct {
	// RetentionPeriod specifies the duration that objects need to be
	// retained. Retention duration must be greater than zero and less than
	// 100 years. Note that enforcement of retention periods less than a day
	// is not guaranteed. Such periods should only be used for testing
	// purposes.
	RetentionPeriod time.Duration

	// EffectiveTime is the time from which the policy was enforced and
	// effective. This field is read-only.
	EffectiveTime time.Time

	// IsLocked describes whether the bucket is locked. Once locked, an
	// object retention policy cannot be modified.
	// This field is read-only.
	IsLocked bool
}

const (
	// RFC3339 timestamp with only the date segment, used for CreatedBefore,
	// CustomTimeBefore, and NoncurrentTimeBefore in LifecycleRule.
	rfc3339Date = "2006-01-02"

	// DeleteAction is a lifecycle action that deletes a live and/or archived
	// objects. Takes precedence over SetStorageClass actions.
	DeleteAction = "Delete"

	// SetStorageClassAction changes the storage class of live and/or archived
	// objects.
	SetStorageClassAction = "SetStorageClass"

	// AbortIncompleteMPUAction is a lifecycle action that aborts an incomplete
	// multipart upload when the multipart upload meets the conditions specified
	// in the lifecycle rule. The AgeInDays condition is the only allowed
	// condition for this action. AgeInDays is measured from the time the
	// multipart upload was created.
	AbortIncompleteMPUAction = "AbortIncompleteMultipartUpload"
)

// LifecycleRule is a lifecycle configuration rule.
//
// When all the configured conditions are met by an object in the bucket, the
// configured action will automatically be taken on that object.
type LifecycleRule struct {
	// Action is the action to take when all of the associated conditions are
	// met.
	Action LifecycleAction

	// Condition is the set of conditions that must be met for the associated
	// action to be taken.
	Condition LifecycleCondition
}

// LifecycleAction is a lifecycle configuration action.
type LifecycleAction struct {
	// Type is the type of action to take on matching objects.
	//
	// Acceptable values are storage.DeleteAction, storage.SetStorageClassAction,
	// and storage.AbortIncompleteMPUAction.
	Type string

	// StorageClass is the storage class to set on matching objects if the Action
	// is "SetStorageClass".
	StorageClass string
}

// Liveness specifies whether the object is live or not.
type Liveness int

const (
	// LiveAndArchived includes both live and archived objects.
	LiveAndArchived Liveness = iota
	// Live specifies that the object is still live.
	Live
	// Archived specifies that the object is archived.
	Archived
)

// LifecycleCondition is a set of conditions used to match objects and take an
// action automatically.
//
// All configured conditions must be met for the associated action to be taken.
type LifecycleCondition struct {
	// AllObjects is used to select all objects in a bucket by
	// setting AgeInDays to 0.
	AllObjects bool

	// AgeInDays is the age of the object in days.
	// If you want to set AgeInDays to `0` use AllObjects set to `true`.
	AgeInDays int64

	// CreatedBefore is the time the object was created.
	//
	// This condition is satisfied when an object is created before midnight of
	// the specified date in UTC.
	CreatedBefore time.Time

	// CustomTimeBefore is the CustomTime metadata field of the object. This
	// condition is satisfied when an object's CustomTime timestamp is before
	// midnight of the specified date in UTC.
	//
	// This condition can only be satisfied if CustomTime has been set.
	CustomTimeBefore time.Time

	// DaysSinceCustomTime is the days elapsed since the CustomTime date of the
	// object. This condition can only be satisfied if CustomTime has been set.
	// Note: Using `0` as the value will be ignored by the library and not sent to the API.
	DaysSinceCustomTime int64

	// DaysSinceNoncurrentTime is the days elapsed since the noncurrent timestamp
	// of the object. This condition is relevant only for versioned objects.
	// Note: Using `0` as the value will be ignored by the library and not sent to the API.
	DaysSinceNoncurrentTime int64

	// Liveness specifies the object's liveness. Relevant only for versioned objects
	Liveness Liveness

	// MatchesPrefix is the condition matching an object if any of the
	// matches_prefix strings are an exact prefix of the object's name.
	MatchesPrefix []string

	// MatchesStorageClasses is the condition matching the object's storage
	// class.
	//
	// Values include "STANDARD", "NEARLINE", "COLDLINE" and "ARCHIVE".
	MatchesStorageClasses []string

	// MatchesSuffix is the condition matching an object if any of the
	// matches_suffix strings are an exact suffix of the object's name.
	MatchesSuffix []string

	// NoncurrentTimeBefore is the noncurrent timestamp of the object. This
	// condition is satisfied when an object's noncurrent timestamp is before
	// midnight of the specified date in UTC.
	//
	// This condition is relevant only for versioned objects.
	NoncurrentTimeBefore time.Time

	// NumNewerVersions is the condition matching objects with a number of newer versions.
	//
	// If the value is N, this condition is satisfied when there are at least N
	// versions (including the live version) newer than this version of the
	// object.
	// Note: Using `0` as the value will be ignored by the library and not sent to the API.
	NumNewerVersions int64
}

// BucketLogging holds the bucket's logging configuration, which defines the
// destination bucket and optional name prefix for the current bucket's
// logs.
type BucketLogging struct {
	// The destination bucket where the current bucket's logs
	// should be placed.
	LogBucket string

	// A prefix for log object names.
	LogObjectPrefix string
}

// BucketWebsite holds the bucket's website configuration, controlling how the
// service behaves when accessing bucket contents as a web site. See
// https://cloud.google.com/storage/docs/static-website for more information.
type BucketWebsite struct {
	// If the requested object path is missing, the service will ensure the path has
	// a trailing '/', append this suffix, and attempt to retrieve the resulting
	// object. This allows the creation of index.html objects to represent directory
	// pages.
	MainPageSuffix string

	// If the requested object path is missing, and any mainPageSuffix object is
	// missing, if applicable, the service will return the named object from this
	// bucket as the content for a 404 Not Found result.
	NotFoundPage string
}

// CustomPlacementConfig holds the bucket's custom placement
// configuration for Custom Dual Regions. See
// https://cloud.google.com/storage/docs/locations#location-dr for more information.
type CustomPlacementConfig struct {
	// The list of regional locations in which data is placed.
	// Custom Dual Regions require exactly 2 regional locations.
	DataLocations []string
}

// Autoclass holds the bucket's autoclass configuration. If enabled,
// allows for the automatic selection of the best storage class
// based on object access patterns. See
// https://cloud.google.com/storage/docs/using-autoclass for more information.
type Autoclass struct {
	// Enabled specifies whether the autoclass feature is enabled
	// on the bucket.
	Enabled bool
	// ToggleTime is the time from which Autoclass was last toggled.
	// If Autoclass is enabled when the bucket is created, the ToggleTime
	// is set to the bucket creation time. This field is read-only.
	ToggleTime time.Time
	// TerminalStorageClass: The storage class that objects in the bucket
	// eventually transition to if they are not read for a certain length of
	// time. Valid values are NEARLINE and ARCHIVE.
	// To modify TerminalStorageClass, Enabled must be set to true.
	TerminalStorageClass string
	// TerminalStorageClassUpdateTime represents the time of the most recent
	// update to "TerminalStorageClass".
	TerminalStorageClassUpdateTime time.Time
}

// SoftDeletePolicy contains the bucket's soft delete policy, which defines the
// period of time that soft-deleted objects will be retained, and cannot be
// permanently deleted.
type SoftDeletePolicy struct {
	// EffectiveTime indicates the time from which the policy, or one with a
	// greater retention, was effective. This field is read-only.
	EffectiveTime time.Time

	// RetentionDuration is the amount of time that soft-deleted objects in the
	// bucket will be retained and cannot be permanently deleted.
	RetentionDuration time.Duration
}

// HierarchicalNamespace contains the bucket's hierarchical namespace
// configuration. Hierarchical namespace enabled buckets can contain
// [cloud.google.com/go/storage/control/apiv2/controlpb.Folder] resources.
type HierarchicalNamespace struct {
	// Enabled indicates whether hierarchical namespace features are enabled on
	// the bucket. This can only be set at bucket creation time currently.
	Enabled bool
}

func newBucket(b *raw.Bucket) (*BucketAttrs, error) {
	if b == nil {
		return nil, nil
	}
	rp, err := toRetentionPolicy(b.RetentionPolicy)
	if err != nil {
		return nil, err
	}

	return &BucketAttrs{
		Name:                     b.Name,
		Location:                 b.Location,
		MetaGeneration:           b.Metageneration,
		DefaultEventBasedHold:    b.DefaultEventBasedHold,
		StorageClass:             b.StorageClass,
		Created:                  convertTime(b.TimeCreated),
		Updated:                  convertTime(b.Updated),
		VersioningEnabled:        b.Versioning != nil && b.Versioning.Enabled,
		ACL:                      toBucketACLRules(b.Acl),
		DefaultObjectACL:         toObjectACLRules(b.DefaultObjectAcl),
		Labels:                   b.Labels,
		RequesterPays:            b.Billing != nil && b.Billing.RequesterPays,
		Lifecycle:                toLifecycle(b.Lifecycle),
		RetentionPolicy:          rp,
		ObjectRetentionMode:      toBucketObjectRetention(b.ObjectRetention),
		CORS:                     toCORS(b.Cors),
		Encryption:               toBucketEncryption(b.Encryption),
		Logging:                  toBucketLogging(b.Logging),
		Website:                  toBucketWebsite(b.Website),
		BucketPolicyOnly:         toBucketPolicyOnly(b.IamConfiguration),
		UniformBucketLevelAccess: toUniformBucketLevelAccess(b.IamConfiguration),
		PublicAccessPrevention:   toPublicAccessPrevention(b.IamConfiguration),
		Etag:                     b.Etag,
		LocationType:             b.LocationType,
		ProjectNumber:            b.ProjectNumber,
		RPO:                      toRPO(b),
		CustomPlacementConfig:    customPlacementFromRaw(b.CustomPlacementConfig),
		Autoclass:                toAutoclassFromRaw(b.Autoclass),
		SoftDeletePolicy:         toSoftDeletePolicyFromRaw(b.SoftDeletePolicy),
		HierarchicalNamespace:    toHierarchicalNamespaceFromRaw(b.HierarchicalNamespace),
		OwnerEntity:              ownerEntityFromRaw(b.Owner),
	}, nil
}

func newBucketFromProto(b *storagepb.Bucket) *BucketAttrs {
	if b == nil {
		return nil
	}
	return &BucketAttrs{
		Name:                     parseBucketName(b.GetName()),
		Location:                 b.GetLocation(),
		MetaGeneration:           b.GetMetageneration(),
		DefaultEventBasedHold:    b.GetDefaultEventBasedHold(),
		StorageClass:             b.GetStorageClass(),
		Created:                  b.GetCreateTime().AsTime(),
		Updated:                  b.GetUpdateTime().AsTime(),
		VersioningEnabled:        b.GetVersioning().GetEnabled(),
		ACL:                      toBucketACLRulesFromProto(b.GetAcl()),
		DefaultObjectACL:         toObjectACLRulesFromProto(b.GetDefaultObjectAcl()),
		Labels:                   b.GetLabels(),
		RequesterPays:            b.GetBilling().GetRequesterPays(),
		Lifecycle:                toLifecycleFromProto(b.GetLifecycle()),
		RetentionPolicy:          toRetentionPolicyFromProto(b.GetRetentionPolicy()),
		CORS:                     toCORSFromProto(b.GetCors()),
		Encryption:               toBucketEncryptionFromProto(b.GetEncryption()),
		Logging:                  toBucketLoggingFromProto(b.GetLogging()),
		Website:                  toBucketWebsiteFromProto(b.GetWebsite()),
		BucketPolicyOnly:         toBucketPolicyOnlyFromProto(b.GetIamConfig()),
		UniformBucketLevelAccess: toUniformBucketLevelAccessFromProto(b.GetIamConfig()),
		PublicAccessPrevention:   toPublicAccessPreventionFromProto(b.GetIamConfig()),
		LocationType:             b.GetLocationType(),
		RPO:                      toRPOFromProto(b),
		CustomPlacementConfig:    customPlacementFromProto(b.GetCustomPlacementConfig()),
		ProjectNumber:            parseProjectNumber(b.GetProject()), // this can return 0 the project resource name is ID based
		Autoclass:                toAutoclassFromProto(b.GetAutoclass()),
		SoftDeletePolicy:         toSoftDeletePolicyFromProto(b.SoftDeletePolicy),
		HierarchicalNamespace:    toHierarchicalNamespaceFromProto(b.HierarchicalNamespace),
		OwnerEntity:              ownerEntityFromProto(b.GetOwner()),
	}
}

// toRawBucket copies the editable attribute from b to the raw library's Bucket type.
func (b *BucketAttrs) toRawBucket() *raw.Bucket {
	// Copy label map.
	var labels map[string]string
	if len(b.Labels) > 0 {
		labels = make(map[string]string, len(b.Labels))
		for k, v := range b.Labels {
			labels[k] = v
		}
	}
	// Ignore VersioningEnabled if it is false. This is OK because
	// we only call this method when creating a bucket, and by default
	// new buckets have versioning off.
	var v *raw.BucketVersioning
	if b.VersioningEnabled {
		v = &raw.BucketVersioning{Enabled: true}
	}
	var bb *raw.BucketBilling
	if b.RequesterPays {
		bb = &raw.BucketBilling{RequesterPays: true}
	}
	var bktIAM *raw.BucketIamConfiguration
	if b.UniformBucketLevelAccess.Enabled || b.BucketPolicyOnly.Enabled || b.PublicAccessPrevention != PublicAccessPreventionUnknown {
		bktIAM = &raw.BucketIamConfiguration{}
		if b.UniformBucketLevelAccess.Enabled || b.BucketPolicyOnly.Enabled {
			bktIAM.UniformBucketLevelAccess = &raw.BucketIamConfigurationUniformBucketLevelAccess{
				Enabled: true,
			}
		}
		if b.PublicAccessPrevention != PublicAccessPreventionUnknown {
			bktIAM.PublicAccessPrevention = b.PublicAccessPrevention.String()
		}
	}
	return &raw.Bucket{
		Name:                  b.Name,
		Location:              b.Location,
		StorageClass:          b.StorageClass,
		Acl:                   toRawBucketACL(b.ACL),
		DefaultObjectAcl:      toRawObjectACL(b.DefaultObjectACL),
		Versioning:            v,
		Labels:                labels,
		Billing:               bb,
		Lifecycle:             toRawLifecycle(b.Lifecycle),
		RetentionPolicy:       b.RetentionPolicy.toRawRetentionPolicy(),
		Cors:                  toRawCORS(b.CORS),
		Encryption:            b.Encryption.toRawBucketEncryption(),
		Logging:               b.Logging.toRawBucketLogging(),
		Website:               b.Website.toRawBucketWebsite(),
		IamConfiguration:      bktIAM,
		Rpo:                   b.RPO.String(),
		CustomPlacementConfig: b.CustomPlacementConfig.toRawCustomPlacement(),
		Autoclass:             b.Autoclass.toRawAutoclass(),
		SoftDeletePolicy:      b.SoftDeletePolicy.toRawSoftDeletePolicy(),
		HierarchicalNamespace: b.HierarchicalNamespace.toRawHierarchicalNamespace(),
	}
}

func (b *BucketAttrs) toProtoBucket() *storagepb.Bucket {
	if b == nil {
		return &storagepb.Bucket{}
	}

	// Copy label map.
	var labels map[string]string
	if len(b.Labels) > 0 {
		labels = make(map[string]string, len(b.Labels))
		for k, v := range b.Labels {
			labels[k] = v
		}
	}

	// Ignore VersioningEnabled if it is false. This is OK because
	// we only call this method when creating a bucket, and by default
	// new buckets have versioning off.
	var v *storagepb.Bucket_Versioning
	if b.VersioningEnabled {
		v = &storagepb.Bucket_Versioning{Enabled: true}
	}
	var bb *storagepb.Bucket_Billing
	if b.RequesterPays {
		bb = &storagepb.Bucket_Billing{RequesterPays: true}
	}
	var bktIAM *storagepb.Bucket_IamConfig
	if b.UniformBucketLevelAccess.Enabled || b.BucketPolicyOnly.Enabled || b.PublicAccessPrevention != PublicAccessPreventionUnknown {
		bktIAM = &storagepb.Bucket_IamConfig{}
		if b.UniformBucketLevelAccess.Enabled || b.BucketPolicyOnly.Enabled {
			bktIAM.UniformBucketLevelAccess = &storagepb.Bucket_IamConfig_UniformBucketLevelAccess{
				Enabled: true,
			}
		}
		if b.PublicAccessPrevention != PublicAccessPreventionUnknown {
			bktIAM.PublicAccessPrevention = b.PublicAccessPrevention.String()
		}
	}

	return &storagepb.Bucket{
		Name:                  b.Name,
		Location:              b.Location,
		StorageClass:          b.StorageClass,
		Acl:                   toProtoBucketACL(b.ACL),
		DefaultObjectAcl:      toProtoObjectACL(b.DefaultObjectACL),
		Versioning:            v,
		Labels:                labels,
		Billing:               bb,
		Lifecycle:             toProtoLifecycle(b.Lifecycle),
		RetentionPolicy:       b.RetentionPolicy.toProtoRetentionPolicy(),
		Cors:                  toProtoCORS(b.CORS),
		Encryption:            b.Encryption.toProtoBucketEncryption(),
		Logging:               b.Logging.toProtoBucketLogging(),
		Website:               b.Website.toProtoBucketWebsite(),
		IamConfig:             bktIAM,
		Rpo:                   b.RPO.String(),
		CustomPlacementConfig: b.CustomPlacementConfig.toProtoCustomPlacement(),
		Autoclass:             b.Autoclass.toProtoAutoclass(),
		SoftDeletePolicy:      b.SoftDeletePolicy.toProtoSoftDeletePolicy(),
		HierarchicalNamespace: b.HierarchicalNamespace.toProtoHierarchicalNamespace(),
	}
}

func (ua *BucketAttrsToUpdate) toProtoBucket() *storagepb.Bucket {
	if ua == nil {
		return &storagepb.Bucket{}
	}

	var v *storagepb.Bucket_Versioning
	if ua.VersioningEnabled != nil {
		v = &storagepb.Bucket_Versioning{Enabled: optional.ToBool(ua.VersioningEnabled)}
	}
	var bb *storagepb.Bucket_Billing
	if ua.RequesterPays != nil {
		bb = &storagepb.Bucket_Billing{RequesterPays: optional.ToBool(ua.RequesterPays)}
	}

	var bktIAM *storagepb.Bucket_IamConfig
	if ua.UniformBucketLevelAccess != nil || ua.BucketPolicyOnly != nil || ua.PublicAccessPrevention != PublicAccessPreventionUnknown {
		bktIAM = &storagepb.Bucket_IamConfig{}

		if ua.BucketPolicyOnly != nil {
			bktIAM.UniformBucketLevelAccess = &storagepb.Bucket_IamConfig_UniformBucketLevelAccess{
				Enabled: optional.ToBool(ua.BucketPolicyOnly.Enabled),
			}
		}

		if ua.UniformBucketLevelAccess != nil {
			// UniformBucketLevelAccess takes precedence over BucketPolicyOnly,
			// so Enabled will be overriden here if both are set
			bktIAM.UniformBucketLevelAccess = &storagepb.Bucket_IamConfig_UniformBucketLevelAccess{
				Enabled: optional.ToBool(ua.UniformBucketLevelAccess.Enabled),
			}
		}

		if ua.PublicAccessPrevention != PublicAccessPreventionUnknown {
			bktIAM.PublicAccessPrevention = ua.PublicAccessPrevention.String()
		}
	}

	var defaultHold bool
	if ua.DefaultEventBasedHold != nil {
		defaultHold = optional.ToBool(ua.DefaultEventBasedHold)
	}
	var lifecycle Lifecycle
	if ua.Lifecycle != nil {
		lifecycle = *ua.Lifecycle
	}
	var bktACL []*storagepb.BucketAccessControl
	if ua.acl != nil {
		bktACL = toProtoBucketACL(ua.acl)
	}
	if ua.PredefinedACL != "" {
		// Clear ACL or the call will fail.
		bktACL = nil
	}
	var bktDefaultObjectACL []*storagepb.ObjectAccessControl
	if ua.defaultObjectACL != nil {
		bktDefaultObjectACL = toProtoObjectACL(ua.defaultObjectACL)
	}
	if ua.PredefinedDefaultObjectACL != "" {
		// Clear ACLs or the call will fail.
		bktDefaultObjectACL = nil
	}

	return &storagepb.Bucket{
		StorageClass:          ua.StorageClass,
		Acl:                   bktACL,
		DefaultObjectAcl:      bktDefaultObjectACL,
		DefaultEventBasedHold: defaultHold,
		Versioning:            v,
		Billing:               bb,
		Lifecycle:             toProtoLifecycle(lifecycle),
		RetentionPolicy:       ua.RetentionPolicy.toProtoRetentionPolicy(),
		Cors:                  toProtoCORS(ua.CORS),
		Encryption:            ua.Encryption.toProtoBucketEncryption(),
		Logging:               ua.Logging.toProtoBucketLogging(),
		Website:               ua.Website.toProtoBucketWebsite(),
		IamConfig:             bktIAM,
		Rpo:                   ua.RPO.String(),
		Autoclass:             ua.Autoclass.toProtoAutoclass(),
		SoftDeletePolicy:      ua.SoftDeletePolicy.toProtoSoftDeletePolicy(),
		Labels:                ua.setLabels,
	}
}

// CORS is the bucket's Cross-Origin Resource Sharing (CORS) configuration.
type CORS struct {
	// MaxAge is the value to return in the Access-Control-Max-Age
	// header used in preflight responses.
	MaxAge time.Duration

	// Methods is the list of HTTP methods on which to include CORS response
	// headers, (GET, OPTIONS, POST, etc) Note: "*" is permitted in the list
	// of methods, and means "any method".
	Methods []string

	// Origins is the list of Origins eligible to receive CORS response
	// headers. Note: "*" is permitted in the list of origins, and means
	// "any Origin".
	Origins []string

	// ResponseHeaders is the list of HTTP headers other than the simple
	// response headers to give permission for the user-agent to share
	// across domains.
	ResponseHeaders []string
}

// BucketEncryption is a bucket's encryption configuration.
type BucketEncryption struct {
	// A Cloud KMS key name, in the form
	// projects/P/locations/L/keyRings/R/cryptoKeys/K, that will be used to encrypt
	// objects inserted into this bucket, if no encryption method is specified.
	// The key's location must be the same as the bucket's.
	DefaultKMSKeyName string
}

// BucketAttrsToUpdate define the attributes to update during an Update call.
type BucketAttrsToUpdate struct {
	// If set, updates whether the bucket uses versioning.
	VersioningEnabled optional.Bool

	// If set, updates whether the bucket is a Requester Pays bucket.
	RequesterPays optional.Bool

	// DefaultEventBasedHold is the default value for event-based hold on
	// newly created objects in this bucket.
	DefaultEventBasedHold optional.Bool

	// BucketPolicyOnly is an alias for UniformBucketLevelAccess. Use of
	// UniformBucketLevelAccess is recommended above the use of this field.
	// Setting BucketPolicyOnly.Enabled OR UniformBucketLevelAccess.Enabled to
	// true, will enable UniformBucketLevelAccess. If both BucketPolicyOnly and
	// UniformBucketLevelAccess are set, the value of UniformBucketLevelAccess
	// will take precedence.
	BucketPolicyOnly *BucketPolicyOnly

	// UniformBucketLevelAccess configures access checks to use only bucket-level IAM
	// policies and ignore any ACL rules for the bucket.
	// See https://cloud.google.com/storage/docs/uniform-bucket-level-access
	// for more information.
	UniformBucketLevelAccess *UniformBucketLevelAccess

	// PublicAccessPrevention is the setting for the bucket's
	// PublicAccessPrevention policy, which can be used to prevent public access
	// of data in the bucket. See
	// https://cloud.google.com/storage/docs/public-access-prevention for more
	// information.
	PublicAccessPrevention PublicAccessPrevention

	// StorageClass is the default storage class of the bucket. This defines
	// how objects in the bucket are stored and determines the SLA
	// and the cost of storage. Typical values are "STANDARD", "NEARLINE",
	// "COLDLINE" and "ARCHIVE". Defaults to "STANDARD".
	// See https://cloud.google.com/storage/docs/storage-classes for all
	// valid values.
	StorageClass string

	// If set, updates the retention policy of the bucket. Using
	// RetentionPolicy.RetentionPeriod = 0 will delete the existing policy.
	//
	// This feature is in private alpha release. It is not currently available to
	// most customers. It might be changed in backwards-incompatible ways and is not
	// subject to any SLA or deprecation policy.
	RetentionPolicy *RetentionPolicy

	// If set, replaces the CORS configuration with a new configuration.
	// An empty (rather than nil) slice causes all CORS policies to be removed.
	CORS []CORS

	// If set, replaces the encryption configuration of the bucket. Using
	// BucketEncryption.DefaultKMSKeyName = "" will delete the existing
	// configuration.
	Encryption *BucketEncryption

	// If set, replaces the lifecycle configuration of the bucket.
	Lifecycle *Lifecycle

	// If set, replaces the logging configuration of the bucket.
	Logging *BucketLogging

	// If set, replaces the website configuration of the bucket.
	Website *BucketWebsite

	// If not empty, applies a predefined set of access controls.
	// See https://cloud.google.com/storage/docs/json_api/v1/buckets/patch.
	PredefinedACL string

	// If not empty, applies a predefined set of default object access controls.
	// See https://cloud.google.com/storage/docs/json_api/v1/buckets/patch.
	PredefinedDefaultObjectACL string

	// RPO configures the Recovery Point Objective (RPO) policy of the bucket.
	// Set to RPOAsyncTurbo to turn on Turbo Replication for a bucket.
	// See https://cloud.google.com/storage/docs/managing-turbo-replication for
	// more information.
	RPO RPO

	// If set, updates the autoclass configuration of the bucket.
	// To disable autoclass on the bucket, set to an empty &Autoclass{}.
	// To update the configuration for Autoclass.TerminalStorageClass,
	// Autoclass.Enabled must also be set to true.
	// See https://cloud.google.com/storage/docs/using-autoclass for more information.
	Autoclass *Autoclass

	// If set, updates the soft delete policy of the bucket.
	SoftDeletePolicy *SoftDeletePolicy

	// acl is the list of access control rules on the bucket.
	// It is unexported and only used internally by the gRPC client.
	// Library users should use ACLHandle methods directly.
	acl []ACLRule

	// defaultObjectACL is the list of access controls to
	// apply to new objects when no object ACL is provided.
	// It is unexported and only used internally by the gRPC client.
	// Library users should use ACLHandle methods directly.
	defaultObjectACL []ACLRule

	setLabels    map[string]string
	deleteLabels map[string]bool
}

// SetLabel causes a label to be added or modified when ua is used
// in a call to Bucket.Update.
func (ua *BucketAttrsToUpdate) SetLabel(name, value string) {
	if ua.setLabels == nil {
		ua.setLabels = map[string]string{}
	}
	ua.setLabels[name] = value
}

// DeleteLabel causes a label to be deleted when ua is used in a
// call to Bucket.Update.
func (ua *BucketAttrsToUpdate) DeleteLabel(name string) {
	if ua.deleteLabels == nil {
		ua.deleteLabels = map[string]bool{}
	}
	ua.deleteLabels[name] = true
}

func (ua *BucketAttrsToUpdate) toRawBucket() *raw.Bucket {
	rb := &raw.Bucket{}
	if ua.CORS != nil {
		rb.Cors = toRawCORS(ua.CORS)
		rb.ForceSendFields = append(rb.ForceSendFields, "Cors")
	}
	if ua.DefaultEventBasedHold != nil {
		rb.DefaultEventBasedHold = optional.ToBool(ua.DefaultEventBasedHold)
		rb.ForceSendFields = append(rb.ForceSendFields, "DefaultEventBasedHold")
	}
	if ua.RetentionPolicy != nil {
		if ua.RetentionPolicy.RetentionPeriod == 0 {
			rb.NullFields = append(rb.NullFields, "RetentionPolicy")
			rb.RetentionPolicy = nil
		} else {
			rb.RetentionPolicy = ua.RetentionPolicy.toRawRetentionPolicy()
		}
	}
	if ua.VersioningEnabled != nil {
		rb.Versioning = &raw.BucketVersioning{
			Enabled:         optional.ToBool(ua.VersioningEnabled),
			ForceSendFields: []string{"Enabled"},
		}
	}
	if ua.RequesterPays != nil {
		rb.Billing = &raw.BucketBilling{
			RequesterPays:   optional.ToBool(ua.RequesterPays),
			ForceSendFields: []string{"RequesterPays"},
		}
	}
	if ua.BucketPolicyOnly != nil {
		rb.IamConfiguration = &raw.BucketIamConfiguration{
			UniformBucketLevelAccess: &raw.BucketIamConfigurationUniformBucketLevelAccess{
				Enabled:         ua.BucketPolicyOnly.Enabled,
				ForceSendFields: []string{"Enabled"},
			},
		}
	}
	if ua.UniformBucketLevelAccess != nil {
		rb.IamConfiguration = &raw.BucketIamConfiguration{
			UniformBucketLevelAccess: &raw.BucketIamConfigurationUniformBucketLevelAccess{
				Enabled:         ua.UniformBucketLevelAccess.Enabled,
				ForceSendFields: []string{"Enabled"},
			},
		}
	}
	if ua.PublicAccessPrevention != PublicAccessPreventionUnknown {
		if rb.IamConfiguration == nil {
			rb.IamConfiguration = &raw.BucketIamConfiguration{}
		}
		rb.IamConfiguration.PublicAccessPrevention = ua.PublicAccessPrevention.String()
	}
	if ua.Encryption != nil {
		if ua.Encryption.DefaultKMSKeyName == "" {
			rb.NullFields = append(rb.NullFields, "Encryption")
			rb.Encryption = nil
		} else {
			rb.Encryption = ua.Encryption.toRawBucketEncryption()
		}
	}
	if ua.Lifecycle != nil {
		rb.Lifecycle = toRawLifecycle(*ua.Lifecycle)
		rb.ForceSendFields = append(rb.ForceSendFields, "Lifecycle")
	}
	if ua.Logging != nil {
		if *ua.Logging == (BucketLogging{}) {
			rb.NullFields = append(rb.NullFields, "Logging")
			rb.Logging = nil
		} else {
			rb.Logging = ua.Logging.toRawBucketLogging()
		}
	}
	if ua.Website != nil {
		if *ua.Website == (BucketWebsite{}) {
			rb.NullFields = append(rb.NullFields, "Website")
			rb.Website = nil
		} else {
			rb.Website = ua.Website.toRawBucketWebsite()
		}
	}
	if ua.Autoclass != nil {
		rb.Autoclass = &raw.BucketAutoclass{
			Enabled:              ua.Autoclass.Enabled,
			TerminalStorageClass: ua.Autoclass.TerminalStorageClass,
			ForceSendFields:      []string{"Enabled"},
		}
		rb.ForceSendFields = append(rb.ForceSendFields, "Autoclass")
	}
	if ua.SoftDeletePolicy != nil {
		if ua.SoftDeletePolicy.RetentionDuration == 0 {
			rb.SoftDeletePolicy = &raw.BucketSoftDeletePolicy{
				RetentionDurationSeconds: 0,
				ForceSendFields:          []string{"RetentionDurationSeconds"},
			}
		} else {
			rb.SoftDeletePolicy = ua.SoftDeletePolicy.toRawSoftDeletePolicy()
		}
	}
	if ua.PredefinedACL != "" {
		// Clear ACL or the call will fail.
		rb.Acl = nil
		rb.ForceSendFields = append(rb.ForceSendFields, "Acl")
	}
	if ua.PredefinedDefaultObjectACL != "" {
		// Clear ACLs or the call will fail.
		rb.DefaultObjectAcl = nil
		rb.ForceSendFields = append(rb.ForceSendFields, "DefaultObjectAcl")
	}

	rb.StorageClass = ua.StorageClass
	rb.Rpo = ua.RPO.String()

	if ua.setLabels != nil || ua.deleteLabels != nil {
		rb.Labels = map[string]string{}
		for k, v := range ua.setLabels {
			rb.Labels[k] = v
		}
		if len(rb.Labels) == 0 && len(ua.deleteLabels) > 0 {
			rb.ForceSendFields = append(rb.ForceSendFields, "Labels")
		}
		for l := range ua.deleteLabels {
			rb.NullFields = append(rb.NullFields, "Labels."+l)
		}
	}
	return rb
}

// If returns a new BucketHandle that applies a set of preconditions.
// Preconditions already set on the BucketHandle are ignored. The supplied
// BucketConditions must have exactly one field set to a non-zero value;
// otherwise an error will be returned from any operation on the BucketHandle.
// Operations on the new handle will return an error if the preconditions are not
// satisfied. The only valid preconditions for buckets are MetagenerationMatch
// and MetagenerationNotMatch.
func (b *BucketHandle) If(conds BucketConditions) *BucketHandle {
	b2 := *b
	b2.conds = &conds
	return &b2
}

// BucketConditions constrain bucket methods to act on specific metagenerations.
//
// The zero value is an empty set of constraints.
type BucketConditions struct {
	// MetagenerationMatch specifies that the bucket must have the given
	// metageneration for the operation to occur.
	// If MetagenerationMatch is zero, it has no effect.
	MetagenerationMatch int64

	// MetagenerationNotMatch specifies that the bucket must not have the given
	// metageneration for the operation to occur.
	// If MetagenerationNotMatch is zero, it has no effect.
	MetagenerationNotMatch int64
}

func (c *BucketConditions) validate(method string) error {
	if *c == (BucketConditions{}) {
		return fmt.Errorf("storage: %s: empty conditions", method)
	}
	if c.MetagenerationMatch != 0 && c.MetagenerationNotMatch != 0 {
		return fmt.Errorf("storage: %s: multiple conditions specified for metageneration", method)
	}
	return nil
}

// UserProject returns a new BucketHandle that passes the project ID as the user
// project for all subsequent calls. Calls with a user project will be billed to that
// project rather than to the bucket's owning project.
//
// A user project is required for all operations on Requester Pays buckets.
func (b *BucketHandle) UserProject(projectID string) *BucketHandle {
	b2 := *b
	b2.userProject = projectID
	b2.acl.userProject = projectID
	b2.defaultObjectACL.userProject = projectID
	return &b2
}

// LockRetentionPolicy locks a bucket's retention policy until a previously-configured
// RetentionPeriod past the EffectiveTime. Note that if RetentionPeriod is set to less
// than a day, the retention policy is treated as a development configuration and locking
// will have no effect. The BucketHandle must have a metageneration condition that
// matches the bucket's metageneration. See BucketHandle.If.
//
// This feature is in private alpha release. It is not currently available to
// most customers. It might be changed in backwards-incompatible ways and is not
// subject to any SLA or deprecation policy.
func (b *BucketHandle) LockRetentionPolicy(ctx context.Context) error {
	o := makeStorageOpts(true, b.retry, b.userProject)
	return b.c.tc.LockBucketRetentionPolicy(ctx, b.name, b.conds, o...)
}

// SetObjectRetention returns a new BucketHandle that will enable object retention
// on bucket creation. To enable object retention, you must use the returned
// handle to create the bucket. This has no effect on an already existing bucket.
// ObjectRetention is not enabled by default.
// ObjectRetention cannot be configured through the gRPC API.
func (b *BucketHandle) SetObjectRetention(enable bool) *BucketHandle {
	b2 := *b
	b2.enableObjectRetention = &enable
	return &b2
}

// applyBucketConds modifies the provided call using the conditions in conds.
// call is something that quacks like a *raw.WhateverCall.
func applyBucketConds(method string, conds *BucketConditions, call interface{}) error {
	if conds == nil {
		return nil
	}
	if err := conds.validate(method); err != nil {
		return err
	}
	cval := reflect.ValueOf(call)
	switch {
	case conds.MetagenerationMatch != 0:
		if !setIfMetagenerationMatch(cval, conds.MetagenerationMatch) {
			return fmt.Errorf("storage: %s: ifMetagenerationMatch not supported", method)
		}
	case conds.MetagenerationNotMatch != 0:
		if !setIfMetagenerationNotMatch(cval, conds.MetagenerationNotMatch) {
			return fmt.Errorf("storage: %s: ifMetagenerationNotMatch not supported", method)
		}
	}
	return nil
}

// applyBucketConds modifies the provided request message using the conditions
// in conds. msg is a protobuf Message that has fields if_metageneration_match
// and if_metageneration_not_match.
func applyBucketCondsProto(method string, conds *BucketConditions, msg proto.Message) error {
	rmsg := msg.ProtoReflect()

	if conds == nil {
		return nil
	}
	if err := conds.validate(method); err != nil {
		return err
	}

	switch {
	case conds.MetagenerationMatch != 0:
		if !setConditionProtoField(rmsg, "if_metageneration_match", conds.MetagenerationMatch) {
			return fmt.Errorf("storage: %s: ifMetagenerationMatch not supported", method)
		}
	case conds.MetagenerationNotMatch != 0:
		if !setConditionProtoField(rmsg, "if_metageneration_not_match", conds.MetagenerationNotMatch) {
			return fmt.Errorf("storage: %s: ifMetagenerationNotMatch not supported", method)
		}
	}
	return nil
}

func (rp *RetentionPolicy) toRawRetentionPolicy() *raw.BucketRetentionPolicy {
	if rp == nil {
		return nil
	}
	return &raw.BucketRetentionPolicy{
		RetentionPeriod: int64(rp.RetentionPeriod / time.Second),
	}
}

func (rp *RetentionPolicy) toProtoRetentionPolicy() *storagepb.Bucket_RetentionPolicy {
	if rp == nil {
		return nil
	}
	// RetentionPeriod must be greater than 0, so if it is 0, the user left it
	// unset, and so we should not send it in the request i.e. nil is sent.
	var dur *durationpb.Duration
	if rp.RetentionPeriod != 0 {
		dur = durationpb.New(rp.RetentionPeriod)
	}
	return &storagepb.Bucket_RetentionPolicy{
		RetentionDuration: dur,
	}
}

func toRetentionPolicy(rp *raw.BucketRetentionPolicy) (*RetentionPolicy, error) {
	if rp == nil || rp.EffectiveTime == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, rp.EffectiveTime)
	if err != nil {
		return nil, err
	}
	return &RetentionPolicy{
		RetentionPeriod: time.Duration(rp.RetentionPeriod) * time.Second,
		EffectiveTime:   t,
		IsLocked:        rp.IsLocked,
	}, nil
}

func toRetentionPolicyFromProto(rp *storagepb.Bucket_RetentionPolicy) *RetentionPolicy {
	if rp == nil || rp.GetEffectiveTime().AsTime().Unix() == 0 {
		return nil
	}
	return &RetentionPolicy{
		RetentionPeriod: rp.GetRetentionDuration().AsDuration(),
		EffectiveTime:   rp.GetEffectiveTime().AsTime(),
		IsLocked:        rp.GetIsLocked(),
	}
}

func toBucketObjectRetention(or *raw.BucketObjectRetention) string {
	if or == nil {
		return ""
	}
	return or.Mode
}

func toRawCORS(c []CORS) []*raw.BucketCors {
	var out []*raw.BucketCors
	for _, v := range c {
		out = append(out, &raw.BucketCors{
			MaxAgeSeconds:  int64(v.MaxAge / time.Second),
			Method:         v.Methods,
			Origin:         v.Origins,
			ResponseHeader: v.ResponseHeaders,
		})
	}
	return out
}

func toProtoCORS(c []CORS) []*storagepb.Bucket_Cors {
	var out []*storagepb.Bucket_Cors
	for _, v := range c {
		out = append(out, &storagepb.Bucket_Cors{
			MaxAgeSeconds:  int32(v.MaxAge / time.Second),
			Method:         v.Methods,
			Origin:         v.Origins,
			ResponseHeader: v.ResponseHeaders,
		})
	}
	return out
}

func toCORS(rc []*raw.BucketCors) []CORS {
	var out []CORS
	for _, v := range rc {
		out = append(out, CORS{
			MaxAge:          time.Duration(v.MaxAgeSeconds) * time.Second,
			Methods:         v.Method,
			Origins:         v.Origin,
			ResponseHeaders: v.ResponseHeader,
		})
	}
	return out
}

func toCORSFromProto(rc []*storagepb.Bucket_Cors) []CORS {
	var out []CORS
	for _, v := range rc {
		out = append(out, CORS{
			MaxAge:          time.Duration(v.GetMaxAgeSeconds()) * time.Second,
			Methods:         v.GetMethod(),
			Origins:         v.GetOrigin(),
			ResponseHeaders: v.GetResponseHeader(),
		})
	}
	return out
}

func toRawLifecycle(l Lifecycle) *raw.BucketLifecycle {
	var rl raw.BucketLifecycle
	if len(l.Rules) == 0 {
		rl.ForceSendFields = []string{"Rule"}
	}
	for _, r := range l.Rules {
		rr := &raw.BucketLifecycleRule{
			Action: &raw.BucketLifecycleRuleAction{
				Type:         r.Action.Type,
				StorageClass: r.Action.StorageClass,
			},
			Condition: &raw.BucketLifecycleRuleCondition{
				DaysSinceCustomTime:     r.Condition.DaysSinceCustomTime,
				DaysSinceNoncurrentTime: r.Condition.DaysSinceNoncurrentTime,
				MatchesPrefix:           r.Condition.MatchesPrefix,
				MatchesStorageClass:     r.Condition.MatchesStorageClasses,
				MatchesSuffix:           r.Condition.MatchesSuffix,
				NumNewerVersions:        r.Condition.NumNewerVersions,
			},
		}

		// AllObjects takes precedent when both AllObjects and AgeInDays are set
		// Rationale: If you've opted into using AllObjects, it makes sense that you
		// understand the implications of how this option works with AgeInDays.
		if r.Condition.AllObjects {
			rr.Condition.Age = googleapi.Int64(0)
			rr.Condition.ForceSendFields = []string{"Age"}
		} else if r.Condition.AgeInDays > 0 {
			rr.Condition.Age = googleapi.Int64(r.Condition.AgeInDays)
		}

		switch r.Condition.Liveness {
		case LiveAndArchived:
			rr.Condition.IsLive = nil
		case Live:
			rr.Condition.IsLive = googleapi.Bool(true)
		case Archived:
			rr.Condition.IsLive = googleapi.Bool(false)
		}

		if !r.Condition.CreatedBefore.IsZero() {
			rr.Condition.CreatedBefore = r.Condition.CreatedBefore.Format(rfc3339Date)
		}
		if !r.Condition.CustomTimeBefore.IsZero() {
			rr.Condition.CustomTimeBefore = r.Condition.CustomTimeBefore.Format(rfc3339Date)
		}
		if !r.Condition.NoncurrentTimeBefore.IsZero() {
			rr.Condition.NoncurrentTimeBefore = r.Condition.NoncurrentTimeBefore.Format(rfc3339Date)
		}
		rl.Rule = append(rl.Rule, rr)
	}
	return &rl
}

func toProtoLifecycle(l Lifecycle) *storagepb.Bucket_Lifecycle {
	var rl storagepb.Bucket_Lifecycle

	for _, r := range l.Rules {
		rr := &storagepb.Bucket_Lifecycle_Rule{
			Action: &storagepb.Bucket_Lifecycle_Rule_Action{
				Type:         r.Action.Type,
				StorageClass: r.Action.StorageClass,
			},
			Condition: &storagepb.Bucket_Lifecycle_Rule_Condition{
				// Note: The Apiary types use int64 (even though the Discovery
				// doc states "format: int32"), so the client types used int64,
				// but the proto uses int32 so we have a potentially lossy
				// conversion.
				DaysSinceCustomTime:     proto.Int32(int32(r.Condition.DaysSinceCustomTime)),
				DaysSinceNoncurrentTime: proto.Int32(int32(r.Condition.DaysSinceNoncurrentTime)),
				MatchesPrefix:           r.Condition.MatchesPrefix,
				MatchesStorageClass:     r.Condition.MatchesStorageClasses,
				MatchesSuffix:           r.Condition.MatchesSuffix,
				NumNewerVersions:        proto.Int32(int32(r.Condition.NumNewerVersions)),
			},
		}

		// Only set AgeDays in the proto if it is non-zero, or if the user has set
		// Condition.AllObjects.
		if r.Condition.AgeInDays != 0 {
			rr.Condition.AgeDays = proto.Int32(int32(r.Condition.AgeInDays))
		}
		if r.Condition.AllObjects {
			rr.Condition.AgeDays = proto.Int32(0)
		}

		switch r.Condition.Liveness {
		case LiveAndArchived:
			rr.Condition.IsLive = nil
		case Live:
			rr.Condition.IsLive = proto.Bool(true)
		case Archived:
			rr.Condition.IsLive = proto.Bool(false)
		}

		if !r.Condition.CreatedBefore.IsZero() {
			rr.Condition.CreatedBefore = timeToProtoDate(r.Condition.CreatedBefore)
		}
		if !r.Condition.CustomTimeBefore.IsZero() {
			rr.Condition.CustomTimeBefore = timeToProtoDate(r.Condition.CustomTimeBefore)
		}
		if !r.Condition.NoncurrentTimeBefore.IsZero() {
			rr.Condition.NoncurrentTimeBefore = timeToProtoDate(r.Condition.NoncurrentTimeBefore)
		}
		rl.Rule = append(rl.Rule, rr)
	}
	return &rl
}

func toLifecycle(rl *raw.BucketLifecycle) Lifecycle {
	var l Lifecycle
	if rl == nil {
		return l
	}
	for _, rr := range rl.Rule {
		r := LifecycleRule{
			Action: LifecycleAction{
				Type:         rr.Action.Type,
				StorageClass: rr.Action.StorageClass,
			},
			Condition: LifecycleCondition{
				DaysSinceCustomTime:     rr.Condition.DaysSinceCustomTime,
				DaysSinceNoncurrentTime: rr.Condition.DaysSinceNoncurrentTime,
				MatchesPrefix:           rr.Condition.MatchesPrefix,
				MatchesStorageClasses:   rr.Condition.MatchesStorageClass,
				MatchesSuffix:           rr.Condition.MatchesSuffix,
				NumNewerVersions:        rr.Condition.NumNewerVersions,
			},
		}
		if rr.Condition.Age != nil {
			r.Condition.AgeInDays = *rr.Condition.Age
			if *rr.Condition.Age == 0 {
				r.Condition.AllObjects = true
			}
		}

		if rr.Condition.IsLive == nil {
			r.Condition.Liveness = LiveAndArchived
		} else if *rr.Condition.IsLive {
			r.Condition.Liveness = Live
		} else {
			r.Condition.Liveness = Archived
		}

		if rr.Condition.CreatedBefore != "" {
			r.Condition.CreatedBefore, _ = time.Parse(rfc3339Date, rr.Condition.CreatedBefore)
		}
		if rr.Condition.CustomTimeBefore != "" {
			r.Condition.CustomTimeBefore, _ = time.Parse(rfc3339Date, rr.Condition.CustomTimeBefore)
		}
		if rr.Condition.NoncurrentTimeBefore != "" {
			r.Condition.NoncurrentTimeBefore, _ = time.Parse(rfc3339Date, rr.Condition.NoncurrentTimeBefore)
		}
		l.Rules = append(l.Rules, r)
	}
	return l
}

func toLifecycleFromProto(rl *storagepb.Bucket_Lifecycle) Lifecycle {
	var l Lifecycle
	if rl == nil {
		return l
	}
	for _, rr := range rl.GetRule() {
		r := LifecycleRule{
			Action: LifecycleAction{
				Type:         rr.GetAction().GetType(),
				StorageClass: rr.GetAction().GetStorageClass(),
			},
			Condition: LifecycleCondition{
				AgeInDays:               int64(rr.GetCondition().GetAgeDays()),
				DaysSinceCustomTime:     int64(rr.GetCondition().GetDaysSinceCustomTime()),
				DaysSinceNoncurrentTime: int64(rr.GetCondition().GetDaysSinceNoncurrentTime()),
				MatchesPrefix:           rr.GetCondition().GetMatchesPrefix(),
				MatchesStorageClasses:   rr.GetCondition().GetMatchesStorageClass(),
				MatchesSuffix:           rr.GetCondition().GetMatchesSuffix(),
				NumNewerVersions:        int64(rr.GetCondition().GetNumNewerVersions()),
			},
		}

		// Only set Condition.AllObjects if AgeDays is zero, not if it is nil.
		if rr.GetCondition().AgeDays != nil && rr.GetCondition().GetAgeDays() == 0 {
			r.Condition.AllObjects = true
		}

		if rr.GetCondition().IsLive == nil {
			r.Condition.Liveness = LiveAndArchived
		} else if rr.GetCondition().GetIsLive() {
			r.Condition.Liveness = Live
		} else {
			r.Condition.Liveness = Archived
		}

		if rr.GetCondition().GetCreatedBefore() != nil {
			r.Condition.CreatedBefore = protoDateToUTCTime(rr.GetCondition().GetCreatedBefore())
		}
		if rr.GetCondition().GetCustomTimeBefore() != nil {
			r.Condition.CustomTimeBefore = protoDateToUTCTime(rr.GetCondition().GetCustomTimeBefore())
		}
		if rr.GetCondition().GetNoncurrentTimeBefore() != nil {
			r.Condition.NoncurrentTimeBefore = protoDateToUTCTime(rr.GetCondition().GetNoncurrentTimeBefore())
		}
		l.Rules = append(l.Rules, r)
	}
	return l
}

func (e *BucketEncryption) toRawBucketEncryption() *raw.BucketEncryption {
	if e == nil {
		return nil
	}
	return &raw.BucketEncryption{
		DefaultKmsKeyName: e.DefaultKMSKeyName,
	}
}

func (e *BucketEncryption) toProtoBucketEncryption() *storagepb.Bucket_Encryption {
	if e == nil {
		return nil
	}
	return &storagepb.Bucket_Encryption{
		DefaultKmsKey: e.DefaultKMSKeyName,
	}
}

func toBucketEncryption(e *raw.BucketEncryption) *BucketEncryption {
	if e == nil {
		return nil
	}
	return &BucketEncryption{DefaultKMSKeyName: e.DefaultKmsKeyName}
}

func toBucketEncryptionFromProto(e *storagepb.Bucket_Encryption) *BucketEncryption {
	if e == nil {
		return nil
	}
	return &BucketEncryption{DefaultKMSKeyName: e.GetDefaultKmsKey()}
}

func (b *BucketLogging) toRawBucketLogging() *raw.BucketLogging {
	if b == nil {
		return nil
	}
	return &raw.BucketLogging{
		LogBucket:       b.LogBucket,
		LogObjectPrefix: b.LogObjectPrefix,
	}
}

func (b *BucketLogging) toProtoBucketLogging() *storagepb.Bucket_Logging {
	if b == nil {
		return nil
	}
	return &storagepb.Bucket_Logging{
		LogBucket:       bucketResourceName(globalProjectAlias, b.LogBucket),
		LogObjectPrefix: b.LogObjectPrefix,
	}
}

func toBucketLogging(b *raw.BucketLogging) *BucketLogging {
	if b == nil {
		return nil
	}
	return &BucketLogging{
		LogBucket:       b.LogBucket,
		LogObjectPrefix: b.LogObjectPrefix,
	}
}

func toBucketLoggingFromProto(b *storagepb.Bucket_Logging) *BucketLogging {
	if b == nil {
		return nil
	}
	lb := parseBucketName(b.GetLogBucket())
	return &BucketLogging{
		LogBucket:       lb,
		LogObjectPrefix: b.GetLogObjectPrefix(),
	}
}

func (w *BucketWebsite) toRawBucketWebsite() *raw.BucketWebsite {
	if w == nil {
		return nil
	}
	return &raw.BucketWebsite{
		MainPageSuffix: w.MainPageSuffix,
		NotFoundPage:   w.NotFoundPage,
	}
}

func (w *BucketWebsite) toProtoBucketWebsite() *storagepb.Bucket_Website {
	if w == nil {
		return nil
	}
	return &storagepb.Bucket_Website{
		MainPageSuffix: w.MainPageSuffix,
		NotFoundPage:   w.NotFoundPage,
	}
}

func toBucketWebsite(w *raw.BucketWebsite) *BucketWebsite {
	if w == nil {
		return nil
	}
	return &BucketWebsite{
		MainPageSuffix: w.MainPageSuffix,
		NotFoundPage:   w.NotFoundPage,
	}
}

func toBucketWebsiteFromProto(w *storagepb.Bucket_Website) *BucketWebsite {
	if w == nil {
		return nil
	}
	return &BucketWebsite{
		MainPageSuffix: w.GetMainPageSuffix(),
		NotFoundPage:   w.GetNotFoundPage(),
	}
}

func toBucketPolicyOnly(b *raw.BucketIamConfiguration) BucketPolicyOnly {
	if b == nil || b.BucketPolicyOnly == nil || !b.BucketPolicyOnly.Enabled {
		return BucketPolicyOnly{}
	}
	lt, err := time.Parse(time.RFC3339, b.BucketPolicyOnly.LockedTime)
	if err != nil {
		return BucketPolicyOnly{
			Enabled: true,
		}
	}
	return BucketPolicyOnly{
		Enabled:    true,
		LockedTime: lt,
	}
}

func toBucketPolicyOnlyFromProto(b *storagepb.Bucket_IamConfig) BucketPolicyOnly {
	if b == nil || !b.GetUniformBucketLevelAccess().GetEnabled() {
		return BucketPolicyOnly{}
	}
	return BucketPolicyOnly{
		Enabled:    true,
		LockedTime: b.GetUniformBucketLevelAccess().GetLockTime().AsTime(),
	}
}

func toUniformBucketLevelAccess(b *raw.BucketIamConfiguration) UniformBucketLevelAccess {
	if b == nil || b.UniformBucketLevelAccess == nil || !b.UniformBucketLevelAccess.Enabled {
		return UniformBucketLevelAccess{}
	}
	lt, err := time.Parse(time.RFC3339, b.UniformBucketLevelAccess.LockedTime)
	if err != nil {
		return UniformBucketLevelAccess{
			Enabled: true,
		}
	}
	return UniformBucketLevelAccess{
		Enabled:    true,
		LockedTime: lt,
	}
}

func toUniformBucketLevelAccessFromProto(b *storagepb.Bucket_IamConfig) UniformBucketLevelAccess {
	if b == nil || !b.GetUniformBucketLevelAccess().GetEnabled() {
		return UniformBucketLevelAccess{}
	}
	return UniformBucketLevelAccess{
		Enabled:    true,
		LockedTime: b.GetUniformBucketLevelAccess().GetLockTime().AsTime(),
	}
}

func toPublicAccessPrevention(b *raw.BucketIamConfiguration) PublicAccessPrevention {
	if b == nil {
		return PublicAccessPreventionUnknown
	}
	switch b.PublicAccessPrevention {
	case publicAccessPreventionInherited, publicAccessPreventionUnspecified:
		return PublicAccessPreventionInherited
	case publicAccessPreventionEnforced:
		return PublicAccessPreventionEnforced
	default:
		return PublicAccessPreventionUnknown
	}
}

func toPublicAccessPreventionFromProto(b *storagepb.Bucket_IamConfig) PublicAccessPrevention {
	if b == nil {
		return PublicAccessPreventionUnknown
	}
	switch b.GetPublicAccessPrevention() {
	case publicAccessPreventionInherited, publicAccessPreventionUnspecified:
		return PublicAccessPreventionInherited
	case publicAccessPreventionEnforced:
		return PublicAccessPreventionEnforced
	default:
		return PublicAccessPreventionUnknown
	}
}

func toRPO(b *raw.Bucket) RPO {
	if b == nil {
		return RPOUnknown
	}
	switch b.Rpo {
	case rpoDefault:
		return RPODefault
	case rpoAsyncTurbo:
		return RPOAsyncTurbo
	default:
		return RPOUnknown
	}
}

func toRPOFromProto(b *storagepb.Bucket) RPO {
	if b == nil {
		return RPOUnknown
	}
	switch b.GetRpo() {
	case rpoDefault:
		return RPODefault
	case rpoAsyncTurbo:
		return RPOAsyncTurbo
	default:
		return RPOUnknown
	}
}

func customPlacementFromRaw(c *raw.BucketCustomPlacementConfig) *CustomPlacementConfig {
	if c == nil {
		return nil
	}
	return &CustomPlacementConfig{DataLocations: c.DataLocations}
}

func (c *CustomPlacementConfig) toRawCustomPlacement() *raw.BucketCustomPlacementConfig {
	if c == nil {
		return nil
	}
	return &raw.BucketCustomPlacementConfig{
		DataLocations: c.DataLocations,
	}
}

func (c *CustomPlacementConfig) toProtoCustomPlacement() *storagepb.Bucket_CustomPlacementConfig {
	if c == nil {
		return nil
	}
	return &storagepb.Bucket_CustomPlacementConfig{
		DataLocations: c.DataLocations,
	}
}

func customPlacementFromProto(c *storagepb.Bucket_CustomPlacementConfig) *CustomPlacementConfig {
	if c == nil {
		return nil
	}
	return &CustomPlacementConfig{DataLocations: c.GetDataLocations()}
}

func (a *Autoclass) toRawAutoclass() *raw.BucketAutoclass {
	if a == nil {
		return nil
	}
	// Excluding read only fields ToggleTime and TerminalStorageClassUpdateTime.
	return &raw.BucketAutoclass{
		Enabled:              a.Enabled,
		TerminalStorageClass: a.TerminalStorageClass,
	}
}

func (a *Autoclass) toProtoAutoclass() *storagepb.Bucket_Autoclass {
	if a == nil {
		return nil
	}
	// Excluding read only fields ToggleTime and TerminalStorageClassUpdateTime.
	ba := &storagepb.Bucket_Autoclass{
		Enabled: a.Enabled,
	}
	if a.TerminalStorageClass != "" {
		ba.TerminalStorageClass = &a.TerminalStorageClass
	}
	return ba
}

func toAutoclassFromRaw(a *raw.BucketAutoclass) *Autoclass {
	if a == nil || a.ToggleTime == "" {
		return nil
	}
	ac := &Autoclass{
		Enabled:              a.Enabled,
		TerminalStorageClass: a.TerminalStorageClass,
	}
	// Return ToggleTime and TSCUpdateTime only if parsed with valid values.
	t, err := time.Parse(time.RFC3339, a.ToggleTime)
	if err == nil {
		ac.ToggleTime = t
	}
	ut, err := time.Parse(time.RFC3339, a.TerminalStorageClassUpdateTime)
	if err == nil {
		ac.TerminalStorageClassUpdateTime = ut
	}
	return ac
}

func toAutoclassFromProto(a *storagepb.Bucket_Autoclass) *Autoclass {
	if a == nil || a.GetToggleTime().AsTime().Unix() == 0 {
		return nil
	}
	return &Autoclass{
		Enabled:                        a.GetEnabled(),
		ToggleTime:                     a.GetToggleTime().AsTime(),
		TerminalStorageClass:           a.GetTerminalStorageClass(),
		TerminalStorageClassUpdateTime: a.GetTerminalStorageClassUpdateTime().AsTime(),
	}
}

func (p *SoftDeletePolicy) toRawSoftDeletePolicy() *raw.BucketSoftDeletePolicy {
	if p == nil {
		return nil
	}
	// Excluding read only field EffectiveTime.
	// ForceSendFields must be set to send a zero value for RetentionDuration and disable
	// soft delete.
	return &raw.BucketSoftDeletePolicy{
		RetentionDurationSeconds: int64(p.RetentionDuration.Seconds()),
		ForceSendFields:          []string{"RetentionDurationSeconds"},
	}
}

func (p *SoftDeletePolicy) toProtoSoftDeletePolicy() *storagepb.Bucket_SoftDeletePolicy {
	if p == nil {
		return nil
	}
	// Excluding read only field EffectiveTime.
	return &storagepb.Bucket_SoftDeletePolicy{
		RetentionDuration: durationpb.New(p.RetentionDuration),
	}
}

func toSoftDeletePolicyFromRaw(p *raw.BucketSoftDeletePolicy) *SoftDeletePolicy {
	if p == nil {
		return nil
	}

	policy := &SoftDeletePolicy{
		RetentionDuration: time.Duration(p.RetentionDurationSeconds) * time.Second,
	}

	// Return EffectiveTime only if parsed to a valid value.
	if t, err := time.Parse(time.RFC3339, p.EffectiveTime); err == nil {
		policy.EffectiveTime = t
	}

	return policy
}

func toSoftDeletePolicyFromProto(p *storagepb.Bucket_SoftDeletePolicy) *SoftDeletePolicy {
	if p == nil {
		return nil
	}
	return &SoftDeletePolicy{
		EffectiveTime:     p.GetEffectiveTime().AsTime(),
		RetentionDuration: p.GetRetentionDuration().AsDuration(),
	}
}

func (hns *HierarchicalNamespace) toProtoHierarchicalNamespace() *storagepb.Bucket_HierarchicalNamespace {
	if hns == nil {
		return nil
	}
	return &storagepb.Bucket_HierarchicalNamespace{
		Enabled: hns.Enabled,
	}
}

func (hns *HierarchicalNamespace) toRawHierarchicalNamespace() *raw.BucketHierarchicalNamespace {
	if hns == nil {
		return nil
	}
	return &raw.BucketHierarchicalNamespace{
		Enabled: hns.Enabled,
	}
}

func toHierarchicalNamespaceFromProto(p *storagepb.Bucket_HierarchicalNamespace) *HierarchicalNamespace {
	if p == nil {
		return nil
	}
	return &HierarchicalNamespace{
		Enabled: p.Enabled,
	}
}

func toHierarchicalNamespaceFromRaw(r *raw.BucketHierarchicalNamespace) *HierarchicalNamespace {
	if r == nil {
		return nil
	}
	return &HierarchicalNamespace{
		Enabled: r.Enabled,
	}
}

func ownerEntityFromRaw(r *raw.BucketOwner) string {
	if r == nil {
		return ""
	}
	return r.Entity
}

func ownerEntityFromProto(p *storagepb.Owner) string {
	if p == nil {
		return ""
	}
	return p.GetEntity()
}

// Objects returns an iterator over the objects in the bucket that match the
// Query q. If q is nil, no filtering is done. Objects will be iterated over
// lexicographically by name.
//
// Note: The returned iterator is not safe for concurrent operations without explicit synchronization.
func (b *BucketHandle) Objects(ctx context.Context, q *Query) *ObjectIterator {
	o := makeStorageOpts(true, b.retry, b.userProject)
	return b.c.tc.ListObjects(ctx, b.name, q, o...)
}

// Retryer returns a bucket handle that is configured with custom retry
// behavior as specified by the options that are passed to it. All operations
// on the new handle will use the customized retry configuration.
// Retry options set on a object handle will take precedence over options set on
// the bucket handle.
// These retry options will merge with the client's retry configuration (if set)
// for the returned handle. Options passed into this method will take precedence
// over retry options on the client. Note that you must explicitly pass in each
// option you want to override.
func (b *BucketHandle) Retryer(opts ...RetryOption) *BucketHandle {
	b2 := *b
	var retry *retryConfig
	if b.retry != nil {
		// merge the options with the existing retry
		retry = b.retry
	} else {
		retry = &retryConfig{}
	}
	for _, opt := range opts {
		opt.apply(retry)
	}
	b2.retry = retry
	b2.acl.retry = retry
	b2.defaultObjectACL.retry = retry
	return &b2
}

// An ObjectIterator is an iterator over ObjectAttrs.
//
// Note: This iterator is not safe for concurrent operations without explicit synchronization.
type ObjectIterator struct {
	ctx      context.Context
	query    Query
	pageInfo *iterator.PageInfo
	nextFunc func() error
	items    []*ObjectAttrs
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
//
// Note: This method is not safe for concurrent operations without explicit synchronization.
func (it *ObjectIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

// Next returns the next result. Its second return value is iterator.Done if
// there are no more results. Once Next returns iterator.Done, all subsequent
// calls will return iterator.Done.
//
// In addition, if Next returns an error other than iterator.Done, all
// subsequent calls will return the same error. To continue iteration, a new
// `ObjectIterator` must be created. Since objects are ordered lexicographically
// by name, `Query.StartOffset` can be used to create a new iterator which will
// start at the desired place. See
// https://pkg.go.dev/cloud.google.com/go/storage?tab=doc#hdr-Listing_objects.
//
// If Query.Delimiter is non-empty, some of the ObjectAttrs returned by Next will
// have a non-empty Prefix field, and a zero value for all other fields. These
// represent prefixes.
//
// Note: This method is not safe for concurrent operations without explicit synchronization.
func (it *ObjectIterator) Next() (*ObjectAttrs, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	item := it.items[0]
	it.items = it.items[1:]
	return item, nil
}

// Buckets returns an iterator over the buckets in the project. You may
// optionally set the iterator's Prefix field to restrict the list to buckets
// whose names begin with the prefix. By default, all buckets in the project
// are returned.
//
// Note: The returned iterator is not safe for concurrent operations without explicit synchronization.
func (c *Client) Buckets(ctx context.Context, projectID string) *BucketIterator {
	o := makeStorageOpts(true, c.retry, "")
	return c.tc.ListBuckets(ctx, projectID, o...)
}

// A BucketIterator is an iterator over BucketAttrs.
//
// Note: This iterator is not safe for concurrent operations without explicit synchronization.
type BucketIterator struct {
	// Prefix restricts the iterator to buckets whose names begin with it.
	Prefix string

	ctx       context.Context
	projectID string
	buckets   []*BucketAttrs
	pageInfo  *iterator.PageInfo
	nextFunc  func() error
}

// Next returns the next result. Its second return value is iterator.Done if
// there are no more results. Once Next returns iterator.Done, all subsequent
// calls will return iterator.Done.
//
// Note: This method is not safe for concurrent operations without explicit synchronization.
func (it *BucketIterator) Next() (*BucketAttrs, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	b := it.buckets[0]
	it.buckets = it.buckets[1:]
	return b, nil
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
//
// Note: This method is not safe for concurrent operations without explicit synchronization.
func (it *BucketIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

// RPO (Recovery Point Objective) configures the turbo replication feature. See
// https://cloud.google.com/storage/docs/managing-turbo-replication for more information.
type RPO int

const (
	// RPOUnknown is a zero value. It may be returned from bucket.Attrs() if RPO
	// is not present in the bucket metadata, that is, the bucket is not dual-region.
	// This value is also used if the RPO field is not set in a call to GCS.
	RPOUnknown RPO = iota

	// RPODefault represents default replication. It is used to reset RPO on an
	// existing bucket  that has this field set to RPOAsyncTurbo. Otherwise it
	// is equivalent to RPOUnknown, and is always ignored. This value is valid
	// for dual- or multi-region buckets.
	RPODefault

	// RPOAsyncTurbo represents turbo replication and is used to enable Turbo
	// Replication on a bucket. This value is only valid for dual-region buckets.
	RPOAsyncTurbo

	rpoUnknown    string = ""
	rpoDefault           = "DEFAULT"
	rpoAsyncTurbo        = "ASYNC_TURBO"
)

func (rpo RPO) String() string {
	switch rpo {
	case RPODefault:
		return rpoDefault
	case RPOAsyncTurbo:
		return rpoAsyncTurbo
	default:
		return rpoUnknown
	}
}

// protoDateToUTCTime returns a new Time based on the google.type.Date, in UTC.
//
// Hours, minutes, seconds, and nanoseconds are set to 0.
func protoDateToUTCTime(d *dpb.Date) time.Time {
	return protoDateToTime(d, time.UTC)
}

// protoDateToTime returns a new Time based on the google.type.Date and provided
// *time.Location.
//
// Hours, minutes, seconds, and nanoseconds are set to 0.
func protoDateToTime(d *dpb.Date, l *time.Location) time.Time {
	return time.Date(int(d.GetYear()), time.Month(d.GetMonth()), int(d.GetDay()), 0, 0, 0, 0, l)
}

// timeToProtoDate returns a new google.type.Date based on the provided time.Time.
// The location is ignored, as is anything more precise than the day.
func timeToProtoDate(t time.Time) *dpb.Date {
	return &dpb.Date{
		Year:  int32(t.Year()),
		Month: int32(t.Month()),
		Day:   int32(t.Day()),
	}
}
