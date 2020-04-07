package arn

import (
	"strings"

	"github.com/aws/aws-sdk-go/aws/arn"
)

// AccessPointARN provides representation
type AccessPointARN struct {
	arn.ARN
	AccessPointName string
}

// GetARN returns the base ARN for the Access Point resource
func (a AccessPointARN) GetARN() arn.ARN {
	return a.ARN
}

// ParseAccessPointResource attempts to parse the ARN's resource as an
// AccessPoint resource.
func ParseAccessPointResource(a arn.ARN, resParts []string) (AccessPointARN, error) {
	if len(a.Region) == 0 {
		return AccessPointARN{}, InvalidARNError{a, "region not set"}
	}
	if len(a.AccountID) == 0 {
		return AccessPointARN{}, InvalidARNError{a, "account-id not set"}
	}
	if len(resParts) == 0 {
		return AccessPointARN{}, InvalidARNError{a, "resource-id not set"}
	}
	if len(resParts) > 1 {
		return AccessPointARN{}, InvalidARNError{a, "sub resource not supported"}
	}

	resID := resParts[0]
	if len(strings.TrimSpace(resID)) == 0 {
		return AccessPointARN{}, InvalidARNError{a, "resource-id not set"}
	}

	return AccessPointARN{
		ARN:             a,
		AccessPointName: resID,
	}, nil
}
