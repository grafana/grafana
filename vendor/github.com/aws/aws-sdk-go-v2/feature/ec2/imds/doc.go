// Package imds provides the API client for interacting with the Amazon EC2
// Instance Metadata Service.
//
// All Client operation calls have a default timeout. If the operation is not
// completed before this timeout expires, the operation will be canceled. This
// timeout can be overridden through the following:
//   - Set the options flag DisableDefaultTimeout
//   - Provide a Context with a timeout or deadline with calling the client's operations.
//
// See the EC2 IMDS user guide for more information on using the API.
// https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-metadata.html
package imds
