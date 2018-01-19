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
module thrift.transport.buffered;

import std.algorithm : min;
import std.array : empty;
import std.exception : enforce;
import thrift.transport.base;

/**
 * Wraps another transport and buffers reads and writes until the internal
 * buffers are exhausted, at which point new data is fetched resp. the
 * accumulated data is written out at once.
 */
final class TBufferedTransport : TBaseTransport {
  /**
   * Constructs a new instance, using the default buffer sizes.
   *
   * Params:
   *   transport = The underlying transport to wrap.
   */
  this(TTransport transport) {
    this(transport, DEFAULT_BUFFER_SIZE);
  }

  /**
   * Constructs a new instance, using the specified buffer size.
   *
   * Params:
   *   transport = The underlying transport to wrap.
   *   bufferSize = The size of the read and write buffers to use, in bytes.
   */
  this(TTransport transport, size_t bufferSize) {
    this(transport, bufferSize, bufferSize);
  }

  /**
   * Constructs a new instance, using the specified buffer size.
   *
   * Params:
   *   transport = The underlying transport to wrap.
   *   readBufferSize = The size of the read buffer to use, in bytes.
   *   writeBufferSize = The size of the write buffer to use, in bytes.
   */
  this(TTransport transport, size_t readBufferSize, size_t writeBufferSize) {
    transport_ = transport;
    readBuffer_ = new ubyte[readBufferSize];
    writeBuffer_ = new ubyte[writeBufferSize];
    writeAvail_ = writeBuffer_;
  }

  /// The default size of the read/write buffers, in bytes.
  enum int DEFAULT_BUFFER_SIZE = 512;

  override bool isOpen() @property {
    return transport_.isOpen();
  }

  override bool peek() {
    if (readAvail_.empty) {
      // If there is nothing available to read, see if we can get something
      // from the underlying transport.
      auto bytesRead = transport_.read(readBuffer_);
      readAvail_ = readBuffer_[0 .. bytesRead];
    }

    return !readAvail_.empty;
  }

  override void open() {
    transport_.open();
  }

  override void close() {
    if (!isOpen) return;
    flush();
    transport_.close();
  }

  override size_t read(ubyte[] buf) {
    if (readAvail_.empty) {
      // No data left in our buffer, fetch some from the underlying transport.

      if (buf.length > readBuffer_.length) {
        // If the amount of data requested is larger than our reading buffer,
        // directly read to the passed buffer. This probably doesn't occur too
        // often in practice (and even if it does, the underlying transport
        // probably cannot fulfill the request at once anyway), but it can't
        // harm to try…
        return transport_.read(buf);
      }

      auto bytesRead = transport_.read(readBuffer_);
      readAvail_ = readBuffer_[0 .. bytesRead];
    }

    // Hand over whatever we have.
    auto give = min(readAvail_.length, buf.length);
    buf[0 .. give] = readAvail_[0 .. give];
    readAvail_ = readAvail_[give .. $];
    return give;
  }

  /**
   * Shortcut version of readAll.
   */
  override void readAll(ubyte[] buf) {
    if (readAvail_.length >= buf.length) {
      buf[] = readAvail_[0 .. buf.length];
      readAvail_ = readAvail_[buf.length .. $];
      return;
    }

    super.readAll(buf);
  }

  override void write(in ubyte[] buf) {
    if (writeAvail_.length >= buf.length) {
      // If the data fits in the buffer, just save it there.
      writeAvail_[0 .. buf.length] = buf;
      writeAvail_ = writeAvail_[buf.length .. $];
      return;
    }

    // We have to decide if we copy data from buf to our internal buffer, or
    // just directly write them out. The same considerations about avoiding
    // syscalls as for C++ apply here.
    auto bytesAvail = writeAvail_.ptr - writeBuffer_.ptr;
    if ((bytesAvail + buf.length >= 2 * writeBuffer_.length) || (bytesAvail == 0)) {
      // We would immediately need two syscalls anyway (or we don't have
      // anything) in our buffer to write, so just write out both buffers.
      if (bytesAvail > 0) {
        transport_.write(writeBuffer_[0 .. bytesAvail]);
        writeAvail_ = writeBuffer_;
      }

      transport_.write(buf);
      return;
    }

    // Fill up our internal buffer for a write.
    writeAvail_[] = buf[0 .. writeAvail_.length];
    auto left = buf[writeAvail_.length .. $];
    transport_.write(writeBuffer_);

    // Copy the rest into our buffer.
    writeBuffer_[0 .. left.length] = left[];
    writeAvail_ = writeBuffer_[left.length .. $];
  }

  override void flush() {
    // Write out any data waiting in the write buffer.
    auto bytesAvail = writeAvail_.ptr - writeBuffer_.ptr;
    if (bytesAvail > 0) {
      // Note that we reset writeAvail_ prior to calling the underlying protocol
      // to make sure the buffer is cleared even if the transport throws an
      // exception.
      writeAvail_ = writeBuffer_;
      transport_.write(writeBuffer_[0 .. bytesAvail]);
    }

    // Flush the underlying transport.
    transport_.flush();
  }

  override const(ubyte)[] borrow(ubyte* buf, size_t len) {
    if (len <= readAvail_.length) {
      return readAvail_;
    }
    return null;
  }

  override void consume(size_t len) {
    enforce(len <= readBuffer_.length, new TTransportException(
      "Invalid consume length.", TTransportException.Type.BAD_ARGS));
    readAvail_ = readAvail_[len .. $];
  }

  /**
   * The wrapped transport.
   */
  TTransport underlyingTransport() @property {
    return transport_;
  }

private:
  TTransport transport_;

  ubyte[] readBuffer_;
  ubyte[] writeBuffer_;

  ubyte[] readAvail_;
  ubyte[] writeAvail_;
}

/**
 * Wraps given transports into TBufferedTransports.
 */
alias TWrapperTransportFactory!TBufferedTransport TBufferedTransportFactory;
