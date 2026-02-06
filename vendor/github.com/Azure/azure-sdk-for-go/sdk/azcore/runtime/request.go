//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"path"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/uuid"
)

// Base64Encoding is usesd to specify which base-64 encoder/decoder to use when
// encoding/decoding a slice of bytes to/from a string.
type Base64Encoding = exported.Base64Encoding

const (
	// Base64StdFormat uses base64.StdEncoding for encoding and decoding payloads.
	Base64StdFormat Base64Encoding = exported.Base64StdFormat

	// Base64URLFormat uses base64.RawURLEncoding for encoding and decoding payloads.
	Base64URLFormat Base64Encoding = exported.Base64URLFormat
)

// NewRequest creates a new policy.Request with the specified input.
// The endpoint MUST be properly encoded before calling this function.
func NewRequest(ctx context.Context, httpMethod string, endpoint string) (*policy.Request, error) {
	return exported.NewRequest(ctx, httpMethod, endpoint)
}

// NewRequestFromRequest creates a new policy.Request with an existing *http.Request
func NewRequestFromRequest(req *http.Request) (*policy.Request, error) {
	return exported.NewRequestFromRequest(req)
}

// EncodeQueryParams will parse and encode any query parameters in the specified URL.
// Any semicolons will automatically be escaped.
func EncodeQueryParams(u string) (string, error) {
	before, after, found := strings.Cut(u, "?")
	if !found {
		return u, nil
	}
	// starting in Go 1.17, url.ParseQuery will reject semicolons in query params.
	// so, we must escape them first. note that this assumes that semicolons aren't
	// being used as query param separators which is per the current RFC.
	// for more info:
	// https://github.com/golang/go/issues/25192
	// https://github.com/golang/go/issues/50034
	qp, err := url.ParseQuery(strings.ReplaceAll(after, ";", "%3B"))
	if err != nil {
		return "", err
	}
	return before + "?" + qp.Encode(), nil
}

// JoinPaths concatenates multiple URL path segments into one path,
// inserting path separation characters as required. JoinPaths will preserve
// query parameters in the root path
func JoinPaths(root string, paths ...string) string {
	if len(paths) == 0 {
		return root
	}

	qps := ""
	if strings.Contains(root, "?") {
		splitPath := strings.Split(root, "?")
		root, qps = splitPath[0], splitPath[1]
	}

	p := path.Join(paths...)
	// path.Join will remove any trailing slashes.
	// if one was provided, preserve it.
	if strings.HasSuffix(paths[len(paths)-1], "/") && !strings.HasSuffix(p, "/") {
		p += "/"
	}

	if qps != "" {
		p = p + "?" + qps
	}

	if strings.HasSuffix(root, "/") && strings.HasPrefix(p, "/") {
		root = root[:len(root)-1]
	} else if !strings.HasSuffix(root, "/") && !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return root + p
}

// EncodeByteArray will base-64 encode the byte slice v.
func EncodeByteArray(v []byte, format Base64Encoding) string {
	return exported.EncodeByteArray(v, format)
}

// MarshalAsByteArray will base-64 encode the byte slice v, then calls SetBody.
// The encoded value is treated as a JSON string.
func MarshalAsByteArray(req *policy.Request, v []byte, format Base64Encoding) error {
	// send as a JSON string
	encode := fmt.Sprintf("\"%s\"", EncodeByteArray(v, format))
	// tsp generated code can set Content-Type so we must prefer that
	return exported.SetBody(req, exported.NopCloser(strings.NewReader(encode)), shared.ContentTypeAppJSON, false)
}

// MarshalAsJSON calls json.Marshal() to get the JSON encoding of v then calls SetBody.
func MarshalAsJSON(req *policy.Request, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("error marshalling type %T: %s", v, err)
	}
	// tsp generated code can set Content-Type so we must prefer that
	return exported.SetBody(req, exported.NopCloser(bytes.NewReader(b)), shared.ContentTypeAppJSON, false)
}

// MarshalAsXML calls xml.Marshal() to get the XML encoding of v then calls SetBody.
func MarshalAsXML(req *policy.Request, v any) error {
	b, err := xml.Marshal(v)
	if err != nil {
		return fmt.Errorf("error marshalling type %T: %s", v, err)
	}
	// inclue the XML header as some services require it
	b = []byte(xml.Header + string(b))
	return req.SetBody(exported.NopCloser(bytes.NewReader(b)), shared.ContentTypeAppXML)
}

// SetMultipartFormData writes the specified keys/values as multi-part form fields with the specified value.
// File content must be specified as an [io.ReadSeekCloser] or [streaming.MultipartContent].
// Byte slices will be treated as JSON. All other values are treated as string values.
func SetMultipartFormData(req *policy.Request, formData map[string]any) error {
	body := bytes.Buffer{}
	writer := multipart.NewWriter(&body)

	writeContent := func(fieldname, filename string, src io.Reader) error {
		fd, err := writer.CreateFormFile(fieldname, filename)
		if err != nil {
			return err
		}
		// copy the data to the form file
		if _, err = io.Copy(fd, src); err != nil {
			return err
		}
		return nil
	}

	quoteEscaper := strings.NewReplacer("\\", "\\\\", `"`, "\\\"")

	writeMultipartContent := func(fieldname string, mpc streaming.MultipartContent) error {
		if mpc.Body == nil {
			return errors.New("streaming.MultipartContent.Body cannot be nil")
		}

		// use fieldname for the file name when unspecified
		filename := fieldname

		if mpc.ContentType == "" && mpc.Filename == "" {
			return writeContent(fieldname, filename, mpc.Body)
		}
		if mpc.Filename != "" {
			filename = mpc.Filename
		}
		// this is pretty much copied from multipart.Writer.CreateFormFile
		// but lets us set the caller provided Content-Type and filename
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition",
			fmt.Sprintf(`form-data; name="%s"; filename="%s"`,
				quoteEscaper.Replace(fieldname), quoteEscaper.Replace(filename)))
		contentType := "application/octet-stream"
		if mpc.ContentType != "" {
			contentType = mpc.ContentType
		}
		h.Set("Content-Type", contentType)
		fd, err := writer.CreatePart(h)
		if err != nil {
			return err
		}
		// copy the data to the form file
		if _, err = io.Copy(fd, mpc.Body); err != nil {
			return err
		}
		return nil
	}

	// the same as multipart.Writer.WriteField but lets us specify the Content-Type
	writeField := func(fieldname, contentType string, value string) error {
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition",
			fmt.Sprintf(`form-data; name="%s"`, quoteEscaper.Replace(fieldname)))
		h.Set("Content-Type", contentType)
		fd, err := writer.CreatePart(h)
		if err != nil {
			return err
		}
		if _, err = fd.Write([]byte(value)); err != nil {
			return err
		}
		return nil
	}

	for k, v := range formData {
		if rsc, ok := v.(io.ReadSeekCloser); ok {
			if err := writeContent(k, k, rsc); err != nil {
				return err
			}
			continue
		} else if rscs, ok := v.([]io.ReadSeekCloser); ok {
			for _, rsc := range rscs {
				if err := writeContent(k, k, rsc); err != nil {
					return err
				}
			}
			continue
		} else if mpc, ok := v.(streaming.MultipartContent); ok {
			if err := writeMultipartContent(k, mpc); err != nil {
				return err
			}
			continue
		} else if mpcs, ok := v.([]streaming.MultipartContent); ok {
			for _, mpc := range mpcs {
				if err := writeMultipartContent(k, mpc); err != nil {
					return err
				}
			}
			continue
		}

		var content string
		contentType := shared.ContentTypeTextPlain
		switch tt := v.(type) {
		case []byte:
			// JSON, don't quote it
			content = string(tt)
			contentType = shared.ContentTypeAppJSON
		case string:
			content = tt
		default:
			// ensure the value is in string format
			content = fmt.Sprintf("%v", v)
		}

		if err := writeField(k, contentType, content); err != nil {
			return err
		}
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return req.SetBody(exported.NopCloser(bytes.NewReader(body.Bytes())), writer.FormDataContentType())
}

// SkipBodyDownload will disable automatic downloading of the response body.
func SkipBodyDownload(req *policy.Request) {
	req.SetOperationValue(bodyDownloadPolicyOpValues{Skip: true})
}

// CtxAPINameKey is used as a context key for adding/retrieving the API name.
type CtxAPINameKey = shared.CtxAPINameKey

// NewUUID returns a new UUID using the RFC4122 algorithm.
func NewUUID() (string, error) {
	u, err := uuid.New()
	if err != nil {
		return "", err
	}
	return u.String(), nil
}
