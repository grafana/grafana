/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
module thrift.transport.piped;

import thrift.transport.base;
import thrift.transport.memory;

/**
 * Pipes data request from one transport to another when readEnd()
 * or writeEnd() is called.
 *
 * A typical use case would be to log requests on e.g. a socket to
 * disk (i. e. pipe them to a TFileWriterTransport).
 *
 * The implementation keeps an internal buffer which expands to
 * hold the whole amount of data read/written until the corresponding *End()
 * method is called.
 *
 * Contrary to the C++ implementation, this doesn't introduce yet another layer
 * of input/output buffering, all calls are passed to the underlying source
 * transport verbatim.
 */
final class TPipedTransport(Source = TTransport) if (
  isTTransport!Source
) : TBaseTransport {
  /// The default initial buffer size if not explicitly specified, in bytes.
  enum DEFAULT_INITIAL_BUFFER_SIZE = 512;

  /**
   * Constructs a new instance.
   *
   * By default, only reads are piped (pipeReads = true, pipeWrites = false).
   *
   * Params:
   *   srcTrans = The transport to which all requests are forwarded.
   *   dstTrans = The transport the read/written data is copied to.
   *   initialBufferSize = The default size of the read/write buffers, for
   *     performance tuning.
   */
  this(Source srcTrans, TTransport dstTrans,
    size_t initialBufferSize = DEFAULT_INITIAL_BUFFER_SIZE
  ) {
    srcTrans_ = srcTrans;
    dstTrans_ = dstTrans;

    readBuffer_ = new TMemoryBuffer(initialBufferSize);
    writeBuffer_ = new TMemoryBuffer(initialBufferSize);

    pipeReads_ = true;
    pipeWrites_ = false;
  }

  bool pipeReads() @property const {
    return pipeReads_;
  }

  void pipeReads(bool value) @property {
    if (!value) {
      readBuffer_.reset();
    }
    pipeReads_ = value;
  }

  bool pipeWrites() @property const {
    return pipeWrites_;
  }

  void pipeWrites(bool value) @property {
    if (!value) {
      writeBuffer_.reset();
    }
    pipeWrites_ = value;
  }

  override bool isOpen() {
    return srcTrans_.isOpen();
  }

  override bool peek() {
    return srcTrans_.peek();
  }

  override void open() {
    srcTrans_.open();
  }

  override void close() {
    srcTrans_.close();
  }

  override size_t read(ubyte[] buf) {
    auto bytesRead = srcTrans_.read(buf);

    if (pipeReads_) {
      readBuffer_.write(buf[0 .. bytesRead]);
    }

    return bytesRead;
  }

  override size_t readEnd() {
    if (pipeReads_) {
      auto data = readBuffer_.getContents();
      dstTrans_.write(data);
      dstTrans_.flush();
      readBuffer_.reset();

      srcTrans_.readEnd();

      // Return data.length instead of the readEnd() result of the source
      // transports because it might not be available from it.
      return data.length;
    }

    return srcTrans_.readEnd();
  }

  override void write(in ubyte[] buf) {
    if (pipeWrites_) {
      writeBuffer_.write(buf);
    }

    srcTrans_.write(buf);
  }

  override size_t writeEnd() {
    if (pipeWrites_) {
      auto data = writeBuffer_.getContents();
      dstTrans_.write(data);
      dstTrans_.flush();
      writeBuffer_.reset();

      srcTrans_.writeEnd();

      // Return data.length instead of the readEnd() result of the source
      // transports because it might not be available from it.
      return data.length;
    }

    return srcTrans_.writeEnd();
  }

  override void flush() {
    srcTrans_.flush();
  }

private:
  Source srcTrans_;
  TTransport dstTrans_;

  TMemoryBuffer readBuffer_;
  TMemoryBuffer writeBuffer_;

  bool pipeReads_;
  bool pipeWrites_;
}

/**
 * TPipedTransport construction helper to avoid having to explicitly
 * specify the transport types, i.e. to allow the constructor being called
 * using IFTI (see $(DMDBUG 6082, D Bugzilla enhancement request 6082)).
 */
TPipedTransport!Source tPipedTransport(Source)(
  Source srcTrans, TTransport dstTrans
) if (isTTransport!Source) {
  return new typeof(return)(srcTrans, dstTrans);
}

version (unittest) {
  // DMD @@BUG@@: UFCS for std.array.empty doesn't work when import is moved
  // into unittest block.
  import std.array;
  import std.exception : enforce;
}

unittest {
  auto underlying = new TMemoryBuffer;
  auto pipeTarget = new TMemoryBuffer;
  auto trans = tPipedTransport(underlying, pipeTarget);

  underlying.write(cast(ubyte[])"abcd");

  ubyte[4] buffer;
  trans.readAll(buffer[0 .. 2]);
  enforce(buffer[0 .. 2] == "ab");
  enforce(pipeTarget.getContents().empty);

  trans.readEnd();
  enforce(pipeTarget.getContents() == "ab");
  pipeTarget.reset();

  underlying.write(cast(ubyte[])"ef");
  trans.readAll(buffer[0 .. 2]);
  enforce(buffer[0 .. 2] == "cd");
  enforce(pipeTarget.getContents().empty);

  trans.readAll(buffer[0 .. 2]);
  enforce(buffer[0 .. 2] == "ef");
  enforce(pipeTarget.getContents().empty);

  trans.readEnd();
  enforce(pipeTarget.getContents() == "cdef");
}
