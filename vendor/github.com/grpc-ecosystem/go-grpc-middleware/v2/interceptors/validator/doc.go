// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

/*
Package validator

`validator` is a generic request contents validator server-side middleware for gRPC.

# Request Validator Middleware

Validating input is important, and hard. It also causes a lot of boilerplate code. This middleware
checks for the existence of a `Validate` method on each of the messages of a gRPC request. This
includes the single request of the `Unary` calls, as well as each message of the inbound Stream calls.
In case of a validation failure, an `InvalidArgument` gRPC status is returned, along with a
description of the validation failure.

While it is generic, it was intended to be used with https://github.com/mwitkow/go-proto-validators,
a Go protocol buffers codegen plugin that creates the `Validate` methods (including nested messages)
based on declarative options in the `.proto` files themselves. For example:

	syntax = "proto3";
	package validator.examples;
	import "github.com/mwitkow/go-proto-validators/validator.proto";

	message InnerMessage {
	  // some_integer can only be in range (1, 100).
	  int32 some_integer = 1 [(validator.field) = {int_gt: 0, int_lt: 100}];
	  // some_float can only be in range (0;1).
	  double some_float = 2 [(validator.field) = {float_gte: 0, float_lte: 1}];
	}

	message OuterMessage {
	  // important_string must be a lowercase alpha-numeric of 5 to 30 characters (RE2 syntax).
	  string important_string = 1 [(validator.field) = {regex: "^[a-z]{2,5}$"}];
	  // proto3 doesn't have `required`, the `msg_exist` enforces presence of InnerMessage.
	  InnerMessage inner = 2 [(validator.field) = {msg_exists : true}];
	}

The `OuterMessage.Validate` would include validation of regexes, existence of the InnerMessage and
the range values within it. The `grpc_validator` middleware would then automatically use that to
check all messages processed by the server.

Please consult https://github.com/mwitkow/go-proto-validators for details on `protoc` invocation and
other parameters of customization.
*/
package validator
