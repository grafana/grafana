package s3_test

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/awstesting/unit"
	"github.com/aws/aws-sdk-go/service/s3"
)

type testErrorCase struct {
	RespFn           func() *http.Response
	ReqID            string
	Code, Msg        string
	WithoutStatusMsg bool
}

var testUnmarshalCases = []testErrorCase{
	{
		RespFn: func() *http.Response {
			return &http.Response{
				StatusCode:    301,
				Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
				Body:          ioutil.NopCloser(bytes.NewReader(nil)),
				ContentLength: -1,
			}
		},
		ReqID: "abc123",
		Code:  "BucketRegionError", Msg: "incorrect region, the bucket is not in 'mock-region' region",
	},
	{
		RespFn: func() *http.Response {
			return &http.Response{
				StatusCode:    403,
				Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
				Body:          ioutil.NopCloser(bytes.NewReader(nil)),
				ContentLength: 0,
			}
		},
		ReqID: "abc123",
		Code:  "Forbidden", Msg: "Forbidden",
	},
	{
		RespFn: func() *http.Response {
			return &http.Response{
				StatusCode:    400,
				Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
				Body:          ioutil.NopCloser(bytes.NewReader(nil)),
				ContentLength: 0,
			}
		},
		ReqID: "abc123",
		Code:  "BadRequest", Msg: "Bad Request",
	},
	{
		RespFn: func() *http.Response {
			return &http.Response{
				StatusCode:    404,
				Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
				Body:          ioutil.NopCloser(bytes.NewReader(nil)),
				ContentLength: 0,
			}
		},
		ReqID: "abc123",
		Code:  "NotFound", Msg: "Not Found",
	},
	{
		RespFn: func() *http.Response {
			body := `<Error><Code>SomeException</Code><Message>Exception message</Message></Error>`
			return &http.Response{
				StatusCode:    500,
				Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
				Body:          ioutil.NopCloser(strings.NewReader(body)),
				ContentLength: int64(len(body)),
			}
		},
		ReqID: "abc123",
		Code:  "SomeException", Msg: "Exception message",
	},
	{
		RespFn: func() *http.Response {
			return &http.Response{
				StatusCode:    404,
				Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
				Body:          ioutil.NopCloser(bytes.NewReader(nil)),
				ContentLength: -1,
			}
		},
		ReqID: "abc123",
		Code:  "NotFound", Msg: "Not Found", WithoutStatusMsg: true,
	},
	{
		RespFn: func() *http.Response {
			return &http.Response{
				StatusCode:    404,
				Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
				Body:          ioutil.NopCloser(bytes.NewReader(nil)),
				ContentLength: -1,
			}
		},
		ReqID: "abc123",
		Code:  "NotFound", Msg: "Not Found",
	},
}

func TestUnmarshalError(t *testing.T) {
	for _, c := range testUnmarshalCases {
		s := s3.New(unit.Session)
		s.Handlers.Send.Clear()
		s.Handlers.Send.PushBack(func(r *request.Request) {
			r.HTTPResponse = c.RespFn()
			if !c.WithoutStatusMsg {
				r.HTTPResponse.Status = fmt.Sprintf("%d%s",
					r.HTTPResponse.StatusCode,
					http.StatusText(r.HTTPResponse.StatusCode))
			}
		})
		_, err := s.PutBucketAcl(&s3.PutBucketAclInput{
			Bucket: aws.String("bucket"), ACL: aws.String("public-read"),
		})

		assert.Error(t, err)
		assert.Equal(t, c.Code, err.(awserr.Error).Code())
		assert.Equal(t, c.Msg, err.(awserr.Error).Message())
		assert.Equal(t, c.ReqID, err.(awserr.RequestFailure).RequestID())
	}
}

const completeMultiResp = `
163
<?xml version="1.0" encoding="UTF-8"?>

<CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Location>https://bucket.s3-us-west-2.amazonaws.com/key</Location><Bucket>bucket</Bucket><Key>key</Key><ETag>&quot;a7d414b9133d6483d9a1c4e04e856e3b-2&quot;</ETag></CompleteMultipartUploadResult>
0
`

func Test200NoErrorUnmarshalError(t *testing.T) {
	s := s3.New(unit.Session)
	s.Handlers.Send.Clear()
	s.Handlers.Send.PushBack(func(r *request.Request) {
		r.HTTPResponse = &http.Response{
			StatusCode:    200,
			Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
			Body:          ioutil.NopCloser(strings.NewReader(completeMultiResp)),
			ContentLength: -1,
		}
		r.HTTPResponse.Status = http.StatusText(r.HTTPResponse.StatusCode)
	})
	_, err := s.CompleteMultipartUpload(&s3.CompleteMultipartUploadInput{
		Bucket: aws.String("bucket"), Key: aws.String("key"),
		UploadId: aws.String("id"),
		MultipartUpload: &s3.CompletedMultipartUpload{Parts: []*s3.CompletedPart{
			{ETag: aws.String("etag"), PartNumber: aws.Int64(1)},
		}},
	})

	assert.NoError(t, err)
}

const completeMultiErrResp = `<Error><Code>SomeException</Code><Message>Exception message</Message></Error>`

func Test200WithErrorUnmarshalError(t *testing.T) {
	s := s3.New(unit.Session)
	s.Handlers.Send.Clear()
	s.Handlers.Send.PushBack(func(r *request.Request) {
		r.HTTPResponse = &http.Response{
			StatusCode:    200,
			Header:        http.Header{"X-Amz-Request-Id": []string{"abc123"}},
			Body:          ioutil.NopCloser(strings.NewReader(completeMultiErrResp)),
			ContentLength: -1,
		}
		r.HTTPResponse.Status = http.StatusText(r.HTTPResponse.StatusCode)
	})
	_, err := s.CompleteMultipartUpload(&s3.CompleteMultipartUploadInput{
		Bucket: aws.String("bucket"), Key: aws.String("key"),
		UploadId: aws.String("id"),
		MultipartUpload: &s3.CompletedMultipartUpload{Parts: []*s3.CompletedPart{
			{ETag: aws.String("etag"), PartNumber: aws.Int64(1)},
		}},
	})

	assert.Error(t, err)

	assert.Equal(t, "SomeException", err.(awserr.Error).Code())
	assert.Equal(t, "Exception message", err.(awserr.Error).Message())
	assert.Equal(t, "abc123", err.(awserr.RequestFailure).RequestID())
}
