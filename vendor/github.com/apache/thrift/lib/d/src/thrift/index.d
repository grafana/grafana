Ddoc

<h2>Package overview</h2>

<dl>
  <dt>$(D_CODE thrift.async)</dt>
  <dd>Support infrastructure for handling client-side asynchronous operations using non-blocking I/O and coroutines.</dd>

  <dt>$(D_CODE thrift.codegen)</dt>
  <dd>
    <p>Templates used for generating Thrift clients/processors from regular D struct and interface definitions.</p>
    <p><strong>Note:</strong> Several artifacts in these modules have options for specifying the exact protocol types used. In this case, the amount of virtual calls can be greatly reduced and as a result, the code also can be optimized better. If performance is not a concern or the actual protocol type is not known at compile time, these parameters can just be left at their defaults.
    </p>
  </dd>

  <dt>$(D_CODE thrift.internal)</dt>
  <dd>Internal helper modules used by the Thrift library. This package is not part of the public API, and no stability guarantees are given whatsoever.</dd>

  <dt>$(D_CODE thrift.protocol)</dt>
  <dd>The Thrift protocol implemtations which specify how to pass messages over a TTransport.</dd>

  <dt>$(D_CODE thrift.server)</dt>
  <dd>Generic Thrift server implementations handling clients over a TTransport interface and forwarding requests to a TProcessor (which is in turn usually provided by thrift.codegen).</dd>

  <dt>$(D_CODE thrift.transport)</dt>
  <dd>The TTransport data source/sink interface used in the Thrift library and its imiplementations.</dd>

  <dt>$(D_CODE thrift.util)</dt>
  <dd>General-purpose utility modules not specific to Thrift, part of the public API.</dd>
</dl>

Macros:
  TITLE = Thrift D Software Library
