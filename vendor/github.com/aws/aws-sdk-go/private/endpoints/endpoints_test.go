package endpoints_test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/private/endpoints"
)

func TestGenericEndpoint(t *testing.T) {
	name := "service"
	region := "mock-region-1"

	ep, sr := endpoints.EndpointForRegion(name, region, false, false)
	assert.Equal(t, fmt.Sprintf("https://%s.%s.amazonaws.com", name, region), ep)
	assert.Empty(t, sr)
}

func TestGlobalEndpoints(t *testing.T) {
	region := "mock-region-1"
	svcs := []string{"cloudfront", "iam", "importexport", "route53", "sts", "waf"}

	for _, name := range svcs {
		ep, sr := endpoints.EndpointForRegion(name, region, false, false)
		assert.Equal(t, fmt.Sprintf("https://%s.amazonaws.com", name), ep)
		assert.Equal(t, "us-east-1", sr)
	}
}

func TestDualStackEndpoint(t *testing.T) {
	ep, sr := endpoints.EndpointForRegion("s3", "mock-region-1", false, true)
	assert.Equal(t, "https://s3.dualstack.mock-region-1.amazonaws.com", ep)
	assert.Equal(t, "", sr)

	ep, sr = endpoints.EndpointForRegion("mock-svc", "mock-region-1", false, true)
	assert.Equal(t, "", ep)
	assert.Equal(t, "", sr)

	ep, sr = endpoints.EndpointForRegion("s3", "mock-region-1", false, false)
	assert.Equal(t, "https://s3-mock-region-1.amazonaws.com", ep)
	assert.Equal(t, "", sr)
}

func TestServicesInCN(t *testing.T) {
	region := "cn-north-1"
	svcs := []string{"cloudfront", "iam", "importexport", "route53", "sts", "s3", "waf"}

	for _, name := range svcs {
		ep, sr := endpoints.EndpointForRegion(name, region, false, false)
		assert.Equal(t, fmt.Sprintf("https://%s.%s.amazonaws.com.cn", name, region), ep)
		assert.Empty(t, sr)
	}
}

func TestEC2MetadataEndpoints(t *testing.T) {
	regions := []string{"us-east-1", "us-gov-west-1", "cn-north-1", "mock-region-1"}

	for _, region := range regions {
		ep, sr := endpoints.EndpointForRegion("ec2metadata", region, false, false)
		assert.Equal(t, "http://169.254.169.254/latest", ep)
		assert.Equal(t, "", sr)
	}
}
