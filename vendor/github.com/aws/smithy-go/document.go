package smithy

// Document provides access to loosely structured data in a document-like
// format.
//
// Deprecated: See the github.com/aws/smithy-go/document package.
type Document interface {
	UnmarshalDocument(interface{}) error
	GetValue() (interface{}, error)
}
