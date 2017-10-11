// Copyright (c) 2012, Sean Treadway, SoundCloud Ltd.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Source code and contact info at http://github.com/streadway/amqp

/*
AMQP 0.9.1 client with RabbitMQ extensions

Understand the AMQP 0.9.1 messaging model by reviewing these links first. Much
of the terminology in this library directly relates to AMQP concepts.

  Resources

  http://www.rabbitmq.com/tutorials/amqp-concepts.html
  http://www.rabbitmq.com/getstarted.html
  http://www.rabbitmq.com/amqp-0-9-1-reference.html

Design

Most other broker clients publish to queues, but in AMQP, clients publish
Exchanges instead.  AMQP is programmable, meaning that both the producers and
consumers agree on the configuration of the broker, instead requiring an
operator or system configuration that declares the logical topology in the
broker.  The routing between producers and consumer queues is via Bindings.
These bindings form the logical topology of the broker.

In this library, a message sent from publisher is called a "Publishing" and a
message received to a consumer is called a "Delivery".  The fields of
Publishings and Deliveries are close but not exact mappings to the underlying
wire format to maintain stronger types.  Many other libraries will combine
message properties with message headers.  In this library, the message well
known properties are strongly typed fields on the Publishings and Deliveries,
whereas the user defined headers are in the Headers field.

The method naming closely matches the protocol's method name with positional
parameters mapping to named protocol message fields.  The motivation here is to
present a comprehensive view over all possible interactions with the server.

Generally, methods that map to protocol methods of the "basic" class will be
elided in this interface, and "select" methods of various channel mode selectors
will be elided for example Channel.Confirm and Channel.Tx.

The library is intentionally designed to be synchronous, where responses for
each protocol message are required to be received in an RPC manner.  Some
methods have a noWait parameter like Channel.QueueDeclare, and some methods are
asynchronous like Channel.Publish.  The error values should still be checked for
these methods as they will indicate IO failures like when the underlying
connection closes.

Asynchronous Events

Clients of this library may be interested in receiving some of the protocol
messages other than Deliveries like basic.ack methods while a channel is in
confirm mode.

The Notify* methods with Connection and Channel receivers model the pattern of
asynchronous events like closes due to exceptions, or messages that are sent out
of band from an RPC call like basic.ack or basic.flow.

Any asynchronous events, including Deliveries and Publishings must always have
a receiver until the corresponding chans are closed.  Without asynchronous
receivers, the sychronous methods will block.

Use Case

It's important as a client to an AMQP topology to ensure the state of the
broker matches your expectations.  For both publish and consume use cases,
make sure you declare the queues, exchanges and bindings you expect to exist
prior to calling Channel.Publish or Channel.Consume.

  // Connections start with amqp.Dial() typically from a command line argument
  // or environment variable.
  connection, err := amqp.Dial(os.Getenv("AMQP_URL"))

  // To cleanly shutdown by flushing kernel buffers, make sure to close and
  // wait for the response.
  defer connection.Close()

  // Most operations happen on a channel.  If any error is returned on a
  // channel, the channel will no longer be valid, throw it away and try with
  // a different channel.  If you use many channels, it's useful for the
  // server to
  channel, err := connection.Channel()

  // Declare your topology here, if it doesn't exist, it will be created, if
  // it existed already and is not what you expect, then that's considered an
  // error.

  // Use your connection on this topology with either Publish or Consume, or
  // inspect your queues with QueueInspect.  It's unwise to mix Publish and
  // Consume to let TCP do its job well.

SSL/TLS - Secure connections

When Dial encounters an amqps:// scheme, it will use the zero value of a
tls.Config.  This will only perform server certificate and host verification.

Use DialTLS when you wish to provide a client certificate (recommended),
include a private certificate authority's certificate in the cert chain for
server validity, or run insecure by not verifying the server certificate dial
your own connection.  DialTLS will use the provided tls.Config when it
encounters an amqps:// scheme and will dial a plain connection when it
encounters an amqp:// scheme.

SSL/TLS in RabbitMQ is documented here: http://www.rabbitmq.com/ssl.html

*/
package amqp
