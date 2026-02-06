package s3

import (
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3/internal/customizations"
)

// If the caller hasn't provided an S3Express provider, we use our default
// which will grab a reference to the S3 client itself in finalization.
func resolveExpressCredentials(o *Options) {
	if o.ExpressCredentials == nil {
		o.ExpressCredentials = newDefaultS3ExpressCredentialsProvider()
	}
}

// Config finalizer: if we're using the default S3Express implementation, grab
// a reference to the client for its CreateSession API, and the underlying
// sigv4 credentials provider for cache keying.
func finalizeExpressCredentials(o *Options, c *Client) {
	if p, ok := o.ExpressCredentials.(*defaultS3ExpressCredentialsProvider); ok {
		p.client = c
		p.v4creds = o.Credentials
	}
}

// Operation config finalizer: update the sigv4 credentials on the default
// express provider in case it changed to ensure different cache keys
func finalizeOperationExpressCredentials(o *Options, c Client) {
	if p, ok := o.ExpressCredentials.(*defaultS3ExpressCredentialsProvider); ok {
		o.ExpressCredentials = p.CloneWithBaseCredentials(o.Credentials)
	}
}

// NewFromConfig resolver: pull from opaque sources if it exists.
func resolveDisableExpressAuth(cfg aws.Config, o *Options) {
	if v, ok := customizations.ResolveDisableExpressAuth(cfg.ConfigSources); ok {
		o.DisableS3ExpressSessionAuth = &v
	}
}
