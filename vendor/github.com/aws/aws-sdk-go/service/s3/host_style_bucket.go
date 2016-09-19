package s3

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/aws/request"
)

// an operationBlacklist is a list of operation names that should a
// request handler should not be executed with.
type operationBlacklist []string

// Continue will return true of the Request's operation name is not
// in the blacklist. False otherwise.
func (b operationBlacklist) Continue(r *request.Request) bool {
	for i := 0; i < len(b); i++ {
		if b[i] == r.Operation.Name {
			return false
		}
	}
	return true
}

var accelerateOpBlacklist = operationBlacklist{
	opListBuckets, opCreateBucket, opDeleteBucket,
}

// Request handler to automatically add the bucket name to the endpoint domain
// if possible. This style of bucket is valid for all bucket names which are
// DNS compatible and do not contain "."
func updateEndpointForS3Config(r *request.Request) {
	forceHostStyle := aws.BoolValue(r.Config.S3ForcePathStyle)
	accelerate := aws.BoolValue(r.Config.S3UseAccelerate)
	useDualStack := aws.BoolValue(r.Config.UseDualStack)

	if useDualStack && accelerate {
		r.Error = awserr.New("InvalidParameterException",
			fmt.Sprintf("configuration aws.Config.UseDualStack is not compatible with aws.Config.Accelerate"),
			nil)
		return
	}

	if accelerate && accelerateOpBlacklist.Continue(r) {
		if forceHostStyle {
			if r.Config.Logger != nil {
				r.Config.Logger.Log("ERROR: aws.Config.S3UseAccelerate is not compatible with aws.Config.S3ForcePathStyle, ignoring S3ForcePathStyle.")
			}
		}
		updateEndpointForAccelerate(r)
	} else if !forceHostStyle && r.Operation.Name != opGetBucketLocation {
		updateEndpointForHostStyle(r)
	}
}

func updateEndpointForHostStyle(r *request.Request) {
	bucket, ok := bucketNameFromReqParams(r.Params)
	if !ok {
		// Ignore operation requests if the bucketname was not provided
		// if this is an input validation error the validation handler
		// will report it.
		return
	}

	if !hostCompatibleBucketName(r.HTTPRequest.URL, bucket) {
		// bucket name must be valid to put into the host
		return
	}

	moveBucketToHost(r.HTTPRequest.URL, bucket)
}

func updateEndpointForAccelerate(r *request.Request) {
	bucket, ok := bucketNameFromReqParams(r.Params)
	if !ok {
		// Ignore operation requests if the bucketname was not provided
		// if this is an input validation error the validation handler
		// will report it.
		return
	}

	if !hostCompatibleBucketName(r.HTTPRequest.URL, bucket) {
		r.Error = awserr.New("InvalidParameterException",
			fmt.Sprintf("bucket name %s is not compatibile with S3 Accelerate", bucket),
			nil)
		return
	}

	// Change endpoint from s3(-[a-z0-1-])?.amazonaws.com to s3-accelerate.amazonaws.com
	r.HTTPRequest.URL.Host = replaceHostRegion(r.HTTPRequest.URL.Host, "accelerate")
	moveBucketToHost(r.HTTPRequest.URL, bucket)
}

// Attempts to retrieve the bucket name from the request input parameters.
// If no bucket is found, or the field is empty "", false will be returned.
func bucketNameFromReqParams(params interface{}) (string, bool) {
	b, _ := awsutil.ValuesAtPath(params, "Bucket")
	if len(b) == 0 {
		return "", false
	}

	if bucket, ok := b[0].(*string); ok {
		if bucketStr := aws.StringValue(bucket); bucketStr != "" {
			return bucketStr, true
		}
	}

	return "", false
}

// hostCompatibleBucketName returns true if the request should
// put the bucket in the host. This is false if S3ForcePathStyle is
// explicitly set or if the bucket is not DNS compatible.
func hostCompatibleBucketName(u *url.URL, bucket string) bool {
	// Bucket might be DNS compatible but dots in the hostname will fail
	// certificate validation, so do not use host-style.
	if u.Scheme == "https" && strings.Contains(bucket, ".") {
		return false
	}

	// if the bucket is DNS compatible
	return dnsCompatibleBucketName(bucket)
}

var reDomain = regexp.MustCompile(`^[a-z0-9][a-z0-9\.\-]{1,61}[a-z0-9]$`)
var reIPAddress = regexp.MustCompile(`^(\d+\.){3}\d+$`)

// dnsCompatibleBucketName returns true if the bucket name is DNS compatible.
// Buckets created outside of the classic region MUST be DNS compatible.
func dnsCompatibleBucketName(bucket string) bool {
	return reDomain.MatchString(bucket) &&
		!reIPAddress.MatchString(bucket) &&
		!strings.Contains(bucket, "..")
}

// moveBucketToHost moves the bucket name from the URI path to URL host.
func moveBucketToHost(u *url.URL, bucket string) {
	u.Host = bucket + "." + u.Host
	u.Path = strings.Replace(u.Path, "/{Bucket}", "", -1)
	if u.Path == "" {
		u.Path = "/"
	}
}

const s3HostPrefix = "s3"

// replaceHostRegion replaces the S3 region string in the host with the
// value provided. If v is empty the host prefix returned will be s3.
func replaceHostRegion(host, v string) string {
	if !strings.HasPrefix(host, s3HostPrefix) {
		return host
	}

	suffix := host[len(s3HostPrefix):]
	for i := len(s3HostPrefix); i < len(host); i++ {
		if host[i] == '.' {
			// Trim until '.' leave the it in place.
			suffix = host[i:]
			break
		}
	}

	if len(v) == 0 {
		return fmt.Sprintf("s3%s", suffix)
	}

	return fmt.Sprintf("s3-%s%s", v, suffix)
}
