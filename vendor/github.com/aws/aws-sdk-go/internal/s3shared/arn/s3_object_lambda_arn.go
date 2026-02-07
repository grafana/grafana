package arn

// S3ObjectLambdaARN represents an ARN for the s3-object-lambda service
type S3ObjectLambdaARN interface {
	Resource

	isS3ObjectLambdasARN()
}

// S3ObjectLambdaAccessPointARN is an S3ObjectLambdaARN for the Access Point resource type
type S3ObjectLambdaAccessPointARN struct {
	AccessPointARN
}

func (s S3ObjectLambdaAccessPointARN) isS3ObjectLambdasARN() {}
