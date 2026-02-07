package arn

import (
	"fmt"
	"strings"

	awsarn "github.com/aws/aws-sdk-go-v2/aws/arn"
	"github.com/aws/aws-sdk-go-v2/service/internal/s3shared/arn"
)

const (
	s3Namespace              = "s3"
	s3ObjectsLambdaNamespace = "s3-object-lambda"
	s3OutpostsNamespace      = "s3-outposts"
)

// ParseEndpointARN parses a given generic aws ARN into a s3 arn resource.
func ParseEndpointARN(v awsarn.ARN) (arn.Resource, error) {
	return arn.ParseResource(v, accessPointResourceParser)
}

func accessPointResourceParser(a awsarn.ARN) (arn.Resource, error) {
	resParts := arn.SplitResource(a.Resource)

	switch resParts[0] {
	case "accesspoint":
		switch a.Service {
		case s3Namespace:
			return arn.ParseAccessPointResource(a, resParts[1:])
		case s3ObjectsLambdaNamespace:
			return parseS3ObjectLambdaAccessPointResource(a, resParts)
		default:
			return arn.AccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: fmt.Sprintf("service is not %s or %s", s3Namespace, s3ObjectsLambdaNamespace)}
		}
	case "outpost":
		if a.Service != s3OutpostsNamespace {
			return arn.OutpostAccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: "service is not %s"}
		}
		return parseOutpostAccessPointResource(a, resParts[1:])
	default:
		return nil, arn.InvalidARNError{ARN: a, Reason: "unknown resource type"}
	}
}

func parseOutpostAccessPointResource(a awsarn.ARN, resParts []string) (arn.OutpostAccessPointARN, error) {
	// outpost accesspoint arn is only valid if service is s3-outposts
	if a.Service != "s3-outposts" {
		return arn.OutpostAccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: "service is not s3-outposts"}
	}

	if len(resParts) == 0 {
		return arn.OutpostAccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: "outpost resource-id not set"}
	}

	if len(resParts) < 3 {
		return arn.OutpostAccessPointARN{}, arn.InvalidARNError{
			ARN: a, Reason: "access-point resource not set in Outpost ARN",
		}
	}

	resID := strings.TrimSpace(resParts[0])
	if len(resID) == 0 {
		return arn.OutpostAccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: "outpost resource-id not set"}
	}

	var outpostAccessPointARN = arn.OutpostAccessPointARN{}
	switch resParts[1] {
	case "accesspoint":
		// Do not allow region-less outpost access-point arns.
		if len(a.Region) == 0 {
			return arn.OutpostAccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: "region is not set"}
		}

		accessPointARN, err := arn.ParseAccessPointResource(a, resParts[2:])
		if err != nil {
			return arn.OutpostAccessPointARN{}, err
		}
		// set access-point arn
		outpostAccessPointARN.AccessPointARN = accessPointARN
	default:
		return arn.OutpostAccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: "access-point resource not set in Outpost ARN"}
	}

	// set outpost id
	outpostAccessPointARN.OutpostID = resID
	return outpostAccessPointARN, nil
}

func parseS3ObjectLambdaAccessPointResource(a awsarn.ARN, resParts []string) (arn.S3ObjectLambdaAccessPointARN, error) {
	if a.Service != s3ObjectsLambdaNamespace {
		return arn.S3ObjectLambdaAccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: fmt.Sprintf("service is not %s", s3ObjectsLambdaNamespace)}
	}

	if len(a.Region) == 0 {
		return arn.S3ObjectLambdaAccessPointARN{}, arn.InvalidARNError{ARN: a, Reason: fmt.Sprintf("%s region not set", s3ObjectsLambdaNamespace)}
	}

	accessPointARN, err := arn.ParseAccessPointResource(a, resParts[1:])
	if err != nil {
		return arn.S3ObjectLambdaAccessPointARN{}, err
	}

	return arn.S3ObjectLambdaAccessPointARN{
		AccessPointARN: accessPointARN,
	}, nil
}
