This directory contains some glue code to allow Thrift RPCs to be sent over
ZeroMQ.  Included are client and server implementations for Python and C++,
along with a simple demo interface (with a working client and server for
each language).

Thrift was designed for stream-based interfaces like TCP, but ZeroMQ is
message-based, so there is a small impedance mismatch.  Most of issues are
hidden from developers, but one cannot be: oneway methods have to be handled
differently from normal ones.  ZeroMQ requires the messaging pattern to be
declared at socket creation time, so an application cannot decide on a
message-by-message basis whether to send a reply.  Therefore, this
implementation makes it the client's responsibility to ensure that ZMQ_REQ
sockets are used for normal methods and ZMQ_DOWNSTREAM sockets are used for
oneway methods.  In addition, services that expose both types of methods
have to expose two servers (on two ports), but the TZmqMultiServer makes it
easy to run the two together in the same thread.

This code was tested with ZeroMQ 2.0.7 and pyzmq afabbb5b9bd3.

To build, simply install Thrift and ZeroMQ, then run "make".  If you install
in a non-standard location, make sure to set THRIFT to the location of the
Thrift code generator on the make command line and PKG_CONFIG_PATH to a path
that includes the pkgconfig files for both Thrift and ZeroMQ.  The test
servers take no arguments.  Run the test clients with no arguments to
retrieve the stored value or with an integer argument to increment it by
that amount.

This code is not quite what I would consider production-ready.  It doesn't
support all of the normal hooks into Thrift, and its performance is
sub-optimal because it does some unnecessary copying.
