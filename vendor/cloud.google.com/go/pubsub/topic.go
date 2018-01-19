// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pubsub

import (
	"errors"
	"fmt"
	"runtime"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/iam"
	"github.com/golang/protobuf/proto"
	"golang.org/x/net/context"
	"google.golang.org/api/support/bundler"
	pb "google.golang.org/genproto/googleapis/pubsub/v1"
)

const (
	// The maximum number of messages that can be in a single publish request, as
	// determined by the PubSub service.
	MaxPublishRequestCount = 1000

	// The maximum size of a single publish request in bytes, as determined by the PubSub service.
	MaxPublishRequestBytes = 1e7

	maxInt = int(^uint(0) >> 1)
)

// ErrOversizedMessage indicates that a message's size exceeds MaxPublishRequestBytes.
var ErrOversizedMessage = bundler.ErrOversizedItem

// Topic is a reference to a PubSub topic.
//
// The methods of Topic are safe for use by multiple goroutines.
type Topic struct {
	s service
	// The fully qualified identifier for the topic, in the format "projects/<projid>/topics/<name>"
	name string

	// Settings for publishing messages. All changes must be made before the
	// first call to Publish. The default is DefaultPublishSettings.
	PublishSettings PublishSettings

	mu      sync.RWMutex
	stopped bool
	bundler *bundler.Bundler

	wg sync.WaitGroup

	// Channel for message bundles to be published. Close to indicate that Stop was called.
	bundlec chan []*bundledMessage
}

// PublishSettings control the bundling of published messages.
type PublishSettings struct {

	// Publish a non-empty batch after this delay has passed.
	DelayThreshold time.Duration

	// Publish a batch when it has this many messages. The maximum is
	// MaxPublishRequestCount.
	CountThreshold int

	// Publish a batch when its size in bytes reaches this value.
	ByteThreshold int

	// The number of goroutines that invoke the Publish RPC concurrently.
	// Defaults to a multiple of GOMAXPROCS.
	NumGoroutines int

	// The maximum time that the client will attempt to publish a bundle of messages.
	Timeout time.Duration
}

// DefaultPublishSettings holds the default values for topics' PublishSettings.
var DefaultPublishSettings = PublishSettings{
	DelayThreshold: 1 * time.Millisecond,
	CountThreshold: 100,
	ByteThreshold:  1e6,
	Timeout:        60 * time.Second,
}

// CreateTopic creates a new topic.
// The specified topic ID must start with a letter, and contain only letters
// ([A-Za-z]), numbers ([0-9]), dashes (-), underscores (_), periods (.),
// tildes (~), plus (+) or percent signs (%). It must be between 3 and 255
// characters in length, and must not start with "goog".
// If the topic already exists an error will be returned.
func (c *Client) CreateTopic(ctx context.Context, id string) (*Topic, error) {
	t := c.Topic(id)
	err := c.s.createTopic(ctx, t.name)
	return t, err
}

// Topic creates a reference to a topic in the client's project.
//
// If a Topic's Publish method is called, it has background goroutines
// associated with it. Clean them up by calling Topic.Stop.
//
// Avoid creating many Topic instances if you use them to publish.
func (c *Client) Topic(id string) *Topic {
	return c.TopicInProject(id, c.projectID)
}

// TopicInProject creates a reference to a topic in the given project.
//
// If a Topic's Publish method is called, it has background goroutines
// associated with it. Clean them up by calling Topic.Stop.
//
// Avoid creating many Topic instances if you use them to publish.
func (c *Client) TopicInProject(id, projectID string) *Topic {
	return newTopic(c.s, fmt.Sprintf("projects/%s/topics/%s", projectID, id))
}

func newTopic(s service, name string) *Topic {
	// bundlec is unbuffered. A buffer would occupy memory not
	// accounted for by the bundler, so BufferedByteLimit would be a lie:
	// the actual memory consumed would be higher.
	return &Topic{
		s:               s,
		name:            name,
		PublishSettings: DefaultPublishSettings,
		bundlec:         make(chan []*bundledMessage),
	}
}

// Topics returns an iterator which returns all of the topics for the client's project.
func (c *Client) Topics(ctx context.Context) *TopicIterator {
	return &TopicIterator{
		s:    c.s,
		next: c.s.listProjectTopics(ctx, c.fullyQualifiedProjectName()),
	}
}

// TopicIterator is an iterator that returns a series of topics.
type TopicIterator struct {
	s    service
	next nextStringFunc
}

// Next returns the next topic. If there are no more topics, iterator.Done will be returned.
func (tps *TopicIterator) Next() (*Topic, error) {
	topicName, err := tps.next()
	if err != nil {
		return nil, err
	}
	return newTopic(tps.s, topicName), nil
}

// ID returns the unique idenfier of the topic within its project.
func (t *Topic) ID() string {
	slash := strings.LastIndex(t.name, "/")
	if slash == -1 {
		// name is not a fully-qualified name.
		panic("bad topic name")
	}
	return t.name[slash+1:]
}

// String returns the printable globally unique name for the topic.
func (t *Topic) String() string {
	return t.name
}

// Delete deletes the topic.
func (t *Topic) Delete(ctx context.Context) error {
	return t.s.deleteTopic(ctx, t.name)
}

// Exists reports whether the topic exists on the server.
func (t *Topic) Exists(ctx context.Context) (bool, error) {
	if t.name == "_deleted-topic_" {
		return false, nil
	}

	return t.s.topicExists(ctx, t.name)
}

func (t *Topic) IAM() *iam.Handle {
	return t.s.iamHandle(t.name)
}

// Subscriptions returns an iterator which returns the subscriptions for this topic.
func (t *Topic) Subscriptions(ctx context.Context) *SubscriptionIterator {
	// NOTE: zero or more Subscriptions that are ultimately returned by this
	// Subscriptions iterator may belong to a different project to t.
	return &SubscriptionIterator{
		s:    t.s,
		next: t.s.listTopicSubscriptions(ctx, t.name),
	}
}

var errTopicStopped = errors.New("pubsub: Stop has been called for this topic")

// Publish publishes msg to the topic asynchronously. Messages are batched and
// sent according to the topic's PublishSettings. Publish never blocks.
//
// Publish returns a non-nil PublishResult which will be ready when the
// message has been sent (or has failed to be sent) to the server.
//
// Publish creates goroutines for batching and sending messages. These goroutines
// need to be stopped by calling t.Stop(). Once stopped, future calls to Publish
// will immediately return a PublishResult with an error.
func (t *Topic) Publish(ctx context.Context, msg *Message) *PublishResult {
	// TODO(jba): if this turns out to take significant time, try to approximate it.
	// Or, convert the messages to protos in Publish, instead of in the service.
	msg.size = proto.Size(&pb.PubsubMessage{
		Data:       msg.Data,
		Attributes: msg.Attributes,
	})
	r := &PublishResult{ready: make(chan struct{})}
	t.initBundler()
	t.mu.RLock()
	defer t.mu.RUnlock()
	// TODO(aboulhosn) [from bcmills] consider changing the semantics of bundler to perform this logic so we don't have to do it here
	if t.stopped {
		r.set("", errTopicStopped)
		return r
	}

	// TODO(jba) [from bcmills] consider using a shared channel per bundle
	// (requires Bundler API changes; would reduce allocations)
	// The call to Add should never return an error because the bundler's
	// BufferedByteLimit is set to maxInt; we do not perform any flow
	// control in the client.
	err := t.bundler.Add(&bundledMessage{msg, r}, msg.size)
	if err != nil {
		r.set("", err)
	}
	return r
}

// Send all remaining published messages and stop goroutines created for handling
// publishing. Returns once all outstanding messages have been sent or have
// failed to be sent.
func (t *Topic) Stop() {
	t.mu.Lock()
	noop := t.stopped || t.bundler == nil
	t.stopped = true
	t.mu.Unlock()
	if noop {
		return
	}
	t.bundler.Flush()
	// At this point, all pending bundles have been published and the bundler's
	// goroutines have exited, so it is OK for this goroutine to close bundlec.
	close(t.bundlec)
	t.wg.Wait()
}

// A PublishResult holds the result from a call to Publish.
type PublishResult struct {
	ready    chan struct{}
	serverID string
	err      error
}

// Ready returns a channel that is closed when the result is ready.
// When the Ready channel is closed, Get is guaranteed not to block.
func (r *PublishResult) Ready() <-chan struct{} { return r.ready }

// Get returns the server-generated message ID and/or error result of a Publish call.
// Get blocks until the Publish call completes or the context is done.
func (r *PublishResult) Get(ctx context.Context) (serverID string, err error) {
	// If the result is already ready, return it even if the context is done.
	select {
	case <-r.Ready():
		return r.serverID, r.err
	default:
	}
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-r.Ready():
		return r.serverID, r.err
	}
}

func (r *PublishResult) set(sid string, err error) {
	r.serverID = sid
	r.err = err
	close(r.ready)
}

type bundledMessage struct {
	msg *Message
	res *PublishResult
}

func (t *Topic) initBundler() {
	t.mu.RLock()
	noop := t.stopped || t.bundler != nil
	t.mu.RUnlock()
	if noop {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	// Must re-check, since we released the lock.
	if t.stopped || t.bundler != nil {
		return
	}

	// TODO(jba): use a context detached from the one passed to NewClient.
	ctx := context.TODO()
	// Unless overridden, run several goroutines per CPU to call the Publish RPC.
	n := t.PublishSettings.NumGoroutines
	if n <= 0 {
		n = 25 * runtime.GOMAXPROCS(0)
	}
	timeout := t.PublishSettings.Timeout
	t.wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer t.wg.Done()
			for b := range t.bundlec {
				bctx := ctx
				cancel := func() {}
				if timeout != 0 {
					bctx, cancel = context.WithTimeout(ctx, timeout)
				}
				t.publishMessageBundle(bctx, b)
				cancel()
			}
		}()
	}
	t.bundler = bundler.NewBundler(&bundledMessage{}, func(items interface{}) {
		t.bundlec <- items.([]*bundledMessage)

	})
	t.bundler.DelayThreshold = t.PublishSettings.DelayThreshold
	t.bundler.BundleCountThreshold = t.PublishSettings.CountThreshold
	if t.bundler.BundleCountThreshold > MaxPublishRequestCount {
		t.bundler.BundleCountThreshold = MaxPublishRequestCount
	}
	t.bundler.BundleByteThreshold = t.PublishSettings.ByteThreshold
	t.bundler.BufferedByteLimit = maxInt
	t.bundler.BundleByteLimit = MaxPublishRequestBytes
}

func (t *Topic) publishMessageBundle(ctx context.Context, bms []*bundledMessage) {
	msgs := make([]*Message, len(bms))
	for i, bm := range bms {
		msgs[i], bm.msg = bm.msg, nil // release bm.msg for GC
	}
	ids, err := t.s.publishMessages(ctx, t.name, msgs)
	for i, bm := range bms {
		if err != nil {
			bm.res.set("", err)
		} else {
			bm.res.set(ids[i], nil)
		}
	}
}
