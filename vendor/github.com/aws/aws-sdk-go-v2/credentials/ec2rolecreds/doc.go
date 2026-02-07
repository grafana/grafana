// Package ec2rolecreds provides the credentials provider implementation for
// retrieving AWS credentials from Amazon EC2 Instance Roles via Amazon EC2 IMDS.
//
// # Concurrency and caching
//
// The Provider is not safe to be used concurrently, and does not provide any
// caching of credentials retrieved. You should wrap the Provider with a
// `aws.CredentialsCache` to provide concurrency safety, and caching of
// credentials.
//
// # Loading credentials with the SDK's AWS Config
//
// The EC2 Instance role credentials provider will automatically be the resolved
// credential provider in the credential chain if no other credential provider is
// resolved first.
//
// To explicitly instruct the SDK's credentials resolving to use the EC2 Instance
// role for credentials, you specify a `credentials_source` property in the config
// profile the SDK will load.
//
//	[default]
//	credential_source = Ec2InstanceMetadata
//
// # Loading credentials with the Provider directly
//
// Another way to use the EC2 Instance role credentials provider is to create it
// directly and assign it as the credentials provider for an API client.
//
// The following example creates a credentials provider for a command, and wraps
// it with the CredentialsCache before assigning the provider to the Amazon S3 API
// client's Credentials option.
//
//	provider := imds.New(imds.Options{})
//
//	// Create the service client value configured for credentials.
//	svc := s3.New(s3.Options{
//	  Credentials: aws.NewCredentialsCache(provider),
//	})
//
// If you need more control, you can set the configuration options on the
// credentials provider using the imds.Options type to configure the EC2 IMDS
// API Client and ExpiryWindow of the retrieved credentials.
//
//	provider := imds.New(imds.Options{
//		// See imds.Options type's documentation for more options available.
//		Client: imds.New(Options{
//			HTTPClient: customHTTPClient,
//		}),
//
//		// Modify how soon credentials expire prior to their original expiry time.
//		ExpiryWindow: 5 * time.Minute,
//	})
//
// # EC2 IMDS API Client
//
// See the github.com/aws/aws-sdk-go-v2/feature/ec2/imds module for more details on
// configuring the client, and options available.
package ec2rolecreds
