package s3

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	internalcontext "github.com/aws/aws-sdk-go-v2/internal/context"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	acceptencodingcust "github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding"
	presignedurlcust "github.com/aws/aws-sdk-go-v2/service/internal/presigned-url"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

const (
	algorithmHeader  = "X-Amz-Algorithm"
	credentialHeader = "X-Amz-Credential"
	dateHeader       = "X-Amz-Date"
	tokenHeader      = "X-Amz-Security-Token"
	signatureHeader  = "X-Amz-Signature"

	algorithm        = "AWS4-HMAC-SHA256"
	aws4Request      = "aws4_request"
	bucketHeader     = "bucket"
	defaultExpiresIn = 15 * time.Minute
	shortDateLayout  = "20060102"
)

// PresignPostObject is a special kind of [presigned request] used to send a request using
// form data, likely from an HTML form on a browser.
// Unlike other presigned operations, the return values of this function are not meant to be used directly
// to make an HTTP request but rather to be used as inputs to a form. See [the docs] for more information
// on how to use these values
//
// [presigned request] https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
// [the docs] https://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectPOST.html
func (c *PresignClient) PresignPostObject(ctx context.Context, params *PutObjectInput, optFns ...func(*PresignPostOptions)) (*PresignedPostRequest, error) {
	if params == nil {
		params = &PutObjectInput{}
	}
	clientOptions := c.options.copy()
	options := PresignPostOptions{
		Expires:       clientOptions.Expires,
		PostPresigner: &postSignAdapter{},
	}
	for _, fn := range optFns {
		fn(&options)
	}
	clientOptFns := append(clientOptions.ClientOptions, withNopHTTPClientAPIOption)
	cvt := presignPostConverter(options)
	result, _, err := c.client.invokeOperation(ctx, "$type:L", params, clientOptFns,
		c.client.addOperationPutObjectMiddlewares,
		cvt.ConvertToPresignMiddleware,
		func(stack *middleware.Stack, options Options) error {
			return awshttp.RemoveContentTypeHeader(stack)
		},
	)
	if err != nil {
		return nil, err
	}

	out := result.(*PresignedPostRequest)
	return out, nil
}

// PresignedPostRequest represents a presigned request to be sent using HTTP verb POST and FormData
type PresignedPostRequest struct {
	// Represents the Base URL to make a request to
	URL string
	// Values is a key-value map of values to be sent as FormData
	// these values are not encoded
	Values map[string]string
}

// postSignAdapter adapter to implement the presignPost interface
type postSignAdapter struct{}

// PresignPost creates a special kind of [presigned request]
// to be used with HTTP verb POST.
// It differs from PUT request mostly on
// 1. It accepts a new set of parameters, `Conditions[]`, that are used to create a policy doc to limit where an object can be posted to
// 2. The return value needs to have more processing since it's meant to be sent via a form and not stand on its own
// 3. There's no body to be signed, since that will be attached when the actual request is made
// 4. The signature is made based on the policy document, not the whole request
// More information can be found at https://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectPOST.html
//
// [presigned request] https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
func (s *postSignAdapter) PresignPost(
	credentials aws.Credentials,
	bucket string, key string,
	region string, service string, signingTime time.Time, conditions []interface{}, expirationTime time.Time, optFns ...func(*v4.SignerOptions),
) (fields map[string]string, err error) {
	credentialScope := buildCredentialScope(signingTime, region, service)
	credentialStr := credentials.AccessKeyID + "/" + credentialScope

	policyDoc, err := createPolicyDocument(expirationTime, signingTime, bucket, key, credentialStr, &credentials.SessionToken, conditions)
	if err != nil {
		return nil, err
	}

	signature := buildSignature(policyDoc, credentials.SecretAccessKey, service, region, signingTime)

	fields = getPostSignRequiredFields(signingTime, credentialStr, credentials)
	fields[signatureHeader] = signature
	fields["key"] = key
	fields["policy"] = policyDoc

	return fields, nil
}

func getPostSignRequiredFields(t time.Time, credentialStr string, awsCredentials aws.Credentials) map[string]string {
	fields := map[string]string{
		algorithmHeader:  algorithm,
		dateHeader:       t.UTC().Format("20060102T150405Z"),
		credentialHeader: credentialStr,
	}

	sessionToken := awsCredentials.SessionToken
	if len(sessionToken) > 0 {
		fields[tokenHeader] = sessionToken
	}

	return fields
}

// PresignPost defines the interface to presign a POST request
type PresignPost interface {
	PresignPost(
		credentials aws.Credentials,
		bucket string, key string,
		region string, service string, signingTime time.Time, conditions []interface{}, expirationTime time.Time,
		optFns ...func(*v4.SignerOptions),
	) (fields map[string]string, err error)
}

// PresignPostOptions represent the options to be passed to a PresignPost sign request
type PresignPostOptions struct {

	// ClientOptions are list of functional options to mutate client options used by
	// the presign client.
	ClientOptions []func(*Options)

	// PostPresigner to use. One will be created if none is provided
	PostPresigner PresignPost

	// Expires sets the expiration duration for the generated presign url. This should
	// be the duration in seconds the presigned URL should be considered valid for. If
	// not set or set to zero, presign url would default to expire after 900 seconds.
	Expires time.Duration

	// Conditions a list of extra conditions to pass to the policy document
	// Available conditions can be found [here]
	//
	// [here]https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html#sigv4-PolicyConditions
	Conditions []interface{}
}

type presignPostConverter PresignPostOptions

// presignPostRequestMiddlewareOptions is the options for the presignPostRequestMiddleware middleware.
type presignPostRequestMiddlewareOptions struct {
	CredentialsProvider aws.CredentialsProvider
	Presigner           PresignPost
	LogSigning          bool
	ExpiresIn           time.Duration
	Conditions          []interface{}
}

type presignPostRequestMiddleware struct {
	credentialsProvider aws.CredentialsProvider
	presigner           PresignPost
	logSigning          bool
	expiresIn           time.Duration
	conditions          []interface{}
}

// newPresignPostRequestMiddleware returns a new presignPostRequestMiddleware
// initialized with the presigner.
func newPresignPostRequestMiddleware(options presignPostRequestMiddlewareOptions) *presignPostRequestMiddleware {
	return &presignPostRequestMiddleware{
		credentialsProvider: options.CredentialsProvider,
		presigner:           options.Presigner,
		logSigning:          options.LogSigning,
		expiresIn:           options.ExpiresIn,
		conditions:          options.Conditions,
	}
}

// ID provides the middleware ID.
func (*presignPostRequestMiddleware) ID() string { return "PresignPostRequestMiddleware" }

// HandleFinalize will take the provided input and create a presigned url for
// the http request using the SigV4 presign authentication scheme.
//
// Since the signed request is not a valid HTTP request
func (s *presignPostRequestMiddleware) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {

	input := getOperationInput(ctx)
	asS3Put, ok := input.(*PutObjectInput)
	if !ok {
		return out, metadata, fmt.Errorf("expected PutObjectInput")
	}
	bucketName, ok := asS3Put.bucket()
	if !ok {
		return out, metadata, fmt.Errorf("requested input bucketName not found on request")
	}
	uploadKey := asS3Put.Key
	if uploadKey == nil {
		return out, metadata, fmt.Errorf("PutObject input does not have a key input")
	}

	uri := getS3ResolvedURI(ctx)

	signingName := awsmiddleware.GetSigningName(ctx)
	signingRegion := awsmiddleware.GetSigningRegion(ctx)

	credentials, err := s.credentialsProvider.Retrieve(ctx)
	if err != nil {
		return out, metadata, &v4.SigningError{
			Err: fmt.Errorf("failed to retrieve credentials: %w", err),
		}
	}
	skew := internalcontext.GetAttemptSkewContext(ctx)
	signingTime := sdk.NowTime().Add(skew)
	expirationTime := signingTime.Add(s.expiresIn).UTC()

	fields, err := s.presigner.PresignPost(
		credentials,
		bucketName,
		*uploadKey,
		signingRegion,
		signingName,
		signingTime,
		s.conditions,
		expirationTime,
		func(o *v4.SignerOptions) {
			o.Logger = middleware.GetLogger(ctx)
			o.LogSigning = s.logSigning
		})
	if err != nil {
		return out, metadata, &v4.SigningError{
			Err: fmt.Errorf("failed to sign http request, %w", err),
		}
	}

	out.Result = &PresignedPostRequest{
		URL:    uri,
		Values: fields,
	}

	return out, metadata, nil
}

// Adapted from existing PresignConverter middleware
func (c presignPostConverter) ConvertToPresignMiddleware(stack *middleware.Stack, options Options) (err error) {
	stack.Build.Remove("UserAgent")
	stack.Finalize.Remove((*acceptencodingcust.DisableGzip)(nil).ID())
	stack.Finalize.Remove((*retry.Attempt)(nil).ID())
	stack.Finalize.Remove((*retry.MetricsHeader)(nil).ID())
	stack.Deserialize.Clear()

	if err := stack.Finalize.Insert(&presignContextPolyfillMiddleware{}, "Signing", middleware.Before); err != nil {
		return err
	}

	// if no expiration is set, set one
	expiresIn := c.Expires
	if expiresIn == 0 {
		expiresIn = defaultExpiresIn
	}

	pmw := newPresignPostRequestMiddleware(presignPostRequestMiddlewareOptions{
		CredentialsProvider: options.Credentials,
		Presigner:           c.PostPresigner,
		LogSigning:          options.ClientLogMode.IsSigning(),
		ExpiresIn:           expiresIn,
		Conditions:          c.Conditions,
	})
	if _, err := stack.Finalize.Swap("Signing", pmw); err != nil {
		return err
	}
	if err = smithyhttp.AddNoPayloadDefaultContentTypeRemover(stack); err != nil {
		return err
	}
	err = presignedurlcust.AddAsIsPresigningMiddleware(stack)
	if err != nil {
		return err
	}
	return nil
}

func createPolicyDocument(expirationTime time.Time, signingTime time.Time, bucket string, key string, credentialString string, securityToken *string, extraConditions []interface{}) (string, error) {
	initialConditions := []interface{}{
		map[string]string{
			algorithmHeader: algorithm,
		},
		map[string]string{
			bucketHeader: bucket,
		},
		map[string]string{
			credentialHeader: credentialString,
		},
		map[string]string{
			dateHeader: signingTime.UTC().Format("20060102T150405Z"),
		},
	}

	var conditions []interface{}
	for _, v := range initialConditions {
		conditions = append(conditions, v)
	}

	if securityToken != nil && *securityToken != "" {
		conditions = append(conditions, map[string]string{
			tokenHeader: *securityToken,
		})
	}

	// append user-defined conditions at the end
	conditions = append(conditions, extraConditions...)

	// The policy allows you to set a "key" value to specify what's the name of the
	// key to add. Customers can add one by specifying one in their conditions,
	// so we're checking if one has already been set.
	// If none is found, restrict this to just the key name passed on the request
	// This can be disabled by adding a condition that explicitly allows
	// everything
	if !isAlreadyCheckingForKey(conditions) {
		conditions = append(conditions, map[string]string{"key": key})
	}

	policyDoc := map[string]interface{}{
		"conditions": conditions,
		"expiration": expirationTime.Format(time.RFC3339),
	}

	jsonBytes, err := json.Marshal(policyDoc)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(jsonBytes), nil
}

func isAlreadyCheckingForKey(conditions []interface{}) bool {
	// Need to check for two conditions:
	// 1. A condition of the form ["starts-with", "$key", "mykey"]
	// 2. A condition of the form {"key": "mykey"}
	for _, c := range conditions {
		slice, ok := c.([]interface{})
		if ok && len(slice) > 1 {
			if slice[0] == "starts-with" && slice[1] == "$key" {
				return true
			}
		}
		m, ok := c.(map[string]interface{})
		if ok && len(m) > 0 {
			for k := range m {
				if k == "key" {
					return true
				}
			}
		}
		// Repeat this but for map[string]string due to type constrains
		ms, ok := c.(map[string]string)
		if ok && len(ms) > 0 {
			for k := range ms {
				if k == "key" {
					return true
				}
			}
		}
	}
	return false
}

// these methods have been copied from v4 implementation since they are not exported for public use
func hmacsha256(key []byte, data []byte) []byte {
	hash := hmac.New(sha256.New, key)
	hash.Write(data)
	return hash.Sum(nil)
}

func buildSignature(strToSign, secret, service, region string, t time.Time) string {
	key := deriveKey(secret, service, region, t)
	return hex.EncodeToString(hmacsha256(key, []byte(strToSign)))
}

func deriveKey(secret, service, region string, t time.Time) []byte {
	hmacDate := hmacsha256([]byte("AWS4"+secret), []byte(t.UTC().Format(shortDateLayout)))
	hmacRegion := hmacsha256(hmacDate, []byte(region))
	hmacService := hmacsha256(hmacRegion, []byte(service))
	return hmacsha256(hmacService, []byte(aws4Request))
}

func buildCredentialScope(signingTime time.Time, region, service string) string {
	return strings.Join([]string{
		signingTime.UTC().Format(shortDateLayout),
		region,
		service,
		aws4Request,
	}, "/")
}
