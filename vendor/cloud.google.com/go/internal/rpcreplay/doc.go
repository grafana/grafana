// Copyright 2017 Google Inc. All Rights Reserved.
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
Package rpcreplay supports the capture and replay of gRPC calls. Its main goal is
to improve testing. Once one captures the calls of a test that runs against a real
service, one has an "automatic mock" that can be replayed against the same test,
yielding a unit test that is fast and flake-free.


Recording

To record a sequence of gRPC calls to a file, create a Recorder and pass its
DialOptions to grpc.Dial:

    rec, err := rpcreplay.NewRecorder("service.replay", nil)
    if err != nil { ... }
    defer func() {
        if err := rec.Close(); err != nil { ... }
    }()
    conn, err := grpc.Dial(serverAddress, rec.DialOptions()...)

It's essential to close the Recorder when the interaction is finished.

There is also a NewRecorderWriter function for capturing to an arbitrary
io.Writer.


Replaying

Replaying a captured file looks almost identical: create a Replayer and use
its DialOptions. (Since we're reading the file and not writing it, we don't
have to be as careful about the error returned from Close).

    rep, err := rpcreplay.NewReplayer("service.replay")
    if err != nil { ... }
    defer rep.Close()
    conn, err := grpc.Dial(serverAddress, rep.DialOptions()...)


Initial State

A test might use random or time-sensitive values, for instance to create unique
resources for isolation from other tests. The test therefore has initial values --
the current time, a random seed -- that differ from run to run. You must record this
initial state and re-establish it on replay.

To record the initial state, serialize it into a []byte and pass it as the second
argument to NewRecorder:

   timeNow := time.Now()
   b, err := timeNow.MarshalBinary()
   if err != nil { ... }
   rec, err := rpcreplay.NewRecorder("service.replay", b)

On replay, get the bytes from Replayer.Initial:

   rep, err := rpcreplay.NewReplayer("service.replay")
   if err != nil { ... }
   defer rep.Close()
   err = timeNow.UnmarshalBinary(rep.Initial())
   if err != nil { ... }


Nondeterminism

A nondeterministic program may invoke RPCs in a different order each time
it is run. The order in which RPCs are called during recording may differ
from the order during replay.

The replayer matches incoming to recorded requests by method name and request
contents, so nondeterminism is only a concern for identical requests that result
in different responses. A nondeterministic program whose behavior differs
depending on the order of such RPCs probably has a race condition: since both the
recorded sequence of RPCs and the sequence during replay are valid orderings, the
program should behave the same under both.


Other Replayer Differences

Besides the differences in replay mentioned above, other differences may cause issues
for some programs. We list them here.

The Replayer delivers a response to an RPC immediately, without waiting for other
incoming RPCs. This can violate causality. For example, in a Pub/Sub program where
one goroutine publishes and another subscribes, during replay the Subscribe call may
finish before the Publish call begins.

For streaming RPCs, the Replayer delivers the result of Send and Recv calls in
the order they were recorded. No attempt is made to match message contents.

At present, this package does not record or replay stream headers and trailers, or
the result of the CloseSend method.
*/
package rpcreplay // import "cloud.google.com/go/internal/rpcreplay"
