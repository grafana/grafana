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

module thrift.transport.zlib;

import core.bitop : bswap;
import etc.c.zlib;
import std.algorithm : min;
import std.array : empty;
import std.conv : to;
import std.exception : enforce;
import thrift.base;
import thrift.transport.base;

/**
 * zlib transport. Compresses (deflates) data before writing it to the
 * underlying transport, and decompresses (inflates) it after reading.
 */
final class TZlibTransport : TBaseTransport {
  // These defaults have yet to be optimized.
  enum DEFAULT_URBUF_SIZE = 128;
  enum DEFAULT_CRBUF_SIZE = 1024;
  enum DEFAULT_UWBUF_SIZE = 128;
  enum DEFAULT_CWBUF_SIZE = 1024;

  /**
   * Constructs a new zlib transport.
   *
   * Params:
   *   transport = The underlying transport to wrap.
   *   urbufSize = The size of the uncompressed reading buffer, in bytes.
   *   crbufSize = The size of the compressed reading buffer, in bytes.
   *   uwbufSize = The size of the uncompressed writing buffer, in bytes.
   *   cwbufSize = The size of the compressed writing buffer, in bytes.
   */
  this(
    TTransport transport,
    size_t urbufSize = DEFAULT_URBUF_SIZE,
    size_t crbufSize = DEFAULT_CRBUF_SIZE,
    size_t uwbufSize = DEFAULT_UWBUF_SIZE,
    size_t cwbufSize = DEFAULT_CWBUF_SIZE
  ) {
    transport_ = transport;

    enforce(uwbufSize >= MIN_DIRECT_DEFLATE_SIZE, new TTransportException(
      "TZLibTransport: uncompressed write buffer must be at least " ~
      to!string(MIN_DIRECT_DEFLATE_SIZE) ~ "bytes in size.",
      TTransportException.Type.BAD_ARGS));

    urbuf_ = new ubyte[urbufSize];
    crbuf_ = new ubyte[crbufSize];
    uwbuf_ = new ubyte[uwbufSize];
    cwbuf_ = new ubyte[cwbufSize];

    rstream_ = new z_stream;
    rstream_.next_in = crbuf_.ptr;
    rstream_.avail_in  = 0;
    rstream_.next_out = urbuf_.ptr;
    rstream_.avail_out = to!uint(urbuf_.length);

    wstream_ = new z_stream;
    wstream_.next_in = uwbuf_.ptr;
    wstream_.avail_in = 0;
    wstream_.next_out = cwbuf_.ptr;
    wstream_.avail_out = to!uint(crbuf_.length);

    zlibEnforce(inflateInit(rstream_), rstream_);
    scope (failure) {
      zlibLogError(inflateEnd(rstream_), rstream_);
    }

    zlibEnforce(deflateInit(wstream_, Z_DEFAULT_COMPRESSION), wstream_);
  }

  ~this() {
    zlibLogError(inflateEnd(rstream_), rstream_);

    auto result = deflateEnd(wstream_);
    // Z_DATA_ERROR may indicate unflushed data, so just ignore it.
    if (result != Z_DATA_ERROR) {
      zlibLogError(result, wstream_);
    }
  }

  /**
   * Returns the wrapped transport.
   */
  TTransport underlyingTransport() @property {
    return transport_;
  }

  override bool isOpen() @property {
    return readAvail > 0 || transport_.isOpen;
  }

  override bool peek() {
    return readAvail > 0 || transport_.peek();
  }

  override void open() {
    transport_.open();
  }

  override void close() {
    transport_.close();
  }

  override size_t read(ubyte[] buf) {
    // The C++ implementation suggests to skip urbuf on big reads in future
    // versions, we would benefit from it as well.
    auto origLen = buf.length;
    while (true) {
      auto give = min(readAvail, buf.length);

      // If std.range.put was optimized for slicable ranges, it could be used
      // here as well.
      buf[0 .. give] = urbuf_[urpos_ .. urpos_ + give];
      buf = buf[give .. $];
      urpos_ += give;

      auto need = buf.length;
      if (need == 0) {
        // We could manage to get the all the data requested.
        return origLen;
      }

      if (inputEnded_ || (need < origLen && rstream_.avail_in == 0)) {
        // We didn't fill buf completely, but there is no more data available.
        return origLen - need;
      }

      // Refill our buffer by reading more data through zlib.
      rstream_.next_out = urbuf_.ptr;
      rstream_.avail_out = to!uint(urbuf_.length);
      urpos_ = 0;

      if (!readFromZlib()) {
        // Couldn't get more data from the underlying transport.
        return origLen - need;
      }
    }
  }

  override void write(in ubyte[] buf) {
    enforce(!outputFinished_, new TTransportException(
      "write() called after finish()", TTransportException.Type.BAD_ARGS));

    auto len = buf.length;
    if (len > MIN_DIRECT_DEFLATE_SIZE) {
      flushToZlib(uwbuf_[0 .. uwpos_], Z_NO_FLUSH);
      uwpos_ = 0;
      flushToZlib(buf, Z_NO_FLUSH);
    } else if (len > 0) {
      if (uwbuf_.length - uwpos_ < len) {
        flushToZlib(uwbuf_[0 .. uwpos_], Z_NO_FLUSH);
        uwpos_ = 0;
      }
      uwbuf_[uwpos_ .. uwpos_ + len] = buf[];
      uwpos_ += len;
    }
  }

  override void flush() {
    enforce(!outputFinished_, new TTransportException(
      "flush() called after finish()", TTransportException.Type.BAD_ARGS));

    flushToTransport(Z_SYNC_FLUSH);
  }

  override const(ubyte)[] borrow(ubyte* buf, size_t len) {
    if (len <= readAvail) {
      return urbuf_[urpos_ .. $];
    }
    return null;
  }

  override void consume(size_t len) {
    enforce(readAvail >= len, new TTransportException(
      "consume() did not follow a borrow().", TTransportException.Type.BAD_ARGS));
    urpos_ += len;
  }

  /**
   * Finalize the zlib stream.
   *
   * This causes zlib to flush any pending write data and write end-of-stream
   * information, including the checksum.  Once finish() has been called, no
   * new data can be written to the stream.
   */
  void finish() {
    enforce(!outputFinished_, new TTransportException(
      "flush() called on already finished TZlibTransport",
      TTransportException.Type.BAD_ARGS));
    flushToTransport(Z_FINISH);
  }

  /**
   * Verify the checksum at the end of the zlib stream (by finish()).
   *
   * May only be called after all data has been read.
   *
   * Throws: TTransportException when the checksum is corrupted or there is
   *   still unread data left.
   */
  void verifyChecksum() {
    // If zlib has already reported the end of the stream, the checksum has
    // been verified, no.
    if (inputEnded_) return;

    enforce(!readAvail, new TTransportException(
      "verifyChecksum() called before end of zlib stream",
      TTransportException.Type.CORRUPTED_DATA));

    rstream_.next_out = urbuf_.ptr;
    rstream_.avail_out = to!uint(urbuf_.length);
    urpos_ = 0;

    // readFromZlib() will throw an exception if the checksum is bad.
    enforce(readFromZlib(), new TTransportException(
      "checksum not available yet in verifyChecksum()",
      TTransportException.Type.CORRUPTED_DATA));

    enforce(inputEnded_, new TTransportException(
      "verifyChecksum() called before end of zlib stream",
      TTransportException.Type.CORRUPTED_DATA));

    // If we get here, we are at the end of the stream and thus zlib has
    // successfully verified the checksum.
  }

private:
  size_t readAvail() const @property {
    return urbuf_.length - rstream_.avail_out - urpos_;
  }

  bool readFromZlib() {
    assert(!inputEnded_);

    if (rstream_.avail_in == 0) {
      // zlib has used up all the compressed data we provided in crbuf, read
      // some more from the underlying transport.
      auto got = transport_.read(crbuf_);
      if (got == 0) return false;
      rstream_.next_in = crbuf_.ptr;
      rstream_.avail_in = to!uint(got);
    }

    // We have some compressed data now, uncompress it.
    auto zlib_result = inflate(rstream_, Z_SYNC_FLUSH);
    if (zlib_result == Z_STREAM_END) {
      inputEnded_ = true;
    } else {
      zlibEnforce(zlib_result, rstream_);
    }

    return true;
  }

  void flushToTransport(int type)  {
    // Compress remaining data in uwbuf_ to cwbuf_.
    flushToZlib(uwbuf_[0 .. uwpos_], type);
    uwpos_ = 0;

    // Write all compressed data to the transport.
    transport_.write(cwbuf_[0 .. $ - wstream_.avail_out]);
    wstream_.next_out = cwbuf_.ptr;
    wstream_.avail_out = to!uint(cwbuf_.length);

    // Flush the transport.
    transport_.flush();
  }

  void flushToZlib(in ubyte[] buf, int type) {
    wstream_.next_in = cast(ubyte*)buf.ptr; // zlib only reads, cast is safe.
    wstream_.avail_in = to!uint(buf.length);

    while (true) {
      if (type == Z_NO_FLUSH && wstream_.avail_in == 0) {
        break;
      }

      if (wstream_.avail_out == 0) {
        // cwbuf has been exhausted by zlib, flush to the underlying transport.
        transport_.write(cwbuf_);
        wstream_.next_out = cwbuf_.ptr;
        wstream_.avail_out = to!uint(cwbuf_.length);
      }

      auto zlib_result = deflate(wstream_, type);

      if (type == Z_FINISH && zlib_result == Z_STREAM_END) {
        assert(wstream_.avail_in == 0);
        outputFinished_ = true;
        break;
      }

      zlibEnforce(zlib_result, wstream_);

      if ((type == Z_SYNC_FLUSH || type == Z_FULL_FLUSH) &&
          wstream_.avail_in == 0 && wstream_.avail_out != 0) {
        break;
      }
    }
  }

  static void zlibEnforce(int status, z_stream* stream) {
    if (status != Z_OK) {
      throw new TZlibException(status, stream.msg);
    }
  }

  static void zlibLogError(int status, z_stream* stream) {
    if (status != Z_OK) {
      logError("TZlibTransport: zlib failure in destructor: %s",
        TZlibException.errorMessage(status, stream.msg));
    }
  }

  // Writes smaller than this are buffered up (due to zlib handling overhead).
  // Larger (or equal) writes are dumped straight to zlib.
  enum MIN_DIRECT_DEFLATE_SIZE = 32;

  TTransport transport_;
  z_stream* rstream_;
  z_stream* wstream_;

  /// Whether zlib has reached the end of the input stream.
  bool inputEnded_;

  /// Whether the output stream was already finish()ed.
  bool outputFinished_;

  /// Compressed input data buffer.
  ubyte[] crbuf_;

  /// Uncompressed input data buffer.
  ubyte[] urbuf_;
  size_t urpos_;

  /// Uncompressed output data buffer (where small writes are accumulated
  /// before handing over to zlib).
  ubyte[] uwbuf_;
  size_t uwpos_;

  /// Compressed output data buffer (filled by zlib, we flush it to the
  /// underlying transport).
  ubyte[] cwbuf_;
}

/**
 * Wraps given transports into TZlibTransports.
 */
alias TWrapperTransportFactory!TZlibTransport TZlibTransportFactory;

/**
 * An INTERNAL_ERROR-type TTransportException originating from an error
 * signaled by zlib.
 */
class TZlibException : TTransportException {
  this(int statusCode, const(char)* msg) {
    super(errorMessage(statusCode, msg), TTransportException.Type.INTERNAL_ERROR);
    zlibStatusCode = statusCode;
    zlibMsg = msg ? to!string(msg) : "(null)";
  }

  int zlibStatusCode;
  string zlibMsg;

  static string errorMessage(int statusCode, const(char)* msg) {
    string result = "zlib error: ";

    if (msg) {
      result ~= to!string(msg);
    } else {
      result ~= "(no message)";
    }

    result ~= " (status code = " ~ to!string(statusCode) ~ ")";
    return result;
  }
}

version (unittest) {
  import std.exception : collectException;
  import thrift.transport.memory;
}

// Make sure basic reading/writing works.
unittest {
  auto buf = new TMemoryBuffer;
  auto zlib = new TZlibTransport(buf);

  immutable ubyte[] data = [1, 2, 3, 4, 5];
  zlib.write(data);
  zlib.finish();

  auto result = new ubyte[data.length];
  zlib.readAll(result);
  enforce(data == result);
  zlib.verifyChecksum();
}

// Make sure there is no data is written if write() is never called.
unittest {
  auto buf = new TMemoryBuffer;
  {
    scope zlib = new TZlibTransport(buf);
  }
  enforce(buf.getContents().length == 0);
}

// Make sure calling write()/flush()/finish() again after finish() throws.
unittest {
  auto buf = new TMemoryBuffer;
  auto zlib = new TZlibTransport(buf);

  zlib.write([1, 2, 3, 4, 5]);
  zlib.finish();

  auto ex = collectException!TTransportException(zlib.write([6]));
  enforce(ex && ex.type == TTransportException.Type.BAD_ARGS);

  ex = collectException!TTransportException(zlib.flush());
  enforce(ex && ex.type == TTransportException.Type.BAD_ARGS);

  ex = collectException!TTransportException(zlib.finish());
  enforce(ex && ex.type == TTransportException.Type.BAD_ARGS);
}

// Make sure verifying the checksum works even if it requires starting a new
// reading buffer after reading the payload has already been completed.
unittest {
  auto buf = new TMemoryBuffer;
  auto zlib = new TZlibTransport(buf);

  immutable ubyte[] data = [1, 2, 3, 4, 5];
  zlib.write(data);
  zlib.finish();

  zlib = new TZlibTransport(buf, TZlibTransport.DEFAULT_URBUF_SIZE,
    buf.getContents().length - 1); // The last byte belongs to the checksum.

  auto result = new ubyte[data.length];
  zlib.readAll(result);
  enforce(data == result);

  zlib.verifyChecksum();
}

// Make sure verifyChecksum() throws if we messed with the checksum.
unittest {
  import std.stdio;
  import thrift.transport.range;

  auto buf = new TMemoryBuffer;
  auto zlib = new TZlibTransport(buf);

  immutable ubyte[] data = [1, 2, 3, 4, 5];
  zlib.write(data);
  zlib.finish();

  void testCorrupted(const(ubyte)[] corruptedData) {
    auto reader = new TZlibTransport(tInputRangeTransport(corruptedData));
    auto result = new ubyte[data.length];
    try {
      reader.readAll(result);

      // If it does read without complaining, the result should be correct.
      enforce(result == data);
    } catch (TZlibException e) {}

    auto ex = collectException!TTransportException(reader.verifyChecksum());
    enforce(ex && ex.type == TTransportException.Type.CORRUPTED_DATA);
  }

  testCorrupted(buf.getContents()[0 .. $ - 1]);

  auto modified = buf.getContents().dup;
  ++modified[$ - 1];
  testCorrupted(modified);
}
