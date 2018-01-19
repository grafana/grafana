// Copyright 2017, Google LLC All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// AUTO-GENERATED CODE. DO NOT EDIT.

package vision

import (
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	visionpb "google.golang.org/genproto/googleapis/cloud/vision/v1p1beta1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// ImageAnnotatorCallOptions contains the retry settings for each method of ImageAnnotatorClient.
type ImageAnnotatorCallOptions struct {
	BatchAnnotateImages []gax.CallOption
}

func defaultImageAnnotatorClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("vision.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultImageAnnotatorCallOptions() *ImageAnnotatorCallOptions {
	retry := map[[2]string][]gax.CallOption{
		{"default", "idempotent"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.DeadlineExceeded,
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    100 * time.Millisecond,
					Max:        60000 * time.Millisecond,
					Multiplier: 1.3,
				})
			}),
		},
	}
	return &ImageAnnotatorCallOptions{
		BatchAnnotateImages: retry[[2]string{"default", "idempotent"}],
	}
}

// ImageAnnotatorClient is a client for interacting with Google Cloud Vision API.
type ImageAnnotatorClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	imageAnnotatorClient visionpb.ImageAnnotatorClient

	// The call options for this service.
	CallOptions *ImageAnnotatorCallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewImageAnnotatorClient creates a new image annotator client.
//
// Service that performs Google Cloud Vision API detection tasks over client
// images, such as face, landmark, logo, label, and text detection. The
// ImageAnnotator service returns detected entities from the images.
func NewImageAnnotatorClient(ctx context.Context, opts ...option.ClientOption) (*ImageAnnotatorClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultImageAnnotatorClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &ImageAnnotatorClient{
		conn:        conn,
		CallOptions: defaultImageAnnotatorCallOptions(),

		imageAnnotatorClient: visionpb.NewImageAnnotatorClient(conn),
	}
	c.setGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *ImageAnnotatorClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *ImageAnnotatorClient) Close() error {
	return c.conn.Close()
}

// setGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *ImageAnnotatorClient) setGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// BatchAnnotateImages run image detection and annotation for a batch of images.
func (c *ImageAnnotatorClient) BatchAnnotateImages(ctx context.Context, req *visionpb.BatchAnnotateImagesRequest, opts ...gax.CallOption) (*visionpb.BatchAnnotateImagesResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.BatchAnnotateImages[0:len(c.CallOptions.BatchAnnotateImages):len(c.CallOptions.BatchAnnotateImages)], opts...)
	var resp *visionpb.BatchAnnotateImagesResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.imageAnnotatorClient.BatchAnnotateImages(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
