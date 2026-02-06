package arn

import "fmt"

// arnable is implemented by the relevant S3/S3Control
// operations which have members that may need ARN
// processing.
type arnable interface {
	SetARNMember(string) error
	GetARNMember() (*string, bool)
}

// GetARNField would be called during middleware execution
// to retrieve a member value that is an ARN in need of
// processing.
func GetARNField(input interface{}) (*string, bool) {
	v, ok := input.(arnable)
	if !ok {
		return nil, false
	}
	return v.GetARNMember()
}

// SetARNField would called during middleware exeuction
// to set a member value that required ARN processing.
func SetARNField(input interface{}, v string) error {
	params, ok := input.(arnable)
	if !ok {
		return fmt.Errorf("Params does not contain arn field member")
	}
	return params.SetARNMember(v)
}
