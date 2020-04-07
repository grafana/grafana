package s3

import (
	"fmt"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/s3/internal/arn"
)

const (
	invalidARNErrorErrCode    = "InvalidARNError"
	configurationErrorErrCode = "ConfigurationError"
)

type invalidARNError struct {
	message  string
	resource arn.Resource
	origErr  error
}

func (e invalidARNError) Error() string {
	var extra string
	if e.resource != nil {
		extra = "ARN: " + e.resource.String()
	}
	return awserr.SprintError(e.Code(), e.Message(), extra, e.origErr)
}

func (e invalidARNError) Code() string {
	return invalidARNErrorErrCode
}

func (e invalidARNError) Message() string {
	return e.message
}

func (e invalidARNError) OrigErr() error {
	return e.origErr
}

func newInvalidARNError(resource arn.Resource, err error) invalidARNError {
	return invalidARNError{
		message:  "invalid ARN",
		origErr:  err,
		resource: resource,
	}
}

func newInvalidARNWithCustomEndpointError(resource arn.Resource, err error) invalidARNError {
	return invalidARNError{
		message:  "resource ARN not supported with custom client endpoints",
		origErr:  err,
		resource: resource,
	}
}

// ARN not supported for the target partition
func newInvalidARNWithUnsupportedPartitionError(resource arn.Resource, err error) invalidARNError {
	return invalidARNError{
		message:  "resource ARN not supported for the target ARN partition",
		origErr:  err,
		resource: resource,
	}
}

type configurationError struct {
	message           string
	resource          arn.Resource
	clientPartitionID string
	clientRegion      string
	origErr           error
}

func (e configurationError) Error() string {
	extra := fmt.Sprintf("ARN: %s, client partition: %s, client region: %s",
		e.resource, e.clientPartitionID, e.clientRegion)

	return awserr.SprintError(e.Code(), e.Message(), extra, e.origErr)
}

func (e configurationError) Code() string {
	return configurationErrorErrCode
}

func (e configurationError) Message() string {
	return e.message
}

func (e configurationError) OrigErr() error {
	return e.origErr
}

func newClientPartitionMismatchError(resource arn.Resource, clientPartitionID, clientRegion string, err error) configurationError {
	return configurationError{
		message:           "client partition does not match provided ARN partition",
		origErr:           err,
		resource:          resource,
		clientPartitionID: clientPartitionID,
		clientRegion:      clientRegion,
	}
}

func newClientRegionMismatchError(resource arn.Resource, clientPartitionID, clientRegion string, err error) configurationError {
	return configurationError{
		message:           "client region does not match provided ARN region",
		origErr:           err,
		resource:          resource,
		clientPartitionID: clientPartitionID,
		clientRegion:      clientRegion,
	}
}

func newFailedToResolveEndpointError(resource arn.Resource, clientPartitionID, clientRegion string, err error) configurationError {
	return configurationError{
		message:           "endpoint resolver failed to find an endpoint for the provided ARN region",
		origErr:           err,
		resource:          resource,
		clientPartitionID: clientPartitionID,
		clientRegion:      clientRegion,
	}
}

func newClientConfiguredForFIPSError(resource arn.Resource, clientPartitionID, clientRegion string, err error) configurationError {
	return configurationError{
		message:           "client configured for fips but cross-region resource ARN provided",
		origErr:           err,
		resource:          resource,
		clientPartitionID: clientPartitionID,
		clientRegion:      clientRegion,
	}
}

func newClientConfiguredForAccelerateError(resource arn.Resource, clientPartitionID, clientRegion string, err error) configurationError {
	return configurationError{
		message:           "client configured for S3 Accelerate but is supported with resource ARN",
		origErr:           err,
		resource:          resource,
		clientPartitionID: clientPartitionID,
		clientRegion:      clientRegion,
	}
}

func newClientConfiguredForCrossRegionFIPSError(resource arn.Resource, clientPartitionID, clientRegion string, err error) configurationError {
	return configurationError{
		message:           "client configured for FIPS with cross-region enabled but is supported with cross-region resource ARN",
		origErr:           err,
		resource:          resource,
		clientPartitionID: clientPartitionID,
		clientRegion:      clientRegion,
	}
}
