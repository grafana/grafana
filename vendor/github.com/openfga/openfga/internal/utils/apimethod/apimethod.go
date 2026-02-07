// Package apimethod provides a type for the API grpc method names.
package apimethod

type APIMethod string

// String converts the APIMethod to its string representation.
func (a APIMethod) String() string {
	return string(a)
}

// API methods.
const (
	ReadAuthorizationModel  APIMethod = "ReadAuthorizationModel"
	ReadAuthorizationModels APIMethod = "ReadAuthorizationModels"
	Read                    APIMethod = "Read"
	Write                   APIMethod = "Write"
	ListObjects             APIMethod = "ListObjects"
	StreamedListObjects     APIMethod = "StreamedListObjects"
	Check                   APIMethod = "Check"
	BatchCheck              APIMethod = "BatchCheck"
	ListUsers               APIMethod = "ListUsers"
	WriteAssertions         APIMethod = "WriteAssertions"
	ReadAssertions          APIMethod = "ReadAssertions"
	WriteAuthorizationModel APIMethod = "WriteAuthorizationModel"
	ListStores              APIMethod = "ListStores"
	CreateStore             APIMethod = "CreateStore"
	GetStore                APIMethod = "GetStore"
	DeleteStore             APIMethod = "DeleteStore"
	Expand                  APIMethod = "Expand"
	ReadChanges             APIMethod = "ReadChanges"
)
