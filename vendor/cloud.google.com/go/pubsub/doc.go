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

/*
Package pubsub provides an easy way to publish and receive Google Cloud Pub/Sub
messages, hiding the the details of the underlying server RPCs.  Google Cloud
Pub/Sub is a many-to-many, asynchronous messaging system that decouples senders
and receivers.

Note: This package is in beta. Some backwards-incompatible changes may occur.

More information about Google Cloud Pub/Sub is available at
https://cloud.google.com/pubsub/docs

Publishing

Google Cloud Pub/Sub messages are published to topics. Topics may be created
using the pubsub package like so:

 topic, err := pubsubClient.CreateTopic(context.Background(), "topic-name")

Messages may then be published to a topic:

 res := topic.Publish(ctx, &pubsub.Message{Data: []byte("payload")})

Publish queues the message for publishing and returns immediately. When enough
messages have accumulated, or enough time has elapsed, the batch of messages is
sent to the Pub/Sub service.

Publish returns a PublishResult, which behaves like a future: its Get method
blocks until the message has been sent to the service.

The first time you call Publish on a topic, goroutines are started in the
background. To clean up these goroutines, call Stop:

  topic.Stop()

Receiving

To receive messages published to a topic, clients create subscriptions
to the topic. There may be more than one subscription per topic; each message
that is published to the topic will be delivered to all of its subscriptions.

Subsciptions may be created like so:

 sub, err := pubsubClient.CreateSubscription(context.Background(), "sub-name",
	pubsub.SubscriptionConfig{Topic: topic})

Messages are then consumed from a subscription via callback.

 err := sub.Receive(context.Background(), func(ctx context.Context, m *Message) {
 	log.Printf("Got message: %s", m.Data)
 	m.Ack()
 })
 if err != nil {
	// Handle error.
 }

The callback is invoked concurrently by multiple goroutines, maximizing
throughput. To terminate a call to Receive, cancel its context.

Once client code has processed the message, it must call Message.Ack, otherwise
the message will eventually be redelivered. As an optimization, if the client
cannot or doesn't want to process the message, it can call Message.Nack to
speed redelivery. For more information and configuration options, see
"Deadlines" below.

Note: It is possible for Messages to be redelivered, even if Message.Ack has
been called. Client code must be robust to multiple deliveries of messages.

Deadlines

The default pubsub deadlines are suitable for most use cases, but may be
overridden.  This section describes the tradeoffs that should be considered
when overriding the defaults.

Behind the scenes, each message returned by the Pub/Sub server has an
associated lease, known as an "ACK deadline".
Unless a message is acknowledged within the ACK deadline, or the client requests that
the ACK deadline be extended, the message will become elegible for redelivery.
As a convenience, the pubsub package will automatically extend deadlines until
either:
 * Message.Ack or Message.Nack is called, or
 * the "MaxExtension" period elapses from the time the message is fetched from the server.

The initial ACK deadline given to each messages defaults to 10 seconds, but may
be overridden during subscription creation.  Selecting an ACK deadline is a
tradeoff between message redelivery latency and RPC volume. If the pubsub
package fails to acknowledge or extend a message (e.g. due to unexpected
termination of the process), a shorter ACK deadline will generally result in
faster message redelivery by the Pub/Sub system. However, a short ACK deadline
may also increase the number of deadline extension RPCs that the pubsub package
sends to the server.

The default max extension period is DefaultReceiveSettings.MaxExtension, and can
be overridden by setting Subscription.ReceiveSettings.MaxExtension. Selecting a
max extension period is a tradeoff between the speed at which client code must
process messages, and the redelivery delay if messages fail to be acknowledged
(e.g. because client code neglects to do so). Using a large MaxExtension
increases the available time for client code to process messages. However, if
the client code neglects to call Message.Ack/Nack, a large MaxExtension will
increase the delay before the message is redelivered.

Authentication

See examples of authorization and authentication at
https://godoc.org/cloud.google.com/go#pkg-examples.
*/
package pubsub // import "cloud.google.com/go/pubsub"
