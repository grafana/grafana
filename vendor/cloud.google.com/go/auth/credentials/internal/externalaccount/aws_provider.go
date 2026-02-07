// Copyright 2023 Google LLC
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

package externalaccount

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path"
	"sort"
	"strings"
	"time"

	"cloud.google.com/go/auth/internal"
	"github.com/googleapis/gax-go/v2/internallog"
)

var (
	// getenv aliases os.Getenv for testing
	getenv = os.Getenv
)

const (
	// AWS Signature Version 4 signing algorithm identifier.
	awsAlgorithm = "AWS4-HMAC-SHA256"

	// The termination string for the AWS credential scope value as defined in
	// https://docs.aws.amazon.com/general/latest/gr/sigv4-create-string-to-sign.html
	awsRequestType = "aws4_request"

	// The AWS authorization header name for the security session token if available.
	awsSecurityTokenHeader = "x-amz-security-token"

	// The name of the header containing the session token for metadata endpoint calls
	awsIMDSv2SessionTokenHeader = "X-aws-ec2-metadata-token"

	awsIMDSv2SessionTTLHeader = "X-aws-ec2-metadata-token-ttl-seconds"

	awsIMDSv2SessionTTL = "300"

	// The AWS authorization header name for the auto-generated date.
	awsDateHeader = "x-amz-date"

	defaultRegionalCredentialVerificationURL = "https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15"

	// Supported AWS configuration environment variables.
	awsAccessKeyIDEnvVar     = "AWS_ACCESS_KEY_ID"
	awsDefaultRegionEnvVar   = "AWS_DEFAULT_REGION"
	awsRegionEnvVar          = "AWS_REGION"
	awsSecretAccessKeyEnvVar = "AWS_SECRET_ACCESS_KEY"
	awsSessionTokenEnvVar    = "AWS_SESSION_TOKEN"

	awsTimeFormatLong  = "20060102T150405Z"
	awsTimeFormatShort = "20060102"
	awsProviderType    = "aws"
)

type awsSubjectProvider struct {
	EnvironmentID               string
	RegionURL                   string
	RegionalCredVerificationURL string
	CredVerificationURL         string
	IMDSv2SessionTokenURL       string
	TargetResource              string
	requestSigner               *awsRequestSigner
	region                      string
	securityCredentialsProvider AwsSecurityCredentialsProvider
	reqOpts                     *RequestOptions

	Client *http.Client
	logger *slog.Logger
}

func (sp *awsSubjectProvider) subjectToken(ctx context.Context) (string, error) {
	// Set Defaults
	if sp.RegionalCredVerificationURL == "" {
		sp.RegionalCredVerificationURL = defaultRegionalCredentialVerificationURL
	}
	headers := make(map[string]string)
	if sp.shouldUseMetadataServer() {
		awsSessionToken, err := sp.getAWSSessionToken(ctx)
		if err != nil {
			return "", err
		}

		if awsSessionToken != "" {
			headers[awsIMDSv2SessionTokenHeader] = awsSessionToken
		}
	}

	awsSecurityCredentials, err := sp.getSecurityCredentials(ctx, headers)
	if err != nil {
		return "", err
	}
	if sp.region, err = sp.getRegion(ctx, headers); err != nil {
		return "", err
	}
	sp.requestSigner = &awsRequestSigner{
		RegionName:             sp.region,
		AwsSecurityCredentials: awsSecurityCredentials,
	}

	// Generate the signed request to AWS STS GetCallerIdentity API.
	// Use the required regional endpoint. Otherwise, the request will fail.
	req, err := http.NewRequestWithContext(ctx, "POST", strings.Replace(sp.RegionalCredVerificationURL, "{region}", sp.region, 1), nil)
	if err != nil {
		return "", err
	}
	// The full, canonical resource name of the workload identity pool
	// provider, with or without the HTTPS prefix.
	// Including this header as part of the signature is recommended to
	// ensure data integrity.
	if sp.TargetResource != "" {
		req.Header.Set("x-goog-cloud-target-resource", sp.TargetResource)
	}
	sp.requestSigner.signRequest(req)

	/*
	   The GCP STS endpoint expects the headers to be formatted as:
	   # [
	   #   {key: 'x-amz-date', value: '...'},
	   #   {key: 'Authorization', value: '...'},
	   #   ...
	   # ]
	   # And then serialized as:
	   # quote(json.dumps({
	   #   url: '...',
	   #   method: 'POST',
	   #   headers: [{key: 'x-amz-date', value: '...'}, ...]
	   # }))
	*/

	awsSignedReq := awsRequest{
		URL:    req.URL.String(),
		Method: "POST",
	}
	for headerKey, headerList := range req.Header {
		for _, headerValue := range headerList {
			awsSignedReq.Headers = append(awsSignedReq.Headers, awsRequestHeader{
				Key:   headerKey,
				Value: headerValue,
			})
		}
	}
	sort.Slice(awsSignedReq.Headers, func(i, j int) bool {
		headerCompare := strings.Compare(awsSignedReq.Headers[i].Key, awsSignedReq.Headers[j].Key)
		if headerCompare == 0 {
			return strings.Compare(awsSignedReq.Headers[i].Value, awsSignedReq.Headers[j].Value) < 0
		}
		return headerCompare < 0
	})

	result, err := json.Marshal(awsSignedReq)
	if err != nil {
		return "", err
	}
	return url.QueryEscape(string(result)), nil
}

func (sp *awsSubjectProvider) providerType() string {
	if sp.securityCredentialsProvider != nil {
		return programmaticProviderType
	}
	return awsProviderType
}

func (sp *awsSubjectProvider) getAWSSessionToken(ctx context.Context) (string, error) {
	if sp.IMDSv2SessionTokenURL == "" {
		return "", nil
	}
	req, err := http.NewRequestWithContext(ctx, "PUT", sp.IMDSv2SessionTokenURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set(awsIMDSv2SessionTTLHeader, awsIMDSv2SessionTTL)

	sp.logger.DebugContext(ctx, "aws session token request", "request", internallog.HTTPRequest(req, nil))
	resp, body, err := internal.DoRequest(sp.Client, req)
	if err != nil {
		return "", err
	}
	sp.logger.DebugContext(ctx, "aws session token response", "response", internallog.HTTPResponse(resp, body))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("credentials: unable to retrieve AWS session token: %s", body)
	}
	return string(body), nil
}

func (sp *awsSubjectProvider) getRegion(ctx context.Context, headers map[string]string) (string, error) {
	if sp.securityCredentialsProvider != nil {
		return sp.securityCredentialsProvider.AwsRegion(ctx, sp.reqOpts)
	}
	if canRetrieveRegionFromEnvironment() {
		if envAwsRegion := getenv(awsRegionEnvVar); envAwsRegion != "" {
			return envAwsRegion, nil
		}
		return getenv(awsDefaultRegionEnvVar), nil
	}

	if sp.RegionURL == "" {
		return "", errors.New("credentials: unable to determine AWS region")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", sp.RegionURL, nil)
	if err != nil {
		return "", err
	}

	for name, value := range headers {
		req.Header.Add(name, value)
	}
	sp.logger.DebugContext(ctx, "aws region request", "request", internallog.HTTPRequest(req, nil))
	resp, body, err := internal.DoRequest(sp.Client, req)
	if err != nil {
		return "", err
	}
	sp.logger.DebugContext(ctx, "aws region response", "response", internallog.HTTPResponse(resp, body))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("credentials: unable to retrieve AWS region - %s", body)
	}

	// This endpoint will return the region in format: us-east-2b.
	// Only the us-east-2 part should be used.
	bodyLen := len(body)
	if bodyLen == 0 {
		return "", nil
	}
	return string(body[:bodyLen-1]), nil
}

func (sp *awsSubjectProvider) getSecurityCredentials(ctx context.Context, headers map[string]string) (result *AwsSecurityCredentials, err error) {
	if sp.securityCredentialsProvider != nil {
		return sp.securityCredentialsProvider.AwsSecurityCredentials(ctx, sp.reqOpts)
	}
	if canRetrieveSecurityCredentialFromEnvironment() {
		return &AwsSecurityCredentials{
			AccessKeyID:     getenv(awsAccessKeyIDEnvVar),
			SecretAccessKey: getenv(awsSecretAccessKeyEnvVar),
			SessionToken:    getenv(awsSessionTokenEnvVar),
		}, nil
	}

	roleName, err := sp.getMetadataRoleName(ctx, headers)
	if err != nil {
		return
	}
	credentials, err := sp.getMetadataSecurityCredentials(ctx, roleName, headers)
	if err != nil {
		return
	}

	if credentials.AccessKeyID == "" {
		return result, errors.New("credentials: missing AccessKeyId credential")
	}
	if credentials.SecretAccessKey == "" {
		return result, errors.New("credentials: missing SecretAccessKey credential")
	}

	return credentials, nil
}

func (sp *awsSubjectProvider) getMetadataSecurityCredentials(ctx context.Context, roleName string, headers map[string]string) (*AwsSecurityCredentials, error) {
	var result *AwsSecurityCredentials

	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/%s", sp.CredVerificationURL, roleName), nil)
	if err != nil {
		return result, err
	}
	for name, value := range headers {
		req.Header.Add(name, value)
	}
	sp.logger.DebugContext(ctx, "aws security credential request", "request", internallog.HTTPRequest(req, nil))
	resp, body, err := internal.DoRequest(sp.Client, req)
	if err != nil {
		return result, err
	}
	sp.logger.DebugContext(ctx, "aws security credential response", "response", internallog.HTTPResponse(resp, body))
	if resp.StatusCode != http.StatusOK {
		return result, fmt.Errorf("credentials: unable to retrieve AWS security credentials - %s", body)
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (sp *awsSubjectProvider) getMetadataRoleName(ctx context.Context, headers map[string]string) (string, error) {
	if sp.CredVerificationURL == "" {
		return "", errors.New("credentials: unable to determine the AWS metadata server security credentials endpoint")
	}
	req, err := http.NewRequestWithContext(ctx, "GET", sp.CredVerificationURL, nil)
	if err != nil {
		return "", err
	}
	for name, value := range headers {
		req.Header.Add(name, value)
	}

	sp.logger.DebugContext(ctx, "aws metadata role request", "request", internallog.HTTPRequest(req, nil))
	resp, body, err := internal.DoRequest(sp.Client, req)
	if err != nil {
		return "", err
	}
	sp.logger.DebugContext(ctx, "aws metadata role response", "response", internallog.HTTPResponse(resp, body))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("credentials: unable to retrieve AWS role name - %s", body)
	}
	return string(body), nil
}

// awsRequestSigner is a utility class to sign http requests using a AWS V4 signature.
type awsRequestSigner struct {
	RegionName             string
	AwsSecurityCredentials *AwsSecurityCredentials
}

// signRequest adds the appropriate headers to an http.Request
// or returns an error if something prevented this.
func (rs *awsRequestSigner) signRequest(req *http.Request) error {
	// req is assumed non-nil
	signedRequest := cloneRequest(req)
	timestamp := Now()
	signedRequest.Header.Set("host", requestHost(req))
	if rs.AwsSecurityCredentials.SessionToken != "" {
		signedRequest.Header.Set(awsSecurityTokenHeader, rs.AwsSecurityCredentials.SessionToken)
	}
	if signedRequest.Header.Get("date") == "" {
		signedRequest.Header.Set(awsDateHeader, timestamp.Format(awsTimeFormatLong))
	}
	authorizationCode, err := rs.generateAuthentication(signedRequest, timestamp)
	if err != nil {
		return err
	}
	signedRequest.Header.Set("Authorization", authorizationCode)
	req.Header = signedRequest.Header
	return nil
}

func (rs *awsRequestSigner) generateAuthentication(req *http.Request, timestamp time.Time) (string, error) {
	canonicalHeaderColumns, canonicalHeaderData := canonicalHeaders(req)
	dateStamp := timestamp.Format(awsTimeFormatShort)
	serviceName := ""

	if splitHost := strings.Split(requestHost(req), "."); len(splitHost) > 0 {
		serviceName = splitHost[0]
	}
	credentialScope := strings.Join([]string{dateStamp, rs.RegionName, serviceName, awsRequestType}, "/")
	requestString, err := canonicalRequest(req, canonicalHeaderColumns, canonicalHeaderData)
	if err != nil {
		return "", err
	}
	requestHash, err := getSha256([]byte(requestString))
	if err != nil {
		return "", err
	}

	stringToSign := strings.Join([]string{awsAlgorithm, timestamp.Format(awsTimeFormatLong), credentialScope, requestHash}, "\n")
	signingKey := []byte("AWS4" + rs.AwsSecurityCredentials.SecretAccessKey)
	for _, signingInput := range []string{
		dateStamp, rs.RegionName, serviceName, awsRequestType, stringToSign,
	} {
		signingKey, err = getHmacSha256(signingKey, []byte(signingInput))
		if err != nil {
			return "", err
		}
	}

	return fmt.Sprintf("%s Credential=%s/%s, SignedHeaders=%s, Signature=%s", awsAlgorithm, rs.AwsSecurityCredentials.AccessKeyID, credentialScope, canonicalHeaderColumns, hex.EncodeToString(signingKey)), nil
}

func getSha256(input []byte) (string, error) {
	hash := sha256.New()
	if _, err := hash.Write(input); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func getHmacSha256(key, input []byte) ([]byte, error) {
	hash := hmac.New(sha256.New, key)
	if _, err := hash.Write(input); err != nil {
		return nil, err
	}
	return hash.Sum(nil), nil
}

func cloneRequest(r *http.Request) *http.Request {
	r2 := new(http.Request)
	*r2 = *r
	if r.Header != nil {
		r2.Header = make(http.Header, len(r.Header))

		// Find total number of values.
		headerCount := 0
		for _, headerValues := range r.Header {
			headerCount += len(headerValues)
		}
		copiedHeaders := make([]string, headerCount) // shared backing array for headers' values

		for headerKey, headerValues := range r.Header {
			headerCount = copy(copiedHeaders, headerValues)
			r2.Header[headerKey] = copiedHeaders[:headerCount:headerCount]
			copiedHeaders = copiedHeaders[headerCount:]
		}
	}
	return r2
}

func canonicalPath(req *http.Request) string {
	result := req.URL.EscapedPath()
	if result == "" {
		return "/"
	}
	return path.Clean(result)
}

func canonicalQuery(req *http.Request) string {
	queryValues := req.URL.Query()
	for queryKey := range queryValues {
		sort.Strings(queryValues[queryKey])
	}
	return queryValues.Encode()
}

func canonicalHeaders(req *http.Request) (string, string) {
	// Header keys need to be sorted alphabetically.
	var headers []string
	lowerCaseHeaders := make(http.Header)
	for k, v := range req.Header {
		k := strings.ToLower(k)
		if _, ok := lowerCaseHeaders[k]; ok {
			// include additional values
			lowerCaseHeaders[k] = append(lowerCaseHeaders[k], v...)
		} else {
			headers = append(headers, k)
			lowerCaseHeaders[k] = v
		}
	}
	sort.Strings(headers)

	var fullHeaders bytes.Buffer
	for _, header := range headers {
		headerValue := strings.Join(lowerCaseHeaders[header], ",")
		fullHeaders.WriteString(header)
		fullHeaders.WriteRune(':')
		fullHeaders.WriteString(headerValue)
		fullHeaders.WriteRune('\n')
	}

	return strings.Join(headers, ";"), fullHeaders.String()
}

func requestDataHash(req *http.Request) (string, error) {
	var requestData []byte
	if req.Body != nil {
		requestBody, err := req.GetBody()
		if err != nil {
			return "", err
		}
		defer requestBody.Close()

		requestData, err = internal.ReadAll(requestBody)
		if err != nil {
			return "", err
		}
	}

	return getSha256(requestData)
}

func requestHost(req *http.Request) string {
	if req.Host != "" {
		return req.Host
	}
	return req.URL.Host
}

func canonicalRequest(req *http.Request, canonicalHeaderColumns, canonicalHeaderData string) (string, error) {
	dataHash, err := requestDataHash(req)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s", req.Method, canonicalPath(req), canonicalQuery(req), canonicalHeaderData, canonicalHeaderColumns, dataHash), nil
}

type awsRequestHeader struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type awsRequest struct {
	URL     string             `json:"url"`
	Method  string             `json:"method"`
	Headers []awsRequestHeader `json:"headers"`
}

// The AWS region can be provided through AWS_REGION or AWS_DEFAULT_REGION. Only one is
// required.
func canRetrieveRegionFromEnvironment() bool {
	return getenv(awsRegionEnvVar) != "" || getenv(awsDefaultRegionEnvVar) != ""
}

// Check if both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are available.
func canRetrieveSecurityCredentialFromEnvironment() bool {
	return getenv(awsAccessKeyIDEnvVar) != "" && getenv(awsSecretAccessKeyEnvVar) != ""
}

func (sp *awsSubjectProvider) shouldUseMetadataServer() bool {
	return sp.securityCredentialsProvider == nil && (!canRetrieveRegionFromEnvironment() || !canRetrieveSecurityCredentialFromEnvironment())
}
