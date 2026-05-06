package awsauth

import "github.com/grafana/grafana-aws-sdk/pkg/awsds"

// AuthType enumerates the kinds of authentication that are supported
type AuthType string

var (
	AuthTypeDefault           AuthType = "default"
	AuthTypeSharedCreds       AuthType = "credentials"
	AuthTypeKeys              AuthType = "keys"
	AuthTypeEC2IAMRole        AuthType = "ec2_iam_role"
	AuthTypeGrafanaAssumeRole AuthType = "grafana_assume_role"
	AuthTypeUnknown           AuthType = "unknown"
	AuthTypeMissing           AuthType = ""
)

func fromLegacy(at awsds.AuthType) AuthType {
	switch at {
	case awsds.AuthTypeDefault:
		return AuthTypeDefault
	case awsds.AuthTypeSharedCreds:
		return AuthTypeSharedCreds
	case awsds.AuthTypeKeys:
		return AuthTypeKeys
	case awsds.AuthTypeEC2IAMRole:
		return AuthTypeEC2IAMRole
	case awsds.AuthTypeGrafanaAssumeRole:
		return AuthTypeGrafanaAssumeRole
	default:
		return AuthTypeUnknown
	}
}
