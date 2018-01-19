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
	"io"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/iam"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
)

// Subscription is a reference to a PubSub subscription.
type Subscription struct {
	s service

	// The fully qualified identifier for the subscription, in the format "projects/<projid>/subscriptions/<name>"
	name string

	// Settings for pulling messages. Configure these before calling Receive.
	ReceiveSettings ReceiveSettings

	mu            sync.Mutex
	receiveActive bool
}

// Subscription creates a reference to a subscription.
func (c *Client) Subscription(id string) *Subscription {
	return newSubscription(c.s, fmt.Sprintf("projects/%s/subscriptions/%s", c.projectID, id))
}

func newSubscription(s service, name string) *Subscription {
	return &Subscription{
		s:    s,
		name: name,
	}
}

// String returns the globally unique printable name of the subscription.
func (s *Subscription) String() string {
	return s.name
}

// ID returns the unique identifier of the subscription within its project.
func (s *Subscription) ID() string {
	slash := strings.LastIndex(s.name, "/")
	if slash == -1 {
		// name is not a fully-qualified name.
		panic("bad subscription name")
	}
	return s.name[slash+1:]
}

// Subscriptions returns an iterator which returns all of the subscriptions for the client's project.
func (c *Client) Subscriptions(ctx context.Context) *SubscriptionIterator {
	return &SubscriptionIterator{
		s:    c.s,
		next: c.s.listProjectSubscriptions(ctx, c.fullyQualifiedProjectName()),
	}
}

// SubscriptionIterator is an iterator that returns a series of subscriptions.
type SubscriptionIterator struct {
	s    service
	next nextStringFunc
}

// Next returns the next subscription. If there are no more subscriptions, iterator.Done will be returned.
func (subs *SubscriptionIterator) Next() (*Subscription, error) {
	subName, err := subs.next()
	if err != nil {
		return nil, err
	}
	return newSubscription(subs.s, subName), nil
}

// PushConfig contains configuration for subscriptions that operate in push mode.
type PushConfig struct {
	// A URL locating the endpoint to which messages should be pushed.
	Endpoint string

	// Endpoint configuration attributes. See https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions#pushconfig for more details.
	Attributes map[string]string
}

// Subscription config contains the configuration of a subscription.
type SubscriptionConfig struct {
	Topic      *Topic
	PushConfig PushConfig

	// The default maximum time after a subscriber receives a message before
	// the subscriber should acknowledge the message. Note: messages which are
	// obtained via Subscription.Receive need not be acknowledged within this
	// deadline, as the deadline will be automatically extended.
	AckDeadline time.Duration

	// Whether to retain acknowledged messages. If true, acknowledged messages
	// will not be expunged until they fall out of the RetentionDuration window.
	retainAckedMessages bool

	// How long to retain messages in backlog, from the time of publish. If RetainAckedMessages is true,
	// this duration affects the retention of acknowledged messages,
	// otherwise only unacknowledged messages are retained.
	// Defaults to 7 days. Cannot be longer than 7 days or shorter than 10 minutes.
	retentionDuration time.Duration
}

// ReceiveSettings configure the Receive method.
// A zero ReceiveSettings will result in values equivalent to DefaultReceiveSettings.
type ReceiveSettings struct {
	// MaxExtension is the maximum period for which the Subscription should
	// automatically extend the ack deadline for each message.
	//
	// The Subscription will automatically extend the ack deadline of all
	// fetched Messages for the duration specified. Automatic deadline
	// extension may be disabled by specifying a duration less than 1.
	MaxExtension time.Duration

	// MaxOutstandingMessages is the maximum number of unprocessed messages
	// (unacknowledged but not yet expired). If MaxOutstandingMessages is 0, it
	// will be treated as if it were DefaultReceiveSettings.MaxOutstandingMessages.
	// If the value is negative, then there will be no limit on the number of
	// unprocessed messages.
	MaxOutstandingMessages int

	// MaxOutstandingBytes is the maximum size of unprocessed messages
	// (unacknowledged but not yet expired). If MaxOutstandingBytes is 0, it will
	// be treated as if it were DefaultReceiveSettings.MaxOutstandingBytes. If
	// the value is negative, then there will be no limit on the number of bytes
	// for unprocessed messages.
	MaxOutstandingBytes int

	// NumGoroutines is the number of goroutines Receive will spawn to pull
	// messages concurrently. If NumGoroutines is less than 1, it will be treated
	// as if it were DefaultReceiveSettings.NumGoroutines.
	//
	// NumGoroutines does not limit the number of messages that can be processed
	// concurrently. Even with one goroutine, many messages might be processed at
	// once, because that goroutine may continually receive messages and invoke the
	// function passed to Receive on them. To limit the number of messages being
	// processed concurrently, set MaxOutstandingMessages.
	NumGoroutines int
}

// DefaultReceiveSettings holds the default values for ReceiveSettings.
var DefaultReceiveSettings = ReceiveSettings{
	MaxExtension:           10 * time.Minute,
	MaxOutstandingMessages: 1000,
	MaxOutstandingBytes:    1e9, // 1G
	NumGoroutines:          1,
}

// Delete deletes the subscription.
func (s *Subscription) Delete(ctx context.Context) error {
	return s.s.deleteSubscription(ctx, s.name)
}

// Exists reports whether the subscription exists on the server.
func (s *Subscription) Exists(ctx context.Context) (bool, error) {
	return s.s.subscriptionExists(ctx, s.name)
}

// Config fetches the current configuration for the subscription.
func (s *Subscription) Config(ctx context.Context) (SubscriptionConfig, error) {
	conf, topicName, err := s.s.getSubscriptionConfig(ctx, s.name)
	if err != nil {
		return SubscriptionConfig{}, err
	}
	conf.Topic = &Topic{
		s:    s.s,
		name: topicName,
	}
	return conf, nil
}

// SubscriptionConfigToUpdate describes how to update a subscription.
type SubscriptionConfigToUpdate struct {
	// If non-nil, the push config is changed.
	PushConfig *PushConfig
}

// Update changes an existing subscription according to the fields set in cfg.
// It returns the new SubscriptionConfig.
//
// Update returns an error if no fields were modified.
func (s *Subscription) Update(ctx context.Context, cfg SubscriptionConfigToUpdate) (SubscriptionConfig, error) {
	if cfg.PushConfig == nil {
		return SubscriptionConfig{}, errors.New("pubsub: UpdateSubscription call with nothing to update")
	}
	if err := s.s.modifyPushConfig(ctx, s.name, *cfg.PushConfig); err != nil {
		return SubscriptionConfig{}, err
	}
	return s.Config(ctx)
}

func (s *Subscription) IAM() *iam.Handle {
	return s.s.iamHandle(s.name)
}

// CreateSubscription creates a new subscription on a topic.
//
// id is the name of the subscription to create. It must start with a letter,
// and contain only letters ([A-Za-z]), numbers ([0-9]), dashes (-),
// underscores (_), periods (.), tildes (~), plus (+) or percent signs (%). It
// must be between 3 and 255 characters in length, and must not start with
// "goog".
//
// cfg.Topic is the topic from which the subscription should receive messages. It
// need not belong to the same project as the subscription. This field is required.
//
// cfg.AckDeadline is the maximum time after a subscriber receives a message before
// the subscriber should acknowledge the message. It must be between 10 and 600
// seconds (inclusive), and is rounded down to the nearest second. If the
// provided ackDeadline is 0, then the default value of 10 seconds is used.
// Note: messages which are obtained via Subscription.Receive need not be
// acknowledged within this deadline, as the deadline will be automatically
// extended.
//
// cfg.PushConfig may be set to configure this subscription for push delivery.
//
// If the subscription already exists an error will be returned.
func (c *Client) CreateSubscription(ctx context.Context, id string, cfg SubscriptionConfig) (*Subscription, error) {
	if cfg.Topic == nil {
		return nil, errors.New("pubsub: require non-nil Topic")
	}
	if cfg.AckDeadline == 0 {
		cfg.AckDeadline = 10 * time.Second
	}
	if d := cfg.AckDeadline; d < 10*time.Second || d > 600*time.Second {
		return nil, fmt.Errorf("ack deadline must be between 10 and 600 seconds; got: %v", d)
	}

	sub := c.Subscription(id)
	err := c.s.createSubscription(ctx, sub.name, cfg)
	return sub, err
}

var errReceiveInProgress = errors.New("pubsub: Receive already in progress for this subscription")

// Receive calls f with the outstanding messages from the subscription.
// It blocks until ctx is done, or the service returns a non-retryable error.
//
// The standard way to terminate a Receive is to cancel its context:
//
//   cctx, cancel := context.WithCancel(ctx)
//   err := sub.Receive(cctx, callback)
//   // Call cancel from callback, or another goroutine.
//
// If the service returns a non-retryable error, Receive returns that error after
// all of the outstanding calls to f have returned. If ctx is done, Receive
// returns nil after all of the outstanding calls to f have returned and
// all messages have been acknowledged or have expired.
//
// Receive calls f concurrently from multiple goroutines. It is encouraged to
// process messages synchronously in f, even if that processing is relatively
// time-consuming; Receive will spawn new goroutines for incoming messages,
// limited by MaxOutstandingMessages and MaxOutstandingBytes in ReceiveSettings.
//
// The context passed to f will be canceled when ctx is Done or there is a
// fatal service error.
//
// Receive will automatically extend the ack deadline of all fetched Messages for the
// period specified by s.ReceiveSettings.MaxExtension.
//
// Each Subscription may have only one invocation of Receive active at a time.
func (s *Subscription) Receive(ctx context.Context, f func(context.Context, *Message)) error {
	s.mu.Lock()
	if s.receiveActive {
		s.mu.Unlock()
		return errReceiveInProgress
	}
	s.receiveActive = true
	s.mu.Unlock()
	defer func() { s.mu.Lock(); s.receiveActive = false; s.mu.Unlock() }()

	config, err := s.Config(ctx)
	if err != nil {
		if grpc.Code(err) == codes.Canceled {
			return nil
		}
		return err
	}
	maxCount := s.ReceiveSettings.MaxOutstandingMessages
	if maxCount == 0 {
		maxCount = DefaultReceiveSettings.MaxOutstandingMessages
	}
	maxBytes := s.ReceiveSettings.MaxOutstandingBytes
	if maxBytes == 0 {
		maxBytes = DefaultReceiveSettings.MaxOutstandingBytes
	}
	maxExt := s.ReceiveSettings.MaxExtension
	if maxExt == 0 {
		maxExt = DefaultReceiveSettings.MaxExtension
	} else if maxExt < 0 {
		// If MaxExtension is negative, disable automatic extension.
		maxExt = 0
	}
	numGoroutines := s.ReceiveSettings.NumGoroutines
	if numGoroutines < 1 {
		numGoroutines = DefaultReceiveSettings.NumGoroutines
	}
	// TODO(jba): add tests that verify that ReceiveSettings are correctly processed.
	po := &pullOptions{
		maxExtension: maxExt,
		maxPrefetch:  trunc32(int64(maxCount)),
		ackDeadline:  config.AckDeadline,
	}
	fc := newFlowController(maxCount, maxBytes)

	// Wait for all goroutines started by Receive to return, so instead of an
	// obscure goroutine leak we have an obvious blocked call to Receive.
	group, gctx := errgroup.WithContext(ctx)
	for i := 0; i < numGoroutines; i++ {
		group.Go(func() error {
			return s.receive(gctx, po, fc, f)
		})
	}
	return group.Wait()
}

func (s *Subscription) receive(ctx context.Context, po *pullOptions, fc *flowController, f func(context.Context, *Message)) error {
	// Cancel a sub-context when we return, to kick the context-aware callbacks
	// and the goroutine below.
	ctx2, cancel := context.WithCancel(ctx)
	// Call stop when Receive's context is done.
	// Stop will block until all outstanding messages have been acknowledged
	// or there was a fatal service error.
	// The iterator does not use the context passed to Receive. If it did, canceling
	// that context would immediately stop the iterator without waiting for unacked
	// messages.
	iter := newMessageIterator(context.Background(), s.s, s.name, po)

	// We cannot use errgroup from Receive here. Receive might already be calling group.Wait,
	// and group.Wait cannot be called concurrently with group.Go. We give each receive() its
	// own WaitGroup instead.
	// Since wg.Add is only called from the main goroutine, wg.Wait is guaranteed
	// to be called after all Adds.
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		<-ctx2.Done()
		iter.stop()
		wg.Done()
	}()
	defer wg.Wait()

	defer cancel()
	for {
		msgs, err := iter.receive()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		for i, msg := range msgs {
			msg := msg
			// TODO(jba): call acquire closer to when the message is allocated.
			if err := fc.acquire(ctx, len(msg.Data)); err != nil {
				// TODO(jba): test that these "orphaned" messages are nacked immediately when ctx is done.
				for _, m := range msgs[i:] {
					m.Nack()
				}
				return nil
			}
			wg.Add(1)
			go func() {
				// TODO(jba): call release when the message is available for GC.
				// This considers the message to be released when
				// f is finished, but f may ack early or not at all.
				defer wg.Done()
				defer fc.release(len(msg.Data))
				f(ctx2, msg)
			}()
		}
	}
}

// TODO(jba): remove when we delete messageIterator.
type pullOptions struct {
	maxExtension time.Duration
	maxPrefetch  int32
	// ackDeadline is the default ack deadline for the subscription. Not
	// configurable.
	ackDeadline time.Duration
}
