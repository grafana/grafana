package ec2metadata_test

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"path"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/awstesting/unit"
)

const instanceIdentityDocument = `{
  "devpayProductCodes" : null,
  "availabilityZone" : "us-east-1d",
  "privateIp" : "10.158.112.84",
  "version" : "2010-08-31",
  "region" : "us-east-1",
  "instanceId" : "i-1234567890abcdef0",
  "billingProducts" : null,
  "instanceType" : "t1.micro",
  "accountId" : "123456789012",
  "pendingTime" : "2015-11-19T16:32:11Z",
  "imageId" : "ami-5fb8c835",
  "kernelId" : "aki-919dcaf8",
  "ramdiskId" : null,
  "architecture" : "x86_64"
}`

const validIamInfo = `{
  "Code" : "Success",
  "LastUpdated" : "2016-03-17T12:27:32Z",
  "InstanceProfileArn" : "arn:aws:iam::123456789012:instance-profile/my-instance-profile",
  "InstanceProfileId" : "AIPAABCDEFGHIJKLMN123"
}`

const unsuccessfulIamInfo = `{
  "Code" : "Failed",
  "LastUpdated" : "2016-03-17T12:27:32Z",
  "InstanceProfileArn" : "arn:aws:iam::123456789012:instance-profile/my-instance-profile",
  "InstanceProfileId" : "AIPAABCDEFGHIJKLMN123"
}`

func initTestServer(path string, resp string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.RequestURI != path {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		w.Write([]byte(resp))
	}))
}

func TestEndpoint(t *testing.T) {
	c := ec2metadata.New(unit.Session)
	op := &request.Operation{
		Name:       "GetMetadata",
		HTTPMethod: "GET",
		HTTPPath:   path.Join("/", "meta-data", "testpath"),
	}

	req := c.NewRequest(op, nil, nil)
	assert.Equal(t, "http://169.254.169.254/latest", req.ClientInfo.Endpoint)
	assert.Equal(t, "http://169.254.169.254/latest/meta-data/testpath", req.HTTPRequest.URL.String())
}

func TestGetMetadata(t *testing.T) {
	server := initTestServer(
		"/latest/meta-data/some/path",
		"success", // real response includes suffix
	)
	defer server.Close()
	c := ec2metadata.New(unit.Session, &aws.Config{Endpoint: aws.String(server.URL + "/latest")})

	resp, err := c.GetMetadata("some/path")

	assert.NoError(t, err)
	assert.Equal(t, "success", resp)
}

func TestGetRegion(t *testing.T) {
	server := initTestServer(
		"/latest/meta-data/placement/availability-zone",
		"us-west-2a", // real response includes suffix
	)
	defer server.Close()
	c := ec2metadata.New(unit.Session, &aws.Config{Endpoint: aws.String(server.URL + "/latest")})

	region, err := c.Region()

	assert.NoError(t, err)
	assert.Equal(t, "us-west-2", region)
}

func TestMetadataAvailable(t *testing.T) {
	server := initTestServer(
		"/latest/meta-data/instance-id",
		"instance-id",
	)
	defer server.Close()
	c := ec2metadata.New(unit.Session, &aws.Config{Endpoint: aws.String(server.URL + "/latest")})

	available := c.Available()

	assert.True(t, available)
}

func TestMetadataIAMInfo_success(t *testing.T) {
	server := initTestServer(
		"/latest/meta-data/iam/info",
		validIamInfo,
	)
	defer server.Close()
	c := ec2metadata.New(unit.Session, &aws.Config{Endpoint: aws.String(server.URL + "/latest")})

	iamInfo, err := c.IAMInfo()
	assert.NoError(t, err)
	assert.Equal(t, "Success", iamInfo.Code)
	assert.Equal(t, "arn:aws:iam::123456789012:instance-profile/my-instance-profile", iamInfo.InstanceProfileArn)
	assert.Equal(t, "AIPAABCDEFGHIJKLMN123", iamInfo.InstanceProfileID)
}

func TestMetadataIAMInfo_failure(t *testing.T) {
	server := initTestServer(
		"/latest/meta-data/iam/info",
		unsuccessfulIamInfo,
	)
	defer server.Close()
	c := ec2metadata.New(unit.Session, &aws.Config{Endpoint: aws.String(server.URL + "/latest")})

	iamInfo, err := c.IAMInfo()
	assert.NotNil(t, err)
	assert.Equal(t, "", iamInfo.Code)
	assert.Equal(t, "", iamInfo.InstanceProfileArn)
	assert.Equal(t, "", iamInfo.InstanceProfileID)
}

func TestMetadataNotAvailable(t *testing.T) {
	c := ec2metadata.New(unit.Session)
	c.Handlers.Send.Clear()
	c.Handlers.Send.PushBack(func(r *request.Request) {
		r.HTTPResponse = &http.Response{
			StatusCode: int(0),
			Status:     http.StatusText(int(0)),
			Body:       ioutil.NopCloser(bytes.NewReader([]byte{})),
		}
		r.Error = awserr.New("RequestError", "send request failed", nil)
		r.Retryable = aws.Bool(true) // network errors are retryable
	})

	available := c.Available()

	assert.False(t, available)
}

func TestMetadataErrorResponse(t *testing.T) {
	c := ec2metadata.New(unit.Session)
	c.Handlers.Send.Clear()
	c.Handlers.Send.PushBack(func(r *request.Request) {
		r.HTTPResponse = &http.Response{
			StatusCode: http.StatusBadRequest,
			Status:     http.StatusText(http.StatusBadRequest),
			Body:       ioutil.NopCloser(strings.NewReader("error message text")),
		}
		r.Retryable = aws.Bool(false) // network errors are retryable
	})

	data, err := c.GetMetadata("uri/path")
	assert.Empty(t, data)
	assert.Contains(t, err.Error(), "error message text")
}

func TestEC2RoleProviderInstanceIdentity(t *testing.T) {
	server := initTestServer(
		"/latest/dynamic/instance-identity/document",
		instanceIdentityDocument,
	)
	defer server.Close()
	c := ec2metadata.New(unit.Session, &aws.Config{Endpoint: aws.String(server.URL + "/latest")})

	doc, err := c.GetInstanceIdentityDocument()
	assert.Nil(t, err, "Expect no error, %v", err)
	assert.Equal(t, doc.AccountID, "123456789012")
	assert.Equal(t, doc.AvailabilityZone, "us-east-1d")
	assert.Equal(t, doc.Region, "us-east-1")
}
