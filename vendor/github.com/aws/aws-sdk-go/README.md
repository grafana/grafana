# AWS SDK for Go [![API Reference](http://img.shields.io/badge/api-reference-blue.svg)](http://docs.aws.amazon.com/sdk-for-go/api) [![Join the chat at https://gitter.im/aws/aws-sdk-go](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/aws/aws-sdk-go?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![Build Status](https://img.shields.io/travis/aws/aws-sdk-go.svg)](https://travis-ci.org/aws/aws-sdk-go) [![Apache V2 License](http://img.shields.io/badge/license-Apache%20V2-blue.svg)](https://github.com/aws/aws-sdk-go/blob/master/LICENSE.txt)

aws-sdk-go is the official AWS SDK for the Go programming language.

Checkout our [release notes](https://github.com/aws/aws-sdk-go/releases) for information about the latest bug fixes, updates, and features added to the SDK.

## Installing

If you are using Go 1.5 with the `GO15VENDOREXPERIMENT=1` vendoring flag, or 1.6 and higher you can use the following command to retrieve the SDK. The SDK's non-testing dependencies will be included and are vendored in the `vendor` folder.

    go get -u github.com/aws/aws-sdk-go

Otherwise if your Go environment does not have vendoring support enabled, or you do not want to include the vendored SDK's dependencies you can use the following command to retrieve the SDK and its non-testing dependencies using `go get`.

    go get -u github.com/aws/aws-sdk-go/aws/...
    go get -u github.com/aws/aws-sdk-go/service/...

If you're looking to retrieve just the SDK without any dependencies use the following command.

    go get -d github.com/aws/aws-sdk-go/

These two processes will still include the `vendor` folder and it should be deleted if its not going to be used by your environment.

    rm -rf $GOPATH/src/github.com/aws/aws-sdk-go/vendor

## Getting Help

Please use these community resources for getting help. We use the GitHub issues for tracking bugs and feature requests.
* Ask a question on [StackOverflow](http://stackoverflow.com/) and tag it with the [`aws-sdk-go`](http://stackoverflow.com/questions/tagged/aws-sdk-go) tag.
* Come join the AWS SDK for Go community chat on [gitter](https://gitter.im/aws/aws-sdk-go).
* Open a support ticket with [AWS Support](http://docs.aws.amazon.com/awssupport/latest/user/getting-started.html).
* If you think you may of found a bug, please open an [issue](https://github.com/aws/aws-sdk-go/issues/new).

## Opening Issues

If you encounter a bug with the AWS SDK for Go we would like to hear about it. Search the [existing issues]( https://github.com/aws/aws-sdk-go/issues) and see if others are also experiencing the issue before opening a new issue. Please include the version of AWS SDK for Go, Go language, and OS you’re using. Please also include repro case when appropriate.

The GitHub issues are intended for bug reports and feature requests. For help and questions with using AWS SDK for GO please make use of the resources listed in the [Getting Help]( https://github.com/aws/aws-sdk-go#getting-help) section. Keeping the list of open issues lean will help us respond in a timely manner.

## Reference Documentation

[`Getting Started Guide`](https://aws.amazon.com/sdk-for-go/) - This document is a general introduction how to configure and make requests with the SDK. If this is your first time using the SDK, this documentation and the API documentation will help you get started. This document focuses on the syntax and behavior of the SDK. The [Service Developer Guide](https://aws.amazon.com/documentation/) will help you get started using specific AWS services.

[`SDK API Reference Documentation`](https://docs.aws.amazon.com/sdk-for-go/api/) - Use this document to look up all API operation input and output parameters for AWS services supported by the SDK. The API reference also includes documentation of the SDK, and examples how to using the SDK, service client API operations, and API operation require parameters.

[`Service Developer Guide`](https://aws.amazon.com/documentation/) - Use this documentation to learn how to interface with an AWS service. These are great guides both, if you're getting started with a service, or looking for more information on a service. You should not need this document for coding, though in some cases, services may supply helpful samples that you might want to look out for.

[`SDK Examples`](https://github.com/aws/aws-sdk-go/tree/master/example) - Included in the SDK's repo are a several hand crafted examples using the SDK features and AWS services.

## Configuring Credentials

Before using the SDK, ensure that you've configured credentials. The best
way to configure credentials on a development machine is to use the
`~/.aws/credentials` file, which might look like:

```
[default]
aws_access_key_id = AKID1234567890
aws_secret_access_key = MY-SECRET-KEY
```

You can learn more about the credentials file from this
[blog post](http://blogs.aws.amazon.com/security/post/Tx3D6U6WSFGOK2H/A-New-and-Standardized-Way-to-Manage-Credentials-in-the-AWS-SDKs).

Alternatively, you can set the following environment variables:

```
AWS_ACCESS_KEY_ID=AKID1234567890
AWS_SECRET_ACCESS_KEY=MY-SECRET-KEY
```

### AWS shared config file (`~/.aws/config`)
The AWS SDK for Go added support the shared config file in release [v1.3.0](https://github.com/aws/aws-sdk-go/releases/tag/v1.3.0). You can opt into enabling support for the shared config by setting the environment variable `AWS_SDK_LOAD_CONFIG` to a truthy value. See the [Session](https://docs.aws.amazon.com/sdk-for-go/v1/developer-guide/sessions.html) docs for more information about this feature.

## Using the Go SDK

To use a service in the SDK, create a service variable by calling the `New()`
function. Once you have a service client, you can call API operations which each
return response data and a possible error.

For example the following code shows how to upload an object to Amazon S3 with a Context timeout.

```go
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

// Uploads a file to S3 given a bucket and object key. Also takes a duration
// value to terminate the update if it doesn't complete within that time.
//
// The AWS Region needs to be provided in the AWS shared config or on the
// environment variable as `AWS_REGION`. Credentials also must be provided
// Will default to shared config file, but can load from environment if provided.
//
// Usage:
//   # Upload myfile.txt to myBucket/myKey. Must complete within 10 minutes or will fail
//   go run withContext.go -b mybucket -k myKey -d 10m < myfile.txt
func main() {
	var bucket, key string
	var timeout time.Duration

	flag.StringVar(&bucket, "b", "", "Bucket name.")
	flag.StringVar(&key, "k", "", "Object key name.")
	flag.DurationVar(&timeout, "d", 0, "Upload timeout.")
	flag.Parse()

	sess := session.Must(session.NewSession())
	svc := s3.New(sess)

	// Create a context with a timeout that will abort the upload if it takes
	// more than the passed in timeout.
	ctx := context.Background()
	var cancelFn func()
	if timeout > 0 {
		ctx, cancelFn = context.WithTimeout(ctx, timeout)
	}
	// Ensure the context is canceled to prevent leaking.
	// See context package for more information, https://golang.org/pkg/context/
	defer cancelFn()

	// Uploads the object to S3. The Context will interrupt the request if the
	// timeout expires.
	_, err := svc.PutObjectWithContext(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   os.Stdin,
	})
	if err != nil {
		if aerr, ok := err.(awserr.Error); ok && aerr.Code() == request.CanceledErrorCode {
			// If the SDK can determine the request or retry delay was canceled
			// by a context the CanceledErrorCode error code will be returned.
			fmt.Fprintf(os.Stderr, "upload canceled due to timeout, %v\n", err)
		} else {
			fmt.Fprintf(os.Stderr, "failed to upload object, %v\n", err)
		}
		os.Exit(1)
	}

	fmt.Printf("successfully uploaded file to %s/%s\n", bucket, key)
}
```

You can find more information and operations in our
[API documentation](http://docs.aws.amazon.com/sdk-for-go/api/).

## License

This SDK is distributed under the
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0),
see LICENSE.txt and NOTICE.txt for more information.
