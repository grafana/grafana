package s3

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/aws-sdk-go-v2/internal/sync/singleflight"
	"github.com/aws/smithy-go/container/private/cache"
	"github.com/aws/smithy-go/container/private/cache/lru"
)

const s3ExpressCacheCap = 100

const s3ExpressRefreshWindow = 1 * time.Minute

type cacheKey struct {
	CredentialsHash string // hmac(sigv4 akid, sigv4 secret)
	Bucket          string
}

func (c cacheKey) Slug() string {
	return fmt.Sprintf("%s%s", c.CredentialsHash, c.Bucket)
}

type sessionCredsCache struct {
	mu    sync.Mutex
	cache cache.Cache
}

func (c *sessionCredsCache) Get(key cacheKey) (*aws.Credentials, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if v, ok := c.cache.Get(key); ok {
		return v.(*aws.Credentials), true
	}
	return nil, false
}

func (c *sessionCredsCache) Put(key cacheKey, creds *aws.Credentials) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache.Put(key, creds)
}

// The default S3Express provider uses an LRU cache with a capacity of 100.
//
// Credentials will be refreshed asynchronously when a Retrieve() call is made
// for cached credentials within an expiry window (1 minute, currently
// non-configurable).
type defaultS3ExpressCredentialsProvider struct {
	sf singleflight.Group

	client        createSessionAPIClient
	cache         *sessionCredsCache
	refreshWindow time.Duration
	v4creds       aws.CredentialsProvider // underlying credentials used for CreateSession
}

type createSessionAPIClient interface {
	CreateSession(context.Context, *CreateSessionInput, ...func(*Options)) (*CreateSessionOutput, error)
}

func newDefaultS3ExpressCredentialsProvider() *defaultS3ExpressCredentialsProvider {
	return &defaultS3ExpressCredentialsProvider{
		cache: &sessionCredsCache{
			cache: lru.New(s3ExpressCacheCap),
		},
		refreshWindow: s3ExpressRefreshWindow,
	}
}

// returns a cloned provider using new base credentials, used when per-op
// config mutations change the credentials provider
func (p *defaultS3ExpressCredentialsProvider) CloneWithBaseCredentials(v4creds aws.CredentialsProvider) *defaultS3ExpressCredentialsProvider {
	return &defaultS3ExpressCredentialsProvider{
		client:        p.client,
		cache:         p.cache,
		refreshWindow: p.refreshWindow,
		v4creds:       v4creds,
	}
}

func (p *defaultS3ExpressCredentialsProvider) Retrieve(ctx context.Context, bucket string) (aws.Credentials, error) {
	v4creds, err := p.v4creds.Retrieve(ctx)
	if err != nil {
		return aws.Credentials{}, fmt.Errorf("get sigv4 creds: %w", err)
	}

	key := cacheKey{
		CredentialsHash: gethmac(v4creds.AccessKeyID, v4creds.SecretAccessKey),
		Bucket:          bucket,
	}
	creds, ok := p.cache.Get(key)
	if !ok || creds.Expired() {
		return p.awaitDoChanRetrieve(ctx, key)
	}

	if creds.Expires.Sub(sdk.NowTime()) <= p.refreshWindow {
		p.doChanRetrieve(ctx, key)
	}

	return *creds, nil
}

func (p *defaultS3ExpressCredentialsProvider) doChanRetrieve(ctx context.Context, key cacheKey) <-chan singleflight.Result {
	return p.sf.DoChan(key.Slug(), func() (interface{}, error) {
		return p.retrieve(ctx, key)
	})
}

func (p *defaultS3ExpressCredentialsProvider) awaitDoChanRetrieve(ctx context.Context, key cacheKey) (aws.Credentials, error) {
	ch := p.doChanRetrieve(ctx, key)

	select {
	case r := <-ch:
		return r.Val.(aws.Credentials), r.Err
	case <-ctx.Done():
		return aws.Credentials{}, errors.New("s3express retrieve credentials canceled")
	}
}

func (p *defaultS3ExpressCredentialsProvider) retrieve(ctx context.Context, key cacheKey) (aws.Credentials, error) {
	resp, err := p.client.CreateSession(ctx, &CreateSessionInput{
		Bucket: aws.String(key.Bucket),
	})
	if err != nil {
		return aws.Credentials{}, err
	}

	creds, err := credentialsFromResponse(resp)
	if err != nil {
		return aws.Credentials{}, err
	}

	p.cache.Put(key, creds)
	return *creds, nil
}

func credentialsFromResponse(o *CreateSessionOutput) (*aws.Credentials, error) {
	if o.Credentials == nil {
		return nil, errors.New("s3express session credentials unset")
	}

	if o.Credentials.AccessKeyId == nil || o.Credentials.SecretAccessKey == nil || o.Credentials.SessionToken == nil || o.Credentials.Expiration == nil {
		return nil, errors.New("s3express session credentials missing one or more required fields")
	}

	return &aws.Credentials{
		AccessKeyID:     *o.Credentials.AccessKeyId,
		SecretAccessKey: *o.Credentials.SecretAccessKey,
		SessionToken:    *o.Credentials.SessionToken,
		CanExpire:       true,
		Expires:         *o.Credentials.Expiration,
	}, nil
}

func gethmac(p, key string) string {
	hash := hmac.New(sha256.New, []byte(key))
	hash.Write([]byte(p))
	return string(hash.Sum(nil))
}
