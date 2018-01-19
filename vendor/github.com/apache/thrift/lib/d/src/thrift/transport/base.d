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
module thrift.transport.base;

import core.stdc.string : strerror;
import std.conv : text;
import thrift.base;

/**
 * An entity data can be read from and/or written to.
 *
 * A TTransport implementation may capable of either reading or writing, but
 * not necessarily both.
 */
interface TTransport {
  /**
   * Whether this transport is open.
   *
   * If a transport is closed, it can be opened by calling open(), and vice
   * versa for close().
   *
   * While a transport should always be open when trying to read/write data,
   * the related functions do not necessarily fail when called for a closed
   * transport. Situations like this could occur e.g. with a wrapper
   * transport which buffers data when the underlying transport has already
   * been closed (possibly because the connection was abruptly closed), but
   * there is still data left to be read in the buffers. This choice has been
   * made to simplify transport implementations, in terms of both  code
   * complexity and runtime overhead.
   */
  bool isOpen() @property;

  /**
   * Tests whether there is more data to read or if the remote side is
   * still open.
   *
   * A typical use case would be a server checking if it should process
   * another request on the transport.
   */
  bool peek();

  /**
   * Opens the transport for communications.
   *
   * If the transport is already open, nothing happens.
   *
   * Throws: TTransportException if opening fails.
   */
  void open();

  /**
   * Closes the transport.
   *
   * If the transport is not open, nothing happens.
   *
   * Throws: TTransportException if closing fails.
   */
  void close();

  /**
   * Attempts to fill the given buffer by reading data.
   *
   * For potentially blocking data sources (e.g. sockets), read() will only
   * block if no data is available at all. If there is some data available,
   * but waiting for new data to arrive would be required to fill the whole
   * buffer, the readily available data will be immediately returned – use
   * readAll() if you want to wait until the whole buffer is filled.
   *
   * Params:
   *   buf = Slice to use as buffer.
   *
   * Returns: How many bytes were actually read
   *
   * Throws: TTransportException if an error occurs.
   */
  size_t read(ubyte[] buf);

  /**
   * Fills the given buffer by reading data into it, failing if not enough
   * data is available.
   *
   * Params:
   *   buf = Slice to use as buffer.
   *
   * Throws: TTransportException if insufficient data is available or reading
   *   fails altogether.
   */
  void readAll(ubyte[] buf);

  /**
   * Must be called by clients when read is completed.
   *
   * Implementations can choose to perform a transport-specific action, e.g.
   * logging the request to a file.
   *
   * Returns: The number of bytes read if available, 0 otherwise.
   */
  size_t readEnd();

  /**
   * Writes the passed slice of data.
   *
   * Note: You must call flush() to ensure the data is actually written,
   * and available to be read back in the future.  Destroying a TTransport
   * object does not automatically flush pending data – if you destroy a
   * TTransport object with written but unflushed data, that data may be
   * discarded.
   *
   * Params:
   *   buf = Slice of data to write.
   *
   * Throws: TTransportException if an error occurs.
   */
  void write(in ubyte[] buf);

  /**
   * Must be called by clients when write is completed.
   *
   * Implementations can choose to perform a transport-specific action, e.g.
   * logging the request to a file.
   *
   * Returns: The number of bytes written if available, 0 otherwise.
   */
  size_t writeEnd();

  /**
   * Flushes any pending data to be written.
   *
   * Must be called before destruction to ensure writes are actually complete,
   * otherwise pending data may be discarded. Typically used with buffered
   * transport mechanisms.
   *
   * Throws: TTransportException if an error occurs.
   */
  void flush();

  /**
   * Attempts to return a slice of <code>len</code> bytes of incoming data,
   * possibly copied into buf, not consuming them (i.e.: a later read will
   * return the same data).
   *
   * This method is meant to support protocols that need to read variable-
   * length fields. They can attempt to borrow the maximum amount of data that
   * they will need, then <code>consume()</code> what they actually use. Some
   * transports will not support this method and others will fail occasionally,
   * so protocols must be prepared to fall back to <code>read()</code> if
   * borrow fails.
   *
   * The transport must be open when calling this.
   *
   * Params:
   *   buf = A buffer where the data can be stored if needed, or null to
   *     indicate that the caller is not supplying storage, but would like a
   *     slice of an internal buffer, if available.
   *   len = The number of bytes to borrow.
   *
   * Returns: If the borrow succeeds, a slice containing the borrowed data,
   *   null otherwise. The slice will be at least as long as requested, but
   *   may be longer if the returned slice points into an internal buffer
   *   rather than buf.
   *
   * Throws: TTransportException if an error occurs.
   */
  const(ubyte)[] borrow(ubyte* buf, size_t len) out (result) {
    // FIXME: Commented out because len gets corrupted in
    // thrift.transport.memory borrow() unittest.
    version(none) assert(result is null || result.length >= len,
       "Buffer returned by borrow() too short.");
  }

  /**
   * Remove len bytes from the transport. This must always follow a borrow
   * of at least len bytes, and should always succeed.
   *
   * The transport must be open when calling this.
   *
   * Params:
   *   len = Number of bytes to consume.
   *
   * Throws: TTransportException if an error occurs.
   */
  void consume(size_t len);
}

/**
 * Provides basic fall-back implementations of the TTransport interface.
 */
class TBaseTransport : TTransport {
  override bool isOpen() @property {
    return false;
  }

  override bool peek() {
    return isOpen;
  }

  override void open() {
    throw new TTransportException("Cannot open TBaseTransport.",
      TTransportException.Type.NOT_IMPLEMENTED);
  }

  override void close() {
    throw new TTransportException("Cannot close TBaseTransport.",
      TTransportException.Type.NOT_IMPLEMENTED);
  }

  override size_t read(ubyte[] buf) {
    throw new TTransportException("Cannot read from a TBaseTransport.",
      TTransportException.Type.NOT_IMPLEMENTED);
  }

  override void readAll(ubyte[] buf) {
    size_t have;
    while (have < buf.length) {
      size_t get = read(buf[have..$]);
      if (get <= 0) {
        throw new TTransportException(text("Could not readAll() ", buf.length,
          " bytes as no more data was available after ", have, " bytes."),
          TTransportException.Type.END_OF_FILE);
      }
      have += get;
    }
  }

  override size_t readEnd() {
    // Do nothing by default, not needed by all implementations.
    return 0;
  }

  override void write(in ubyte[] buf) {
    throw new TTransportException("Cannot write to a TBaseTransport.",
      TTransportException.Type.NOT_IMPLEMENTED);
  }

  override size_t writeEnd() {
    // Do nothing by default, not needed by all implementations.
    return 0;
  }

  override void flush() {
    // Do nothing by default, not needed by all implementations.
  }

  override const(ubyte)[] borrow(ubyte* buf, size_t len) {
    // borrow() is allowed to fail anyway, so just return null.
    return null;
  }

  override void consume(size_t len) {
    throw new TTransportException("Cannot consume from a TBaseTransport.",
      TTransportException.Type.NOT_IMPLEMENTED);
  }

protected:
  this() {}
}

/**
 * Makes a TTransport which wraps a given source transport in some way.
 *
 * A common use case is inside server implementations, where the raw client
 * connections accepted from e.g. TServerSocket need to be wrapped into
 * buffered or compressed transports.
 */
class TTransportFactory {
  /**
   * Default implementation does nothing, just returns the transport given.
   */
  TTransport getTransport(TTransport trans) {
    return trans;
  }
}

/**
 * Transport factory for transports which simply wrap an underlying TTransport
 * without requiring additional configuration.
 */
class TWrapperTransportFactory(T) if (
  is(T : TTransport) && __traits(compiles, new T(TTransport.init))
)  : TTransportFactory {
  override T getTransport(TTransport trans) {
    return new T(trans);
  }
}

/**
 * Transport-level exception.
 */
class TTransportException : TException {
  /**
   * Error codes for the various types of exceptions.
   */
  enum Type {
    UNKNOWN, ///
    NOT_OPEN, ///
    TIMED_OUT, ///
    END_OF_FILE, ///
    INTERRUPTED, ///
    BAD_ARGS, ///
    CORRUPTED_DATA, ///
    INTERNAL_ERROR, ///
    NOT_IMPLEMENTED ///
  }

  ///
  this(Type type, string file = __FILE__, size_t line = __LINE__, Throwable next = null) {
    static string msgForType(Type type) {
      switch (type) {
        case Type.UNKNOWN: return "Unknown transport exception";
        case Type.NOT_OPEN: return "Transport not open";
        case Type.TIMED_OUT: return "Timed out";
        case Type.END_OF_FILE: return "End of file";
        case Type.INTERRUPTED: return "Interrupted";
        case Type.BAD_ARGS: return "Invalid arguments";
        case Type.CORRUPTED_DATA: return "Corrupted Data";
        case Type.INTERNAL_ERROR: return "Internal error";
        case Type.NOT_IMPLEMENTED: return "Not implemented";
        default: return "(Invalid exception type)";
      }
    }
    this(msgForType(type), type, file, line, next);
  }

  ///
  this(string msg, string file = __FILE__, size_t line = __LINE__,
    Throwable next = null)
  {
    this(msg, Type.UNKNOWN, file, line, next);
  }

  ///
  this(string msg, Type type, string file = __FILE__, size_t line = __LINE__,
    Throwable next = null)
  {
    super(msg, file, line, next);
    type_ = type;
  }

  ///
  Type type() const nothrow @property {
    return type_;
  }

protected:
  Type type_;
}

/**
 * Meta-programming helper returning whether the passed type is a TTransport
 * implementation.
 */
template isTTransport(T) {
  enum isTTransport = is(T : TTransport);
}
