package v4

import (
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/awstesting"
)

func TestStripExcessHeaders(t *testing.T) {
	vals := []string{
		"123",
		"1 2 3",
		"  1 2 3",
		"1  2 3",
		"1  23",
		"1  2  3",
		"1  2  ",
		" 1  2  ",
	}

	expected := []string{
		"123",
		"1 2 3",
		"1 2 3",
		"1 2 3",
		"1 23",
		"1 2 3",
		"1 2",
		"1 2",
	}

	newVals := stripExcessSpaces(vals)
	for i := 0; i < len(newVals); i++ {
		assert.Equal(t, expected[i], newVals[i], "test: %d", i)
	}
}

func buildRequest(serviceName, region, body string) (*http.Request, io.ReadSeeker) {
	endpoint := "https://" + serviceName + "." + region + ".amazonaws.com"
	reader := strings.NewReader(body)
	req, _ := http.NewRequest("POST", endpoint, reader)
	req.URL.Opaque = "//example.org/bucket/key-._~,!@#$%^&*()"
	req.Header.Add("X-Amz-Target", "prefix.Operation")
	req.Header.Add("Content-Type", "application/x-amz-json-1.0")
	req.Header.Add("Content-Length", string(len(body)))
	req.Header.Add("X-Amz-Meta-Other-Header", "some-value=!@#$%^&* (+)")
	req.Header.Add("X-Amz-Meta-Other-Header_With_Underscore", "some-value=!@#$%^&* (+)")
	req.Header.Add("X-amz-Meta-Other-Header_With_Underscore", "some-value=!@#$%^&* (+)")
	return req, reader
}

func buildSigner() Signer {
	return Signer{
		Credentials: credentials.NewStaticCredentials("AKID", "SECRET", "SESSION"),
	}
}

func removeWS(text string) string {
	text = strings.Replace(text, " ", "", -1)
	text = strings.Replace(text, "\n", "", -1)
	text = strings.Replace(text, "\t", "", -1)
	return text
}

func assertEqual(t *testing.T, expected, given string) {
	if removeWS(expected) != removeWS(given) {
		t.Errorf("\nExpected: %s\nGiven:    %s", expected, given)
	}
}

func TestPresignRequest(t *testing.T) {
	req, body := buildRequest("dynamodb", "us-east-1", "{}")

	signer := buildSigner()
	signer.Presign(req, body, "dynamodb", "us-east-1", 300*time.Second, time.Unix(0, 0))

	expectedDate := "19700101T000000Z"
	expectedHeaders := "content-length;content-type;host;x-amz-meta-other-header;x-amz-meta-other-header_with_underscore"
	expectedSig := "ea7856749041f727690c580569738282e99c79355fe0d8f125d3b5535d2ece83"
	expectedCred := "AKID/19700101/us-east-1/dynamodb/aws4_request"
	expectedTarget := "prefix.Operation"

	q := req.URL.Query()
	assert.Equal(t, expectedSig, q.Get("X-Amz-Signature"))
	assert.Equal(t, expectedCred, q.Get("X-Amz-Credential"))
	assert.Equal(t, expectedHeaders, q.Get("X-Amz-SignedHeaders"))
	assert.Equal(t, expectedDate, q.Get("X-Amz-Date"))
	assert.Empty(t, q.Get("X-Amz-Meta-Other-Header"))
	assert.Equal(t, expectedTarget, q.Get("X-Amz-Target"))
}

func TestSignRequest(t *testing.T) {
	req, body := buildRequest("dynamodb", "us-east-1", "{}")
	signer := buildSigner()
	signer.Sign(req, body, "dynamodb", "us-east-1", time.Unix(0, 0))

	expectedDate := "19700101T000000Z"
	expectedSig := "AWS4-HMAC-SHA256 Credential=AKID/19700101/us-east-1/dynamodb/aws4_request, SignedHeaders=content-length;content-type;host;x-amz-date;x-amz-meta-other-header;x-amz-meta-other-header_with_underscore;x-amz-security-token;x-amz-target, Signature=ea766cabd2ec977d955a3c2bae1ae54f4515d70752f2207618396f20aa85bd21"

	q := req.Header
	assert.Equal(t, expectedSig, q.Get("Authorization"))
	assert.Equal(t, expectedDate, q.Get("X-Amz-Date"))
}

func TestSignBodyS3(t *testing.T) {
	req, body := buildRequest("s3", "us-east-1", "hello")
	signer := buildSigner()
	signer.Sign(req, body, "s3", "us-east-1", time.Now())
	hash := req.Header.Get("X-Amz-Content-Sha256")
	assert.Equal(t, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", hash)
}

func TestSignBodyGlacier(t *testing.T) {
	req, body := buildRequest("glacier", "us-east-1", "hello")
	signer := buildSigner()
	signer.Sign(req, body, "glacier", "us-east-1", time.Now())
	hash := req.Header.Get("X-Amz-Content-Sha256")
	assert.Equal(t, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", hash)
}

func TestPresignEmptyBodyS3(t *testing.T) {
	req, body := buildRequest("s3", "us-east-1", "hello")
	signer := buildSigner()
	signer.Presign(req, body, "s3", "us-east-1", 5*time.Minute, time.Now())
	hash := req.Header.Get("X-Amz-Content-Sha256")
	assert.Equal(t, "UNSIGNED-PAYLOAD", hash)
}

func TestSignPrecomputedBodyChecksum(t *testing.T) {
	req, body := buildRequest("dynamodb", "us-east-1", "hello")
	req.Header.Set("X-Amz-Content-Sha256", "PRECOMPUTED")
	signer := buildSigner()
	signer.Sign(req, body, "dynamodb", "us-east-1", time.Now())
	hash := req.Header.Get("X-Amz-Content-Sha256")
	assert.Equal(t, "PRECOMPUTED", hash)
}

func TestAnonymousCredentials(t *testing.T) {
	svc := awstesting.NewClient(&aws.Config{Credentials: credentials.AnonymousCredentials})
	r := svc.NewRequest(
		&request.Operation{
			Name:       "BatchGetItem",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		},
		nil,
		nil,
	)
	SignSDKRequest(r)

	urlQ := r.HTTPRequest.URL.Query()
	assert.Empty(t, urlQ.Get("X-Amz-Signature"))
	assert.Empty(t, urlQ.Get("X-Amz-Credential"))
	assert.Empty(t, urlQ.Get("X-Amz-SignedHeaders"))
	assert.Empty(t, urlQ.Get("X-Amz-Date"))

	hQ := r.HTTPRequest.Header
	assert.Empty(t, hQ.Get("Authorization"))
	assert.Empty(t, hQ.Get("X-Amz-Date"))
}

func TestIgnoreResignRequestWithValidCreds(t *testing.T) {
	svc := awstesting.NewClient(&aws.Config{
		Credentials: credentials.NewStaticCredentials("AKID", "SECRET", "SESSION"),
		Region:      aws.String("us-west-2"),
	})
	r := svc.NewRequest(
		&request.Operation{
			Name:       "BatchGetItem",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		},
		nil,
		nil,
	)

	SignSDKRequest(r)
	sig := r.HTTPRequest.Header.Get("Authorization")

	SignSDKRequest(r)
	assert.Equal(t, sig, r.HTTPRequest.Header.Get("Authorization"))
}

func TestIgnorePreResignRequestWithValidCreds(t *testing.T) {
	svc := awstesting.NewClient(&aws.Config{
		Credentials: credentials.NewStaticCredentials("AKID", "SECRET", "SESSION"),
		Region:      aws.String("us-west-2"),
	})
	r := svc.NewRequest(
		&request.Operation{
			Name:       "BatchGetItem",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		},
		nil,
		nil,
	)
	r.ExpireTime = time.Minute * 10

	SignSDKRequest(r)
	sig := r.HTTPRequest.Header.Get("X-Amz-Signature")

	SignSDKRequest(r)
	assert.Equal(t, sig, r.HTTPRequest.Header.Get("X-Amz-Signature"))
}

func TestResignRequestExpiredCreds(t *testing.T) {
	creds := credentials.NewStaticCredentials("AKID", "SECRET", "SESSION")
	svc := awstesting.NewClient(&aws.Config{Credentials: creds})
	r := svc.NewRequest(
		&request.Operation{
			Name:       "BatchGetItem",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		},
		nil,
		nil,
	)
	SignSDKRequest(r)
	querySig := r.HTTPRequest.Header.Get("Authorization")
	var origSignedHeaders string
	for _, p := range strings.Split(querySig, ", ") {
		if strings.HasPrefix(p, "SignedHeaders=") {
			origSignedHeaders = p[len("SignedHeaders="):]
			break
		}
	}
	assert.NotEmpty(t, origSignedHeaders)
	assert.NotContains(t, origSignedHeaders, "authorization")
	origSignedAt := r.LastSignedAt

	creds.Expire()

	signSDKRequestWithCurrTime(r, func() time.Time {
		// Simulate one second has passed so that signature's date changes
		// when it is resigned.
		return time.Now().Add(1 * time.Second)
	})
	updatedQuerySig := r.HTTPRequest.Header.Get("Authorization")
	assert.NotEqual(t, querySig, updatedQuerySig)

	var updatedSignedHeaders string
	for _, p := range strings.Split(updatedQuerySig, ", ") {
		if strings.HasPrefix(p, "SignedHeaders=") {
			updatedSignedHeaders = p[len("SignedHeaders="):]
			break
		}
	}
	assert.NotEmpty(t, updatedSignedHeaders)
	assert.NotContains(t, updatedQuerySig, "authorization")
	assert.NotEqual(t, origSignedAt, r.LastSignedAt)
}

func TestPreResignRequestExpiredCreds(t *testing.T) {
	provider := &credentials.StaticProvider{Value: credentials.Value{
		AccessKeyID:     "AKID",
		SecretAccessKey: "SECRET",
		SessionToken:    "SESSION",
	}}
	creds := credentials.NewCredentials(provider)
	svc := awstesting.NewClient(&aws.Config{Credentials: creds})
	r := svc.NewRequest(
		&request.Operation{
			Name:       "BatchGetItem",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		},
		nil,
		nil,
	)
	r.ExpireTime = time.Minute * 10

	SignSDKRequest(r)
	querySig := r.HTTPRequest.URL.Query().Get("X-Amz-Signature")
	signedHeaders := r.HTTPRequest.URL.Query().Get("X-Amz-SignedHeaders")
	assert.NotEmpty(t, signedHeaders)
	origSignedAt := r.LastSignedAt

	creds.Expire()

	signSDKRequestWithCurrTime(r, func() time.Time {
		// Simulate the request occurred 15 minutes in the past
		return time.Now().Add(-48 * time.Hour)
	})
	assert.NotEqual(t, querySig, r.HTTPRequest.URL.Query().Get("X-Amz-Signature"))
	resignedHeaders := r.HTTPRequest.URL.Query().Get("X-Amz-SignedHeaders")
	assert.Equal(t, signedHeaders, resignedHeaders)
	assert.NotContains(t, signedHeaders, "x-amz-signedHeaders")
	assert.NotEqual(t, origSignedAt, r.LastSignedAt)
}

func TestResignRequestExpiredRequest(t *testing.T) {
	creds := credentials.NewStaticCredentials("AKID", "SECRET", "SESSION")
	svc := awstesting.NewClient(&aws.Config{Credentials: creds})
	r := svc.NewRequest(
		&request.Operation{
			Name:       "BatchGetItem",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		},
		nil,
		nil,
	)

	SignSDKRequest(r)
	querySig := r.HTTPRequest.Header.Get("Authorization")
	origSignedAt := r.LastSignedAt

	signSDKRequestWithCurrTime(r, func() time.Time {
		// Simulate the request occurred 15 minutes in the past
		return time.Now().Add(15 * time.Minute)
	})
	assert.NotEqual(t, querySig, r.HTTPRequest.Header.Get("Authorization"))
	assert.NotEqual(t, origSignedAt, r.LastSignedAt)
}

func BenchmarkPresignRequest(b *testing.B) {
	signer := buildSigner()
	req, body := buildRequest("dynamodb", "us-east-1", "{}")
	for i := 0; i < b.N; i++ {
		signer.Presign(req, body, "dynamodb", "us-east-1", 300*time.Second, time.Now())
	}
}

func BenchmarkSignRequest(b *testing.B) {
	signer := buildSigner()
	req, body := buildRequest("dynamodb", "us-east-1", "{}")
	for i := 0; i < b.N; i++ {
		signer.Sign(req, body, "dynamodb", "us-east-1", time.Now())
	}
}

func BenchmarkStripExcessSpaces(b *testing.B) {
	vals := []string{
		`AWS4-HMAC-SHA256 Credential=AKIDFAKEIDFAKEID/20160628/us-west-2/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=1234567890abcdef1234567890abcdef1234567890abcdef`,
		`123   321   123   321`,
		`   123   321   123   321   `,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		stripExcessSpaces(vals)
	}
}
