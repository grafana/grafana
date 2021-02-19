package s3

import (
	"net/url"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	awsarn "github.com/aws/aws-sdk-go/aws/arn"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/endpoints"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/private/protocol"
	"github.com/aws/aws-sdk-go/service/s3/internal/arn"
)

// Used by shapes with members decorated as endpoint ARN.
func parseEndpointARN(v string) (arn.Resource, error) {
	return arn.ParseResource(v, accessPointResourceParser)
}

func accessPointResourceParser(a awsarn.ARN) (arn.Resource, error) {
	resParts := arn.SplitResource(a.Resource)
	switch resParts[0] {
	case "accesspoint":
		return arn.ParseAccessPointResource(a, resParts[1:])
	default:
		return nil, arn.InvalidARNError{ARN: a, Reason: "unknown resource type"}
	}
}

func endpointHandler(req *request.Request) {
	endpoint, ok := req.Params.(endpointARNGetter)
	if !ok || !endpoint.hasEndpointARN() {
		updateBucketEndpointFromParams(req)
		return
	}

	resource, err := endpoint.getEndpointARN()
	if err != nil {
		req.Error = newInvalidARNError(nil, err)
		return
	}

	resReq := resourceRequest{
		Resource: resource,
		Request:  req,
	}

	if resReq.IsCrossPartition() {
		req.Error = newClientPartitionMismatchError(resource,
			req.ClientInfo.PartitionID, aws.StringValue(req.Config.Region), nil)
		return
	}

	if !resReq.AllowCrossRegion() && resReq.IsCrossRegion() {
		req.Error = newClientRegionMismatchError(resource,
			req.ClientInfo.PartitionID, aws.StringValue(req.Config.Region), nil)
		return
	}

	if resReq.HasCustomEndpoint() {
		req.Error = newInvalidARNWithCustomEndpointError(resource, nil)
		return
	}

	switch tv := resource.(type) {
	case arn.AccessPointARN:
		err = updateRequestAccessPointEndpoint(req, tv)
		if err != nil {
			req.Error = err
		}
	default:
		req.Error = newInvalidARNError(resource, nil)
	}
}

type resourceRequest struct {
	Resource arn.Resource
	Request  *request.Request
}

func (r resourceRequest) ARN() awsarn.ARN {
	return r.Resource.GetARN()
}

func (r resourceRequest) AllowCrossRegion() bool {
	return aws.BoolValue(r.Request.Config.S3UseARNRegion)
}

func (r resourceRequest) UseFIPS() bool {
	return isFIPS(aws.StringValue(r.Request.Config.Region))
}

func (r resourceRequest) IsCrossPartition() bool {
	return r.Request.ClientInfo.PartitionID != r.Resource.GetARN().Partition
}

func (r resourceRequest) IsCrossRegion() bool {
	return isCrossRegion(r.Request, r.Resource.GetARN().Region)
}

func (r resourceRequest) HasCustomEndpoint() bool {
	return len(aws.StringValue(r.Request.Config.Endpoint)) > 0
}

func isFIPS(clientRegion string) bool {
	return strings.HasPrefix(clientRegion, "fips-") || strings.HasSuffix(clientRegion, "-fips")
}
func isCrossRegion(req *request.Request, otherRegion string) bool {
	return req.ClientInfo.SigningRegion != otherRegion
}

func updateBucketEndpointFromParams(r *request.Request) {
	bucket, ok := bucketNameFromReqParams(r.Params)
	if !ok {
		// Ignore operation requests if the bucket name was not provided
		// if this is an input validation error the validation handler
		// will report it.
		return
	}
	updateEndpointForS3Config(r, bucket)
}

func updateRequestAccessPointEndpoint(req *request.Request, accessPoint arn.AccessPointARN) error {
	// Accelerate not supported
	if aws.BoolValue(req.Config.S3UseAccelerate) {
		return newClientConfiguredForAccelerateError(accessPoint,
			req.ClientInfo.PartitionID, aws.StringValue(req.Config.Region), nil)
	}

	// Ignore the disable host prefix for access points since custom endpoints
	// are not supported.
	req.Config.DisableEndpointHostPrefix = aws.Bool(false)

	if err := accessPointEndpointBuilder(accessPoint).Build(req); err != nil {
		return err
	}

	removeBucketFromPath(req.HTTPRequest.URL)

	return nil
}

func removeBucketFromPath(u *url.URL) {
	u.Path = strings.Replace(u.Path, "/{Bucket}", "", -1)
	if u.Path == "" {
		u.Path = "/"
	}
}

type accessPointEndpointBuilder arn.AccessPointARN

const (
	accessPointPrefixLabel   = "accesspoint"
	accountIDPrefixLabel     = "accountID"
	accesPointPrefixTemplate = "{" + accessPointPrefixLabel + "}-{" + accountIDPrefixLabel + "}."
)

func (a accessPointEndpointBuilder) Build(req *request.Request) error {
	resolveRegion := arn.AccessPointARN(a).Region
	cfgRegion := aws.StringValue(req.Config.Region)

	if isFIPS(cfgRegion) {
		if aws.BoolValue(req.Config.S3UseARNRegion) && isCrossRegion(req, resolveRegion) {
			// FIPS with cross region is not supported, the SDK must fail
			// because there is no well defined method for SDK to construct a
			// correct FIPS endpoint.
			return newClientConfiguredForCrossRegionFIPSError(arn.AccessPointARN(a),
				req.ClientInfo.PartitionID, cfgRegion, nil)
		}
		resolveRegion = cfgRegion
	}

	endpoint, err := resolveRegionalEndpoint(req, resolveRegion)
	if err != nil {
		return newFailedToResolveEndpointError(arn.AccessPointARN(a),
			req.ClientInfo.PartitionID, cfgRegion, err)
	}

	if err = updateRequestEndpoint(req, endpoint.URL); err != nil {
		return err
	}

	const serviceEndpointLabel = "s3-accesspoint"

	// dualstack provided by endpoint resolver
	cfgHost := req.HTTPRequest.URL.Host
	if strings.HasPrefix(cfgHost, "s3") {
		req.HTTPRequest.URL.Host = serviceEndpointLabel + cfgHost[2:]
	}

	protocol.HostPrefixBuilder{
		Prefix:   accesPointPrefixTemplate,
		LabelsFn: a.hostPrefixLabelValues,
	}.Build(req)

	req.ClientInfo.SigningName = endpoint.SigningName
	req.ClientInfo.SigningRegion = endpoint.SigningRegion

	err = protocol.ValidateEndpointHost(req.Operation.Name, req.HTTPRequest.URL.Host)
	if err != nil {
		return newInvalidARNError(arn.AccessPointARN(a), err)
	}

	return nil
}

func (a accessPointEndpointBuilder) hostPrefixLabelValues() map[string]string {
	return map[string]string{
		accessPointPrefixLabel: arn.AccessPointARN(a).AccessPointName,
		accountIDPrefixLabel:   arn.AccessPointARN(a).AccountID,
	}
}

func resolveRegionalEndpoint(r *request.Request, region string) (endpoints.ResolvedEndpoint, error) {
	return r.Config.EndpointResolver.EndpointFor(EndpointsID, region, func(opts *endpoints.Options) {
		opts.DisableSSL = aws.BoolValue(r.Config.DisableSSL)
		opts.UseDualStack = aws.BoolValue(r.Config.UseDualStack)
		opts.S3UsEast1RegionalEndpoint = endpoints.RegionalS3UsEast1Endpoint
	})
}

func updateRequestEndpoint(r *request.Request, endpoint string) (err error) {
	endpoint = endpoints.AddScheme(endpoint, aws.BoolValue(r.Config.DisableSSL))

	r.HTTPRequest.URL, err = url.Parse(endpoint + r.Operation.HTTPPath)
	if err != nil {
		return awserr.New(request.ErrCodeSerialization,
			"failed to parse endpoint URL", err)
	}

	return nil
}
