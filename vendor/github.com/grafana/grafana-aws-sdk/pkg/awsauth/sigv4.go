package awsauth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const EmptySha256Hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

func NewSigV4Middleware(signerOpts ...func(signer *v4.SignerOptions)) httpclient.Middleware {
	return SignerMiddleware{signerOpts}
}

type SignerMiddleware struct {
	signerOpts []func(*v4.SignerOptions)
}

func (s SignerMiddleware) CreateMiddleware(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
	if opts.SigV4 == nil {
		return next
	}
	return NewSignerRoundTripper(opts, next, v4.NewSigner(s.signerOpts...))
}

func (s SignerMiddleware) MiddlewareName() string {
	return "sigv4"
}

func NewSignerRoundTripper(opts httpclient.Options, next http.RoundTripper, signer v4.HTTPSigner) SignerRoundTripper {
	return SignerRoundTripper{
		httpOptions:       opts,
		next:              next,
		awsConfigProvider: NewConfigProvider(),
		signer:            signer,
		clock:             systemClock{},
	}
}

type SignerRoundTripper struct {
	httpOptions       httpclient.Options
	next              http.RoundTripper
	awsConfigProvider ConfigProvider
	signer            v4.HTTPSigner
	clock             Clock
}

func (s SignerRoundTripper) RoundTrip(req *http.Request) (resp *http.Response, e error) {
	defer func() {
		if err := recover(); err != nil {
			e = fmt.Errorf("panic caught in SignerRoundTripper.RoundTrip(): %v", err)
		}
	}()
	awsAuthSettings := Settings{
		AuthType:           AuthType(s.httpOptions.SigV4.AuthType),
		AccessKey:          s.httpOptions.SigV4.AccessKey,
		SecretKey:          s.httpOptions.SigV4.SecretKey,
		SessionToken:       s.httpOptions.SigV4.SessionToken,
		Region:             s.httpOptions.SigV4.Region,
		CredentialsProfile: s.httpOptions.SigV4.Profile,
		AssumeRoleARN:      s.httpOptions.SigV4.AssumeRoleARN,
		ExternalID:         s.httpOptions.SigV4.ExternalID,
		ProxyOptions:       s.httpOptions.ProxyOptions,
		HTTPClient:         &http.Client{},
	}
	ctx := req.Context()
	cfg, err := s.awsConfigProvider.GetConfig(ctx, awsAuthSettings)
	if err != nil {
		return nil, err
	}
	credentials, err := cfg.Credentials.Retrieve(ctx)
	if err != nil {
		return nil, err
	}
	err = s.SignHTTP(ctx, req, credentials)
	if err != nil {
		return nil, err
	}
	return s.next.RoundTrip(req)
}

func (s SignerRoundTripper) SignHTTP(ctx context.Context, req *http.Request, credentials aws.Credentials) error {
	// we start req with empty headers since that's what the signer is expecting,
	// but add them back at the end
	headers := req.Header
	req.Header = make(http.Header)
	defer func() {
		// replace the custom headers before returning
		for k, v := range headers {
			req.Header[k] = v
		}
	}()
	payloadHash, err := getRequestBodyHash(req)
	if err != nil {
		return err
	}
	return s.signer.SignHTTP(ctx, credentials, req, payloadHash, s.httpOptions.SigV4.Service, s.httpOptions.SigV4.Region, s.clock.Now().UTC())
}

func getRequestBodyHash(req *http.Request) (string, error) {
	if req.GetBody == nil {
		return EmptySha256Hash, nil
	}
	body, err := req.GetBody()
	if err != nil {
		return "", err
	}
	hash := sha256.New()
	_, err = io.Copy(hash, body)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil

}

type Clock interface {
	Now() time.Time
}
type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now() }
