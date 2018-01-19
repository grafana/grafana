Thrift Remote Procedure Call
============================

<!--
--------------------------------------------------------------------

Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.

--------------------------------------------------------------------
-->

This document describes the high level message exchange between the Thrift RPC client and server.
See [thrift-binary-protocol.md] and [thrift-compact-protocol.md] for a description of how the exchanges are encoded on
the wire.

In addition, this document compares the binary protocol with the compact protocol. Finally it describes the framed vs.
unframed transport.

The information here is _mostly_ based on the Java implementation in the Apache thrift library (version 0.9.1 and
0.9.3). Other implementation however, should behave the same.

For background on Thrift see the [Thrift whitepaper (pdf)](https://thrift.apache.org/static/files/thrift-20070401.pdf).

# Contents

* Thrift Message exchange for Remote Procedure Call
  * Message
  * Request struct
  * Response struct
* Protocol considerations
  * Comparing binary and compact protocol
  * Compatibility
  * Framed vs unframed transport

# Thrift Remote Procedure Call Message exchange

Both the binary protocol and the compact protocol assume a transport layer that exposes a bi-directional byte stream,
for example a TCP socket. Both use the following exchange:

1. Client sends a `Message` (type `Call` or `Oneway`). The TMessage contains some metadata and the name of the method
   to invoke.
2. Client sends method arguments (a struct defined by the generate code).
3. Server sends a `Message` (type `Reply` or `Exception`) to start the response.
4. Server sends a struct containing the method result or exception.

The pattern is a simple half duplex protocol where the parties alternate in sending a `Message` followed by a struct.
What these are is described below.

Although the standard Apache Thrift Java clients do not support pipelining (sending multiple requests without waiting
for an response), the standard Apache Thrift Java servers do support it.

## Message

A *Message* contains:

* _Name_, a string (can be empty).
* _Message type_, a message types, one of `Call`, `Reply`, `Exception` and `Oneway`.
* _Sequence id_, a signed int32 integer.

The *sequence id* is a simple message id assigned by the client. The server will use the same sequence id in the
message of the response. The client uses this number to detect out of order responses. Each client has an int32 field
which is increased for each message. The sequence id simply wraps around when it overflows.

The *name* indicates the service method name to invoke. The server copies the name in the response message.

When the *multiplexed protocol* is used, the name contains the service name, a colon `:` and the method name. The
multiplexed protocol is not compatible with other protocols.

The *message type* indicates what kind of message is sent. Clients send requests with TMessages of type `Call` or
`Oneway` (step 1 in the protocol exchange). Servers send responses with messages of type `Exception` or `Reply` (step
3).

Type `Reply` is used when the service method completes normally. That is, it returns a value or it throws one of the
exceptions defined in the Thrift IDL file.

Type `Exception` is used for other exceptions. That is: when the service method throws an exception that is not declared
in the Thrift IDL file, or some other part of the Thrift stack throws an exception. For example when the server could
not encode or decode a message or struct.

In the Java implementation (0.9.3) there is different behavior for the synchronous and asynchronous server. In the async
server all exceptions are send as a `TApplicationException` (see 'Response struct' below). In the synchronous Java
implementation only (undeclared) exceptions that extend `TException` are send as a `TApplicationException`. Unchecked
exceptions lead to an immediate close of the connection.

Type `Oneway` is only used starting from Apache Thrift 0.9.3. Earlier versions do _not_ send TMessages of type `Oneway`,
even for service methods defined with the `oneway` modifier.

When client sends a request with type `Oneway`, the server must _not_ send a response (steps 3 and 4 are skipped). Note
that the Thrift IDL enforces a return type of `void` and does not allow exceptions for oneway services.

## Request struct

The struct that follows the message of type `Call` or `Oneway` contains the arguments of the service method. The
argument ids correspond to the field ids. The name of the struct is the name of the method with `_args` appended.
For methods without arguments an struct is sent without fields.

## Response struct

The struct that follows the message of type `Reply` are structs in which exactly 1 of the following fields is encoded:

* A field with name `success` and id `0`, used in case the method completed normally.
* An exception field, name and id are as defined in the `throws` clause in the Thrift IDL's service method definition.

When the message is of type `Exception` the struct is encoded as if it was declared by the following IDL:

```
exception TApplicationException {
  1: string message,
  2: i32 type
}
```

The following exception types are defined in the java implementation (0.9.3):

* _unknown_: 0, used in case the type from the peer is unknown.
* _unknown method_: 1, used in case the method requested by the client is unknown by the server.
* _invalid message type_: 2, no usage was found.
* _wrong method name_: 3, no usage was found.
* _bad sequence id_: 4, used internally by the client to indicate a wrong sequence id in the response.
* _missing result_: 5, used internally by the client to indicate a response without any field (result nor exception).
* _internal error_: 6, used when the server throws an exception that is not declared in the Thrift IDL file. 
* _protocol error_: 7, used when something goes wrong during decoding. For example when a list is too long or a required
 field is missing. 
* _invalid transform_: 8, no usage was found.
* _invalid protocol_: 9, no usage was found.
* _unsupported client type_: 10, no usage was found.

# Protocol considerations

## Comparing binary and compact protocol

The binary protocol is fairly simple and therefore easy to process. The compact protocol needs less bytes to send the
same data at the cost of additional processing. As bandwidth is usually the bottleneck, the compact protocol is almost
always slightly faster.

## Compatibility

A server could automatically determine whether a client talks the binary protocol or the compact protocol by
investigating the first byte. If the value is `1000 0001` or `0000 0000` (assuming a name shorter then ±16 MB) it is the
binary protocol. When the value is `1000 0010` it is talking the compact protocol.

## Framed vs. unframed transport

The first thrift binary wire format was unframed. This means that information is sent out in a single stream of bytes.
With unframed transport the (generated) processors will read directly from the socket (though Apache Thrift does try to
grab all available bytes from the socket in a buffer when it can).

Later, Thrift introduced the framed transport.

With framed transport the full request and response (the TMessage and the following struct) are first written to a
buffer. Then when the struct is complete (transport method `flush` is hijacked for this), the length of the buffer is
written to the socket first, followed by the buffered bytes. The combination is called a _frame_. On the receiver side
the complete frame is first read in a buffer before the message is passed to a processor.

The length prefix is a 4 byte signed int, send in network (big endian) order.
The following must be true: `0` <= length <= `16384000` (16M).

Framed transport was introduced to ease the implementation of async processors. An async processor is only invoked when
all data is received. Unfortunately, framed transport is not ideal for large messages as the entire frame stays in
memory until the message has been processed. In addition, the java implementation merges the incoming data to a single,
growing byte array. Every time the byte array is full it needs to be copied to a new larger byte array.

Framed and unframed transports are not compatible with each other.
