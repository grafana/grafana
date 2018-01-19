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

package language

import (
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	languagepb "google.golang.org/genproto/googleapis/cloud/language/v1beta2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// CallOptions contains the retry settings for each method of Client.
type CallOptions struct {
	AnalyzeSentiment       []gax.CallOption
	AnalyzeEntities        []gax.CallOption
	AnalyzeEntitySentiment []gax.CallOption
	AnalyzeSyntax          []gax.CallOption
	ClassifyText           []gax.CallOption
	AnnotateText           []gax.CallOption
}

func defaultClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("language.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultCallOptions() *CallOptions {
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
	return &CallOptions{
		AnalyzeSentiment:       retry[[2]string{"default", "idempotent"}],
		AnalyzeEntities:        retry[[2]string{"default", "idempotent"}],
		AnalyzeEntitySentiment: retry[[2]string{"default", "idempotent"}],
		AnalyzeSyntax:          retry[[2]string{"default", "idempotent"}],
		ClassifyText:           retry[[2]string{"default", "idempotent"}],
		AnnotateText:           retry[[2]string{"default", "idempotent"}],
	}
}

// Client is a client for interacting with Google Cloud Natural Language API.
type Client struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	client languagepb.LanguageServiceClient

	// The call options for this service.
	CallOptions *CallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewClient creates a new language service client.
//
// Provides text analysis operations such as sentiment analysis and entity
// recognition.
func NewClient(ctx context.Context, opts ...option.ClientOption) (*Client, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &Client{
		conn:        conn,
		CallOptions: defaultCallOptions(),

		client: languagepb.NewLanguageServiceClient(conn),
	}
	c.setGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *Client) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *Client) Close() error {
	return c.conn.Close()
}

// setGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *Client) setGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// AnalyzeSentiment analyzes the sentiment of the provided text.
func (c *Client) AnalyzeSentiment(ctx context.Context, req *languagepb.AnalyzeSentimentRequest, opts ...gax.CallOption) (*languagepb.AnalyzeSentimentResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.AnalyzeSentiment[0:len(c.CallOptions.AnalyzeSentiment):len(c.CallOptions.AnalyzeSentiment)], opts...)
	var resp *languagepb.AnalyzeSentimentResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.AnalyzeSentiment(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// AnalyzeEntities finds named entities (currently proper names and common nouns) in the text
// along with entity types, salience, mentions for each entity, and
// other properties.
func (c *Client) AnalyzeEntities(ctx context.Context, req *languagepb.AnalyzeEntitiesRequest, opts ...gax.CallOption) (*languagepb.AnalyzeEntitiesResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.AnalyzeEntities[0:len(c.CallOptions.AnalyzeEntities):len(c.CallOptions.AnalyzeEntities)], opts...)
	var resp *languagepb.AnalyzeEntitiesResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.AnalyzeEntities(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// AnalyzeEntitySentiment finds entities, similar to [AnalyzeEntities][google.cloud.language.v1beta2.LanguageService.AnalyzeEntities] in the text and analyzes
// sentiment associated with each entity and its mentions.
func (c *Client) AnalyzeEntitySentiment(ctx context.Context, req *languagepb.AnalyzeEntitySentimentRequest, opts ...gax.CallOption) (*languagepb.AnalyzeEntitySentimentResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.AnalyzeEntitySentiment[0:len(c.CallOptions.AnalyzeEntitySentiment):len(c.CallOptions.AnalyzeEntitySentiment)], opts...)
	var resp *languagepb.AnalyzeEntitySentimentResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.AnalyzeEntitySentiment(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// AnalyzeSyntax analyzes the syntax of the text and provides sentence boundaries and
// tokenization along with part of speech tags, dependency trees, and other
// properties.
func (c *Client) AnalyzeSyntax(ctx context.Context, req *languagepb.AnalyzeSyntaxRequest, opts ...gax.CallOption) (*languagepb.AnalyzeSyntaxResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.AnalyzeSyntax[0:len(c.CallOptions.AnalyzeSyntax):len(c.CallOptions.AnalyzeSyntax)], opts...)
	var resp *languagepb.AnalyzeSyntaxResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.AnalyzeSyntax(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ClassifyText classifies a document into categories.
func (c *Client) ClassifyText(ctx context.Context, req *languagepb.ClassifyTextRequest, opts ...gax.CallOption) (*languagepb.ClassifyTextResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ClassifyText[0:len(c.CallOptions.ClassifyText):len(c.CallOptions.ClassifyText)], opts...)
	var resp *languagepb.ClassifyTextResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.ClassifyText(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// AnnotateText a convenience method that provides all syntax, sentiment, entity, and
// classification features in one call.
func (c *Client) AnnotateText(ctx context.Context, req *languagepb.AnnotateTextRequest, opts ...gax.CallOption) (*languagepb.AnnotateTextResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.AnnotateText[0:len(c.CallOptions.AnnotateText):len(c.CallOptions.AnnotateText)], opts...)
	var resp *languagepb.AnnotateTextResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.AnnotateText(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
