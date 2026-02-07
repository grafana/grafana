/*
Package customizations provides customizations for the Amazon S3 API client.

This package provides support for following S3 customizations

	ProcessARN Middleware: processes an ARN if provided as input and updates the endpoint as per the arn type

	UpdateEndpoint Middleware: resolves a custom endpoint as per s3 config options

	RemoveBucket Middleware: removes a serialized bucket name from request url path

	processResponseWith200Error Middleware: Deserializing response error with 200 status code

# Virtual Host style url addressing

Since serializers serialize by default as path style url, we use customization
to modify the endpoint url when `UsePathStyle` option on S3Client is unset or
false. This flag will be ignored if `UseAccelerate` option is set to true.

If UseAccelerate is not enabled, and the bucket name is not a valid hostname
label, they SDK will fallback to forcing the request to be made as if
UsePathStyle was enabled. This behavior is also used if UseDualStackEndpoint is enabled.

https://docs.aws.amazon.com/AmazonS3/latest/dev/dual-stack-endpoints.html#dual-stack-endpoints-description

# Transfer acceleration

By default S3 Transfer acceleration support is disabled. By enabling `UseAccelerate`
option on S3Client, one can enable s3 transfer acceleration support. Transfer
acceleration only works with Virtual Host style addressing, and thus `UsePathStyle`
option if set is ignored. Transfer acceleration is not supported for S3 operations
DeleteBucket, ListBuckets, and CreateBucket.

# Dualstack support

By default dualstack support for s3 client is disabled. By enabling `UseDualstack`
option on s3 client, you can enable dualstack endpoint support.

# Endpoint customizations

Customizations to lookup ARN, process ARN needs to happen before request serialization.
UpdateEndpoint middleware which mutates resources based on Options such as
UseDualstack, UseAccelerate for modifying resolved endpoint are executed after
request serialization. Remove bucket middleware is executed after
an request is serialized, and removes the serialized bucket name from request path

	Middleware layering:

	Initialize : HTTP Request -> ARN Lookup -> Input-Validation -> Serialize step

	Serialize : HTTP Request -> Process ARN -> operation serializer -> Update-Endpoint customization -> Remove-Bucket -> next middleware

Customization options:

	UseARNRegion (Disabled by Default)

	UsePathStyle (Disabled by Default)

	UseAccelerate (Disabled by Default)

	UseDualstack (Disabled by Default)

# Handle Error response with 200 status code

S3 operations: CopyObject, CompleteMultipartUpload, UploadPartCopy can have an
error Response with status code 2xx. The processResponseWith200Error middleware
customizations enables SDK to check for an error within response body prior to
deserialization.

As the check for 2xx response containing an error needs to be performed earlier
than response deserialization. Since the behavior of Deserialization is in
reverse order to the other stack steps its easier to consider that "after" means
"before".

	Middleware layering:

	HTTP Response -> handle 200 error customization -> deserialize
*/
package customizations
