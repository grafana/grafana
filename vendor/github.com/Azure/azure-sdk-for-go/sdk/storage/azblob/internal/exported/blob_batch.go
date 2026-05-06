//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package exported

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/to"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/uuid"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
)

const (
	batchIdPrefix = "batch_"
	httpVersion   = "HTTP/1.1"
	httpNewline   = "\r\n"
)

// createBatchID is used for creating a new batch id which is used as batch boundary in the request body
func createBatchID() (string, error) {
	batchID, err := uuid.New()
	if err != nil {
		return "", err
	}

	return batchIdPrefix + batchID.String(), nil
}

// buildSubRequest is used for building the sub-request. Example:
// DELETE /container0/blob0 HTTP/1.1
// x-ms-date: Thu, 14 Jun 2018 16:46:54 GMT
// Authorization: SharedKey account:<redacted>
// Content-Length: 0
func buildSubRequest(req *policy.Request) []byte {
	var batchSubRequest strings.Builder
	blobPath := req.Raw().URL.EscapedPath()
	if len(req.Raw().URL.RawQuery) > 0 {
		blobPath += "?" + req.Raw().URL.RawQuery
	}

	batchSubRequest.WriteString(fmt.Sprintf("%s %s %s%s", req.Raw().Method, blobPath, httpVersion, httpNewline))

	for k, v := range req.Raw().Header {
		if strings.EqualFold(k, shared.HeaderXmsVersion) {
			continue
		}
		if len(v) > 0 {
			batchSubRequest.WriteString(fmt.Sprintf("%v: %v%v", k, v[0], httpNewline))
		}
	}

	batchSubRequest.WriteString(httpNewline)
	return []byte(batchSubRequest.String())
}

// CreateBatchRequest creates a new batch request using the sub-requests present in the BlobBatchBuilder.
//
// Example of a sub-request in the batch request body:
//
//	--batch_357de4f7-6d0b-4e02-8cd2-6361411a9525
//	Content-Type: application/http
//	Content-Transfer-Encoding: binary
//	Content-ID: 0
//
//	DELETE /container0/blob0 HTTP/1.1
//	x-ms-date: Thu, 14 Jun 2018 16:46:54 GMT
//	Authorization: SharedKey account:<redacted>
//	Content-Length: 0
func CreateBatchRequest(bb *BlobBatchBuilder) ([]byte, string, error) {
	batchID, err := createBatchID()
	if err != nil {
		return nil, "", err
	}

	// Create a new multipart buffer
	reqBody := &bytes.Buffer{}
	writer := multipart.NewWriter(reqBody)

	// Set the boundary
	err = writer.SetBoundary(batchID)
	if err != nil {
		return nil, "", err
	}

	partHeaders := make(textproto.MIMEHeader)
	partHeaders["Content-Type"] = []string{"application/http"}
	partHeaders["Content-Transfer-Encoding"] = []string{"binary"}
	var partWriter io.Writer

	for i, req := range bb.SubRequests {
		if bb.AuthPolicy != nil {
			_, err := bb.AuthPolicy.Do(req)
			if err != nil && !strings.EqualFold(err.Error(), "no more policies") {
				if log.Should(EventSubmitBatch) {
					log.Writef(EventSubmitBatch, "failed to authorize sub-request for %v.\nError: %v", req.Raw().URL.Path, err.Error())
				}
				return nil, "", err
			}
		}

		partHeaders["Content-ID"] = []string{fmt.Sprintf("%v", i)}
		partWriter, err = writer.CreatePart(partHeaders)
		if err != nil {
			return nil, "", err
		}

		_, err = partWriter.Write(buildSubRequest(req))
		if err != nil {
			return nil, "", err
		}
	}

	// Close the multipart writer
	err = writer.Close()
	if err != nil {
		return nil, "", err
	}

	return reqBody.Bytes(), batchID, nil
}

// UpdateSubRequestHeaders updates the sub-request headers.
// Removes x-ms-version header.
func UpdateSubRequestHeaders(req *policy.Request) {
	// remove x-ms-version header from the request header
	for k := range req.Raw().Header {
		if strings.EqualFold(k, shared.HeaderXmsVersion) {
			delete(req.Raw().Header, k)
		}
	}
}

// BatchResponseItem contains the response for the individual sub-requests.
type BatchResponseItem struct {
	ContentID     *int
	ContainerName *string
	BlobName      *string
	RequestID     *string
	Version       *string
	Error         error // nil error indicates that the batch sub-request operation is successful
}

func getResponseBoundary(contentType *string) (string, error) {
	if contentType == nil {
		return "", fmt.Errorf("Content-Type returned in SubmitBatch response is nil")
	}

	_, params, err := mime.ParseMediaType(*contentType)
	if err != nil {
		return "", err
	}

	if val, ok := params["boundary"]; ok {
		return val, nil
	} else {
		return "", fmt.Errorf("batch boundary not present in Content-Type header of the SubmitBatch response.\nContent-Type: %v", *contentType)
	}
}

func getContentID(part *multipart.Part) (*int, error) {
	contentID := part.Header.Get("Content-ID")
	if contentID == "" {
		return nil, nil
	}

	val, err := strconv.Atoi(strings.TrimSpace(contentID))
	if err != nil {
		return nil, err
	}
	return &val, nil
}

func getResponseHeader(key string, resp *http.Response) *string {
	val := resp.Header.Get(key)
	if val == "" {
		return nil
	}
	return &val
}

// ParseBlobBatchResponse is used for parsing the batch response body into individual sub-responses for each item in the batch.
func ParseBlobBatchResponse(respBody io.ReadCloser, contentType *string, subRequests []*policy.Request) ([]*BatchResponseItem, error) {
	boundary, err := getResponseBoundary(contentType)
	if err != nil {
		return nil, err
	}

	respReader := multipart.NewReader(respBody, boundary)
	var responses []*BatchResponseItem

	for {
		part, err := respReader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			return nil, err
		}

		batchSubResponse := &BatchResponseItem{}
		batchSubResponse.ContentID, err = getContentID(part)
		if err != nil {
			return nil, err
		}

		if batchSubResponse.ContentID != nil {
			path := strings.Trim(subRequests[*batchSubResponse.ContentID].Raw().URL.Path, "/")
			p := strings.Split(path, "/")
			batchSubResponse.ContainerName = to.Ptr(p[0])
			batchSubResponse.BlobName = to.Ptr(strings.Join(p[1:], "/"))
		}

		respBytes, err := io.ReadAll(part)
		if err != nil {
			return nil, err
		}
		respBytes = append(respBytes, byte('\n'))
		buf := bytes.NewBuffer(respBytes)
		resp, err := http.ReadResponse(bufio.NewReader(buf), nil)
		// sub-response parsing error
		if err != nil {
			return nil, err
		}

		batchSubResponse.RequestID = getResponseHeader(shared.HeaderXmsRequestID, resp)
		batchSubResponse.Version = getResponseHeader(shared.HeaderXmsVersion, resp)

		// sub-response failure
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			if len(responses) == 0 && batchSubResponse.ContentID == nil {
				// this case can happen when the parent request fails.
				// For example, batch request having more than 256 sub-requests.
				return nil, fmt.Errorf("%v", string(respBytes))
			}

			resp.Request = subRequests[*batchSubResponse.ContentID].Raw()
			batchSubResponse.Error = runtime.NewResponseError(resp)
		}

		responses = append(responses, batchSubResponse)
	}

	if len(responses) != len(subRequests) {
		return nil, fmt.Errorf("expected %v responses, got %v for the batch ID: %v", len(subRequests), len(responses), boundary)
	}

	return responses, nil
}

// not exported but used for batch request creation

// BlobBatchBuilder is used for creating the blob batch request
type BlobBatchBuilder struct {
	AuthPolicy  policy.Policy
	SubRequests []*policy.Request
}

// BlobBatchOperationType defines the operation of the blob batch sub-requests.
type BlobBatchOperationType string

const (
	BatchDeleteOperationType  BlobBatchOperationType = "delete"
	BatchSetTierOperationType BlobBatchOperationType = "set tier"
)
