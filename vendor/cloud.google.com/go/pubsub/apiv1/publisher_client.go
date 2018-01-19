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

package pubsub

import (
	"math"
	"time"

	"cloud.google.com/go/iam"
	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	pubsubpb "google.golang.org/genproto/googleapis/pubsub/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// PublisherCallOptions contains the retry settings for each method of PublisherClient.
type PublisherCallOptions struct {
	CreateTopic            []gax.CallOption
	UpdateTopic            []gax.CallOption
	Publish                []gax.CallOption
	GetTopic               []gax.CallOption
	ListTopics             []gax.CallOption
	ListTopicSubscriptions []gax.CallOption
	DeleteTopic            []gax.CallOption
}

func defaultPublisherClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("pubsub.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultPublisherCallOptions() *PublisherCallOptions {
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
		{"messaging", "one_plus_delivery"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.Aborted,
					codes.Canceled,
					codes.DeadlineExceeded,
					codes.Internal,
					codes.ResourceExhausted,
					codes.Unavailable,
					codes.Unknown,
				}, gax.Backoff{
					Initial:    100 * time.Millisecond,
					Max:        60000 * time.Millisecond,
					Multiplier: 1.3,
				})
			}),
		},
	}
	return &PublisherCallOptions{
		CreateTopic:            retry[[2]string{"default", "idempotent"}],
		UpdateTopic:            retry[[2]string{"default", "idempotent"}],
		Publish:                retry[[2]string{"messaging", "one_plus_delivery"}],
		GetTopic:               retry[[2]string{"default", "idempotent"}],
		ListTopics:             retry[[2]string{"default", "idempotent"}],
		ListTopicSubscriptions: retry[[2]string{"default", "idempotent"}],
		DeleteTopic:            retry[[2]string{"default", "idempotent"}],
	}
}

// PublisherClient is a client for interacting with Google Cloud Pub/Sub API.
type PublisherClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	publisherClient pubsubpb.PublisherClient

	// The call options for this service.
	CallOptions *PublisherCallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewPublisherClient creates a new publisher client.
//
// The service that an application uses to manipulate topics, and to send
// messages to a topic.
func NewPublisherClient(ctx context.Context, opts ...option.ClientOption) (*PublisherClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultPublisherClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &PublisherClient{
		conn:        conn,
		CallOptions: defaultPublisherCallOptions(),

		publisherClient: pubsubpb.NewPublisherClient(conn),
	}
	c.SetGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *PublisherClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *PublisherClient) Close() error {
	return c.conn.Close()
}

// SetGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *PublisherClient) SetGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// PublisherProjectPath returns the path for the project resource.
func PublisherProjectPath(project string) string {
	return "" +
		"projects/" +
		project +
		""
}

// PublisherTopicPath returns the path for the topic resource.
func PublisherTopicPath(project, topic string) string {
	return "" +
		"projects/" +
		project +
		"/topics/" +
		topic +
		""
}

func (c *PublisherClient) SubscriptionIAM(subscription *pubsubpb.Subscription) *iam.Handle {
	return iam.InternalNewHandle(c.Connection(), subscription.Name)
}

func (c *PublisherClient) TopicIAM(topic *pubsubpb.Topic) *iam.Handle {
	return iam.InternalNewHandle(c.Connection(), topic.Name)
}

// CreateTopic creates the given topic with the given name.
func (c *PublisherClient) CreateTopic(ctx context.Context, req *pubsubpb.Topic, opts ...gax.CallOption) (*pubsubpb.Topic, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CreateTopic[0:len(c.CallOptions.CreateTopic):len(c.CallOptions.CreateTopic)], opts...)
	var resp *pubsubpb.Topic
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.publisherClient.CreateTopic(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateTopic updates an existing topic. Note that certain properties of a topic are not
// modifiable.  Options settings follow the style guide:
// NOTE:  The style guide requires body: "topic" instead of body: "*".
// Keeping the latter for internal consistency in V1, however it should be
// corrected in V2.  See
// https://cloud.google.com/apis/design/standard_methods#update for details.
func (c *PublisherClient) UpdateTopic(ctx context.Context, req *pubsubpb.UpdateTopicRequest, opts ...gax.CallOption) (*pubsubpb.Topic, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.UpdateTopic[0:len(c.CallOptions.UpdateTopic):len(c.CallOptions.UpdateTopic)], opts...)
	var resp *pubsubpb.Topic
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.publisherClient.UpdateTopic(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Publish adds one or more messages to the topic. Returns NOT_FOUND if the topic
// does not exist. The message payload must not be empty; it must contain
// either a non-empty data field, or at least one attribute.
func (c *PublisherClient) Publish(ctx context.Context, req *pubsubpb.PublishRequest, opts ...gax.CallOption) (*pubsubpb.PublishResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.Publish[0:len(c.CallOptions.Publish):len(c.CallOptions.Publish)], opts...)
	var resp *pubsubpb.PublishResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.publisherClient.Publish(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// GetTopic gets the configuration of a topic.
func (c *PublisherClient) GetTopic(ctx context.Context, req *pubsubpb.GetTopicRequest, opts ...gax.CallOption) (*pubsubpb.Topic, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetTopic[0:len(c.CallOptions.GetTopic):len(c.CallOptions.GetTopic)], opts...)
	var resp *pubsubpb.Topic
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.publisherClient.GetTopic(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListTopics lists matching topics.
func (c *PublisherClient) ListTopics(ctx context.Context, req *pubsubpb.ListTopicsRequest, opts ...gax.CallOption) *TopicIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListTopics[0:len(c.CallOptions.ListTopics):len(c.CallOptions.ListTopics)], opts...)
	it := &TopicIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*pubsubpb.Topic, string, error) {
		var resp *pubsubpb.ListTopicsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.publisherClient.ListTopics(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Topics, resp.NextPageToken, nil
	}
	fetch := func(pageSize int, pageToken string) (string, error) {
		items, nextPageToken, err := it.InternalFetch(pageSize, pageToken)
		if err != nil {
			return "", err
		}
		it.items = append(it.items, items...)
		return nextPageToken, nil
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(fetch, it.bufLen, it.takeBuf)
	return it
}

// ListTopicSubscriptions lists the name of the subscriptions for this topic.
func (c *PublisherClient) ListTopicSubscriptions(ctx context.Context, req *pubsubpb.ListTopicSubscriptionsRequest, opts ...gax.CallOption) *StringIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListTopicSubscriptions[0:len(c.CallOptions.ListTopicSubscriptions):len(c.CallOptions.ListTopicSubscriptions)], opts...)
	it := &StringIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]string, string, error) {
		var resp *pubsubpb.ListTopicSubscriptionsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.publisherClient.ListTopicSubscriptions(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Subscriptions, resp.NextPageToken, nil
	}
	fetch := func(pageSize int, pageToken string) (string, error) {
		items, nextPageToken, err := it.InternalFetch(pageSize, pageToken)
		if err != nil {
			return "", err
		}
		it.items = append(it.items, items...)
		return nextPageToken, nil
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(fetch, it.bufLen, it.takeBuf)
	return it
}

// DeleteTopic deletes the topic with the given name. Returns NOT_FOUND if the topic
// does not exist. After a topic is deleted, a new topic may be created with
// the same name; this is an entirely new topic with none of the old
// configuration or subscriptions. Existing subscriptions to this topic are
// not deleted, but their topic field is set to _deleted-topic_.
func (c *PublisherClient) DeleteTopic(ctx context.Context, req *pubsubpb.DeleteTopicRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteTopic[0:len(c.CallOptions.DeleteTopic):len(c.CallOptions.DeleteTopic)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.publisherClient.DeleteTopic(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// StringIterator manages a stream of string.
type StringIterator struct {
	items    []string
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []string, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *StringIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *StringIterator) Next() (string, error) {
	var item string
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *StringIterator) bufLen() int {
	return len(it.items)
}

func (it *StringIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// TopicIterator manages a stream of *pubsubpb.Topic.
type TopicIterator struct {
	items    []*pubsubpb.Topic
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*pubsubpb.Topic, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *TopicIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *TopicIterator) Next() (*pubsubpb.Topic, error) {
	var item *pubsubpb.Topic
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *TopicIterator) bufLen() int {
	return len(it.items)
}

func (it *TopicIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}
