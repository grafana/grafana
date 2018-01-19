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
module thrift.transport.memory;

import core.exception : onOutOfMemoryError;
import core.stdc.stdlib : free, realloc;
import std.algorithm : min;
import std.conv : text;
import thrift.transport.base;

/**
 * A transport that simply reads from and writes to an in-memory buffer. Every
 * time you call write on it, the data is simply placed into a buffer, and
 * every time you call read, data is consumed from that buffer.
 *
 * Currently, the storage for written data is never reclaimed, even if the
 * buffer contents have already been read out again.
 */
final class TMemoryBuffer : TBaseTransport {
  /**
   * Constructs a new memory transport with an empty internal buffer.
   */
  this() {}

  /**
   * Constructs a new memory transport with an empty internal buffer,
   * reserving space for capacity bytes in advance.
   *
   * If the amount of data which will be written to the buffer is already
   * known on construction, this can better performance over the default
   * constructor because reallocations can be avoided.
   *
   * If the preallocated buffer is exhausted, data can still be written to the
   * transport, but reallocations will happen.
   *
   * Params:
   *   capacity = Size of the initially reserved buffer (in bytes).
   */
  this(size_t capacity) {
    reset(capacity);
  }

  /**
   * Constructs a new memory transport initially containing the passed data.
   *
   * For now, the passed buffer is not intelligently used, the data is just
   * copied to the internal buffer.
   *
   * Params:
   *   buffer = Initial contents available to be read.
   */
  this(in ubyte[] contents) {
    auto size = contents.length;
    reset(size);
    buffer_[0 .. size] = contents[];
    writeOffset_ = size;
  }

  /**
   * Destructor, frees the internally allocated buffer.
   */
  ~this() {
    free(buffer_);
  }

  /**
   * Returns a read-only view of the current buffer contents.
   *
   * Note: For performance reasons, the returned slice is only valid for the
   * life of this object, and may be invalidated on the next write() call at
   * will – you might want to immediately .dup it if you intend to keep it
   * around.
   */
  const(ubyte)[] getContents() {
    return buffer_[readOffset_ .. writeOffset_];
  }

  /**
   * A memory transport is always open.
   */
  override bool isOpen() @property {
    return true;
  }

  override bool peek() {
    return writeOffset_ - readOffset_ > 0;
  }

  /**
   * Opening is a no-op() for a memory buffer.
   */
  override void open() {}

  /**
   * Closing is a no-op() for a memory buffer, it is always open.
   */
  override void close() {}

  override size_t read(ubyte[] buf) {
    auto size = min(buf.length, writeOffset_ - readOffset_);
    buf[0 .. size] = buffer_[readOffset_ .. readOffset_ + size];
    readOffset_ += size;
    return size;
  }

  /**
   * Shortcut version of readAll() – using this over TBaseTransport.readAll()
   * can give us a nice speed increase because gives us a nice speed increase
   * because it is typically a very hot path during deserialization.
   */
  override void readAll(ubyte[] buf) {
    auto available = writeOffset_ - readOffset_;
    if (buf.length > available) {
      throw new TTransportException(text("Cannot readAll() ", buf.length,
        " bytes of data because only ", available, " bytes are available."),
        TTransportException.Type.END_OF_FILE);
    }

    buf[] = buffer_[readOffset_ .. readOffset_ + buf.length];
    readOffset_ += buf.length;
  }

  override void write(in ubyte[] buf) {
    auto need = buf.length;
    if (bufferLen_ - writeOffset_ < need) {
      // Exponential growth.
      auto newLen = bufferLen_ + 1;
      while (newLen - writeOffset_ < need) newLen *= 2;
      cRealloc(buffer_, newLen);
      bufferLen_ = newLen;
    }

    buffer_[writeOffset_ .. writeOffset_ + need] = buf[];
    writeOffset_ += need;
  }

  override const(ubyte)[] borrow(ubyte* buf, size_t len) {
    if (len <= writeOffset_ - readOffset_) {
      return buffer_[readOffset_ .. writeOffset_];
    } else {
      return null;
    }
  }

  override void consume(size_t len) {
    readOffset_ += len;
  }

  void reset() {
    readOffset_ = 0;
    writeOffset_ = 0;
  }

  void reset(size_t capacity) {
    readOffset_ = 0;
    writeOffset_ = 0;
    if (bufferLen_ < capacity) {
      cRealloc(buffer_, capacity);
      bufferLen_ = capacity;
    }
  }

private:
  ubyte* buffer_;
  size_t bufferLen_;
  size_t readOffset_;
  size_t writeOffset_;
}

private {
  void cRealloc(ref ubyte* data, size_t newSize) {
    auto result = realloc(data, newSize);
    if (result is null) onOutOfMemoryError();
    data = cast(ubyte*)result;
  }
}

version (unittest) {
  import std.exception;
}

unittest {
  auto a = new TMemoryBuffer(5);
  immutable(ubyte[]) testData = [1, 2, 3, 4];
  auto buf = new ubyte[testData.length];
  enforce(a.isOpen);

  // a should be empty.
  enforce(!a.peek());
  enforce(a.read(buf) == 0);
  assertThrown!TTransportException(a.readAll(buf));

  // Write some data and read it back again.
  a.write(testData);
  enforce(a.peek());
  enforce(a.getContents() == testData);
  enforce(a.read(buf) == testData.length);
  enforce(buf == testData);

  // a should be empty again.
  enforce(!a.peek());
  enforce(a.read(buf) == 0);
  assertThrown!TTransportException(a.readAll(buf));

  // Test the constructor which directly accepts initial data.
  auto b = new TMemoryBuffer(testData);
  enforce(b.isOpen);
  enforce(b.peek());
  enforce(b.getContents() == testData);

  // Test borrow().
  auto borrowed = b.borrow(null, testData.length);
  enforce(borrowed == testData);
  enforce(b.peek());
  b.consume(testData.length);
  enforce(!b.peek());
}
