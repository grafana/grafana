package route53

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/awstesting"
)

func TestUnmarhsalErrorLeak(t *testing.T) {
	req := &request.Request{
		Operation: &request.Operation{
			Name: opChangeResourceRecordSets,
		},
		HTTPRequest: &http.Request{
			Header: make(http.Header),
			Body:   &awstesting.ReadCloser{Size: 2048},
		},
	}
	req.HTTPResponse = &http.Response{
		Body: &awstesting.ReadCloser{Size: 2048},
		Header: http.Header{
			"X-Amzn-Requestid": []string{"1"},
		},
		StatusCode: http.StatusOK,
	}

	reader := req.HTTPResponse.Body.(*awstesting.ReadCloser)
	unmarshalChangeResourceRecordSetsError(req)

	assert.NotNil(t, req.Error)
	assert.Equal(t, reader.Closed, true)
	assert.Equal(t, reader.Size, 0)
}
