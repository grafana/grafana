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

/**
 * Transports which operate on generic D ranges.
 */
module thrift.transport.range;

import std.array : empty;
import std.range;
import std.traits : Unqual;
import thrift.transport.base;

/**
 * Adapts an ubyte input range for reading via the TTransport interface.
 *
 * The case where R is a plain ubyte[] is reasonably optimized, so a possible
 * use case for TInputRangeTransport would be to deserialize some data held in
 * a memory buffer.
 */
final class TInputRangeTransport(R) if (
  isInputRange!(Unqual!R) && is(ElementType!R : const(ubyte))
) : TBaseTransport {
  /**
   * Constructs a new instance.
   *
   * Params:
   *   data = The input range to use as data.
   */
  this(R data) {
    data_ = data;
  }

  /**
   * An input range transport is always open.
   */
  override bool isOpen() @property {
    return true;
  }

  override bool peek() {
    return !data_.empty;
  }

  /**
   * Opening is a no-op() for an input range transport.
   */
  override void open() {}

  /**
   * Closing is a no-op() for a memory buffer.
   */
  override void close() {}

  override size_t read(ubyte[] buf) {
    auto data = data_.take(buf.length);
    auto bytes = data.length;

    static if (is(typeof(R.init[1 .. 2]) : const(ubyte)[])) {
      // put() is currently unnecessarily slow if both ranges are sliceable.
      buf[0 .. bytes] = data[];
      data_ = data_[bytes .. $];
    } else {
      buf.put(data);
    }

    return bytes;
  }

  /**
   * Shortcut version of readAll() for slicable ranges.
   *
   * Because readAll() is typically a very hot path during deserialization,
   * using this over TBaseTransport.readAll() gives us a nice increase in
   * speed due to the reduced amount of indirections.
   */
  override void readAll(ubyte[] buf) {
    static if (is(typeof(R.init[1 .. 2]) : const(ubyte)[])) {
      if (buf.length <= data_.length) {
        buf[] = data_[0 .. buf.length];
        data_ = data_[buf.length .. $];
        return;
      }
    }
    super.readAll(buf);
  }

  override const(ubyte)[] borrow(ubyte* buf, size_t len) {
    static if (is(R : const(ubyte)[])) {
      // Can only borrow if our data type is actually an ubyte array.
      if (len <= data_.length) {
        return data_;
      }
    }
    return null;
  }

  override void consume(size_t len) {
    static if (is(R : const(ubyte)[])) {
      if (len > data_.length) {
        throw new TTransportException("Invalid consume length",
          TTransportException.Type.BAD_ARGS);
      }
      data_ = data_[len .. $];
    } else {
      super.consume(len);
    }
  }

  /**
   * Sets a new data range to use.
   */
  void reset(R data) {
    data_ = data;
  }

private:
  R data_;
}

/**
 * TInputRangeTransport construction helper to avoid having to explicitly
 * specify the argument type, i.e. to allow the constructor being called using
 * IFTI (see $(LINK2 http://d.puremagic.com/issues/show_bug.cgi?id=6082, D
 * Bugzilla enhancement requet 6082)).
 */
TInputRangeTransport!R tInputRangeTransport(R)(R data) if (
  is (TInputRangeTransport!R)
) {
  return new TInputRangeTransport!R(data);
}
