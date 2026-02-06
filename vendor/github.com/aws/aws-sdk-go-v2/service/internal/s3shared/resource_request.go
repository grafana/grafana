package s3shared

import (
	"fmt"
	"strings"

	awsarn "github.com/aws/aws-sdk-go-v2/aws/arn"
	"github.com/aws/aws-sdk-go-v2/service/internal/s3shared/arn"
)

// ResourceRequest represents an ARN resource and api request metadata
type ResourceRequest struct {
	Resource arn.Resource
	// RequestRegion is the region configured on the request config
	RequestRegion string

	// SigningRegion is the signing region resolved for the request
	SigningRegion string

	// PartitionID is the resolved partition id for the provided request region
	PartitionID string

	// UseARNRegion indicates if client should use the region provided in an ARN resource
	UseARNRegion bool

	// UseFIPS indicates if te client is configured for FIPS
	UseFIPS bool
}

// ARN returns the resource ARN
func (r ResourceRequest) ARN() awsarn.ARN {
	return r.Resource.GetARN()
}

// ResourceConfiguredForFIPS returns true if resource ARNs region is FIPS
//
// Deprecated: FIPS will not be present in the ARN region
func (r ResourceRequest) ResourceConfiguredForFIPS() bool {
	return IsFIPS(r.ARN().Region)
}

// AllowCrossRegion returns a bool value to denote if S3UseARNRegion flag is set
func (r ResourceRequest) AllowCrossRegion() bool {
	return r.UseARNRegion
}

// IsCrossPartition returns true if request is configured for region of another partition, than
// the partition that resource ARN region resolves to. IsCrossPartition will not return an error,
// if request is not configured with a specific partition id. This might happen if customer provides
// custom endpoint url, but does not associate a partition id with it.
func (r ResourceRequest) IsCrossPartition() (bool, error) {
	rv := r.PartitionID
	if len(rv) == 0 {
		return false, nil
	}

	av := r.Resource.GetARN().Partition
	if len(av) == 0 {
		return false, fmt.Errorf("no partition id for provided ARN")
	}

	return !strings.EqualFold(rv, av), nil
}

// IsCrossRegion returns true if request signing region is not same as arn region
func (r ResourceRequest) IsCrossRegion() bool {
	v := r.SigningRegion
	return !strings.EqualFold(v, r.Resource.GetARN().Region)
}

// IsFIPS returns true if region is a fips pseudo-region
//
// Deprecated: FIPS should be specified via EndpointOptions.
func IsFIPS(region string) bool {
	return strings.HasPrefix(region, "fips-") ||
		strings.HasSuffix(region, "-fips")
}
