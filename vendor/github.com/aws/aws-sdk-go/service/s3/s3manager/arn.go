package s3manager

import (
	"fmt"
	"github.com/aws/aws-sdk-go/aws/arn"
)

func validateSupportedARNType(bucket string) error {
	if !arn.IsARN(bucket) {
		return nil
	}

	parsedARN, err := arn.Parse(bucket)
	if err != nil {
		return err
	}

	if parsedARN.Service == "s3-object-lambda" {
		return fmt.Errorf("manager does not support s3-object-lambda service ARNs")
	}

	return nil
}
