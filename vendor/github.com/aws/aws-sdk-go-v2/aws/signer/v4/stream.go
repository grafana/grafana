package v4

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"github.com/aws/aws-sdk-go-v2/aws"
	v4Internal "github.com/aws/aws-sdk-go-v2/aws/signer/internal/v4"
	"strings"
	"time"
)

// EventStreamSigner is an AWS EventStream protocol signer.
type EventStreamSigner interface {
	GetSignature(ctx context.Context, headers, payload []byte, signingTime time.Time, optFns ...func(*StreamSignerOptions)) ([]byte, error)
}

// StreamSignerOptions is the configuration options for StreamSigner.
type StreamSignerOptions struct{}

// StreamSigner implements Signature Version 4 (SigV4) signing of event stream encoded payloads.
type StreamSigner struct {
	options StreamSignerOptions

	credentials aws.Credentials
	service     string
	region      string

	prevSignature []byte

	signingKeyDeriver *v4Internal.SigningKeyDeriver
}

// NewStreamSigner returns a new AWS EventStream protocol signer.
func NewStreamSigner(credentials aws.Credentials, service, region string, seedSignature []byte, optFns ...func(*StreamSignerOptions)) *StreamSigner {
	o := StreamSignerOptions{}

	for _, fn := range optFns {
		fn(&o)
	}

	return &StreamSigner{
		options:           o,
		credentials:       credentials,
		service:           service,
		region:            region,
		signingKeyDeriver: v4Internal.NewSigningKeyDeriver(),
		prevSignature:     seedSignature,
	}
}

// GetSignature signs the provided header and payload bytes.
func (s *StreamSigner) GetSignature(ctx context.Context, headers, payload []byte, signingTime time.Time, optFns ...func(*StreamSignerOptions)) ([]byte, error) {
	options := s.options

	for _, fn := range optFns {
		fn(&options)
	}

	prevSignature := s.prevSignature

	st := v4Internal.NewSigningTime(signingTime.UTC())

	sigKey := s.signingKeyDeriver.DeriveKey(s.credentials, s.service, s.region, st)

	scope := v4Internal.BuildCredentialScope(st, s.region, s.service)

	stringToSign := s.buildEventStreamStringToSign(headers, payload, prevSignature, scope, &st)

	signature := v4Internal.HMACSHA256(sigKey, []byte(stringToSign))
	s.prevSignature = signature

	return signature, nil
}

func (s *StreamSigner) buildEventStreamStringToSign(headers, payload, previousSignature []byte, credentialScope string, signingTime *v4Internal.SigningTime) string {
	hash := sha256.New()
	return strings.Join([]string{
		"AWS4-HMAC-SHA256-PAYLOAD",
		signingTime.TimeFormat(),
		credentialScope,
		hex.EncodeToString(previousSignature),
		hex.EncodeToString(makeHash(hash, headers)),
		hex.EncodeToString(makeHash(hash, payload)),
	}, "\n")
}
