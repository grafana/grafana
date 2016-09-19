package s3crypto_test

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/awstesting/unit"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3crypto"
)

func TestGetObject(t *testing.T) {
	key, _ := hex.DecodeString("31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22")
	keyB64 := base64.URLEncoding.EncodeToString(key)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, fmt.Sprintf("%s%s%s", `{"KeyId":"test-key-id","Plaintext":"`, keyB64, `"}`))
	}))
	defer ts.Close()

	sess := unit.Session.Copy(&aws.Config{
		MaxRetries:       aws.Int(0),
		Endpoint:         aws.String(ts.URL[7:]),
		DisableSSL:       aws.Bool(true),
		S3ForcePathStyle: aws.Bool(true),
		Region:           aws.String("us-west-2"),
	})

	c := s3crypto.NewDecryptionClient(sess)
	assert.NotNil(t, c)
	input := &s3.GetObjectInput{
		Key:    aws.String("test"),
		Bucket: aws.String("test"),
	}
	req, out := c.GetObjectRequest(input)
	req.Handlers.Send.Clear()
	req.Handlers.Send.PushBack(func(r *request.Request) {
		iv, err := hex.DecodeString("0d18e06c7c725ac9e362e1ce")
		assert.NoError(t, err)
		b, err := hex.DecodeString("fa4362189661d163fcd6a56d8bf0405ad636ac1bbedd5cc3ee727dc2ab4a9489")
		assert.NoError(t, err)

		r.HTTPResponse = &http.Response{
			StatusCode: 200,
			Header: http.Header{
				http.CanonicalHeaderKey("x-amz-meta-x-amz-key-v2"):   []string{"SpFRES0JyU8BLZSKo51SrwILK4lhtZsWiMNjgO4WmoK+joMwZPG7Hw=="},
				http.CanonicalHeaderKey("x-amz-meta-x-amz-iv"):       []string{base64.URLEncoding.EncodeToString(iv)},
				http.CanonicalHeaderKey("x-amz-meta-x-amz-matdesc"):  []string{`{"kms_cmk_id":"arn:aws:kms:us-east-1:172259396726:key/a22a4b30-79f4-4b3d-bab4-a26d327a231b"}`},
				http.CanonicalHeaderKey("x-amz-meta-x-amz-wrap-alg"): []string{s3crypto.KMSWrap},
				http.CanonicalHeaderKey("x-amz-meta-x-amz-cek-alg"):  []string{s3crypto.AESGCMNoPadding},
				http.CanonicalHeaderKey("x-amz-meta-x-amz-tag-len"):  []string{"128"},
			},
			Body: ioutil.NopCloser(bytes.NewBuffer(b)),
		}
		out.Metadata = make(map[string]*string)
		out.Metadata["x-amz-wrap-alg"] = aws.String(s3crypto.KMSWrap)
	})
	err := req.Send()
	assert.NoError(t, err)
	b, err := ioutil.ReadAll(out.Body)
	assert.NoError(t, err)
	expected, err := hex.DecodeString("2db5168e932556f8089a0622981d017d")
	assert.NoError(t, err)

	assert.Equal(t, len(expected), len(b))
	assert.Equal(t, expected, b)
}
