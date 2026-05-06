package ec2query

import (
	"encoding/xml"
	"fmt"
	"io"
)

// ErrorComponents represents the error response fields
// that will be deserialized from a ec2query error response body
type ErrorComponents struct {
	Code      string `xml:"Errors>Error>Code"`
	Message   string `xml:"Errors>Error>Message"`
	RequestID string `xml:"RequestID"`
}

// GetErrorResponseComponents returns the error components from a ec2query error response body
func GetErrorResponseComponents(r io.Reader) (ErrorComponents, error) {
	var er ErrorComponents
	if err := xml.NewDecoder(r).Decode(&er); err != nil && err != io.EOF {
		return ErrorComponents{}, fmt.Errorf("error while fetching xml error response code: %w", err)
	}
	return er, nil
}
