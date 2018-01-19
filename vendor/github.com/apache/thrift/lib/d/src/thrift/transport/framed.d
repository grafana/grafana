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

module thrift.transport.framed;

import core.bitop : bswap;
import std.algorithm : min;
import std.array : empty;
import std.exception : enforce;
import thrift.transport.base;

/**
 * Framed transport.
 *
 * All writes go into an in-memory buffer until flush is called, at which point
 * the transport writes the length of the entire binary chunk followed by the
 * data payload. The receiver on the other end then performs a single
 * »fixed-length« read to get the whole message off the wire.
 */
final class TFramedTransport : TBaseTransport {
  /**
   * Constructs a new framed transport.
   *
   * Params:
   *   transport = The underlying transport to wrap.
   */
  this(TTransport transport) {
    transport_ = transport;
  }

  /**
   * Returns the wrapped transport.
   */
  TTransport underlyingTransport() @property {
    return transport_;
  }

  override bool isOpen() @property {
    return transport_.isOpen;
  }

  override bool peek() {
    return rBuf_.length > 0 || transport_.peek();
  }

  override void open() {
    transport_.open();
  }

  override void close() {
    flush();
    transport_.close();
  }

  /**
   * Attempts to read data into the given buffer, stopping when the buffer is
   * exhausted or the frame end is reached.
   *
   * TODO: Contrary to the C++ implementation, this never does cross-frame
   * reads – is there actually a valid use case for that?
   *
   * Params:
   *   buf = Slice to use as buffer.
   *
   * Returns: How many bytes were actually read.
   *
   * Throws: TTransportException if an error occurs.
   */
  override size_t read(ubyte[] buf) {
    // If the buffer is empty, read a new frame off the wire.
    if (rBuf_.empty) {
      bool gotFrame = readFrame();
      if (!gotFrame) return 0;
    }

    auto size = min(rBuf_.length, buf.length);
    buf[0..size] = rBuf_[0..size];
    rBuf_ = rBuf_[size..$];
    return size;
  }

  override void write(in ubyte[] buf) {
    wBuf_ ~= buf;
  }

  override void flush() {
    if (wBuf_.empty) return;

    // Properly reset the write buffer even some of the protocol operations go
    // wrong.
    scope (exit) {
      wBuf_.length = 0;
      wBuf_.assumeSafeAppend();
    }

    int len = bswap(cast(int)wBuf_.length);
    transport_.write(cast(ubyte[])(&len)[0..1]);
    transport_.write(wBuf_);
    transport_.flush();
  }

  override const(ubyte)[] borrow(ubyte* buf, size_t len) {
    if (len <= rBuf_.length) {
      return rBuf_;
    } else {
      // Don't try attempting cross-frame borrows, trying that does not make
      // much sense anyway.
      return null;
    }
  }

  override void consume(size_t len) {
    enforce(len <= rBuf_.length, new TTransportException(
      "Invalid consume length", TTransportException.Type.BAD_ARGS));
    rBuf_ = rBuf_[len .. $];
  }

private:
  bool readFrame() {
    // Read the size of the next frame. We can't use readAll() since that
    // always throws an exception on EOF, but want to throw an exception only
    // if EOF occurs after partial size data.
    int size;
    size_t size_read;
    while (size_read < size.sizeof) {
      auto data = (cast(ubyte*)&size)[size_read..size.sizeof];
      auto read = transport_.read(data);
      if (read == 0) {
        if (size_read == 0) {
          // EOF before any data was read.
          return false;
        } else {
          // EOF after a partial frame header – illegal.
          throw new TTransportException(
            "No more data to read after partial frame header",
            TTransportException.Type.END_OF_FILE
          );
        }
      }
      size_read += read;
    }

    size = bswap(size);
    enforce(size >= 0, new TTransportException("Frame size has negative value",
      TTransportException.Type.CORRUPTED_DATA));

    // TODO: Benchmark this.
    rBuf_.length = size;
    rBuf_.assumeSafeAppend();

    transport_.readAll(rBuf_);
    return true;
  }

  TTransport transport_;
  ubyte[] rBuf_;
  ubyte[] wBuf_;
}

/**
 * Wraps given transports into TFramedTransports.
 */
alias TWrapperTransportFactory!TFramedTransport TFramedTransportFactory;

version (unittest) {
  import std.random : Mt19937, uniform;
  import thrift.transport.memory;
}

// Some basic random testing, always starting with the same seed for
// deterministic unit test results – more tests in transport_test.
unittest {
  auto randGen = Mt19937(42);

  // 32 kiB of data to work with.
  auto data = new ubyte[1 << 15];
  foreach (ref b; data) {
    b = uniform!"[]"(cast(ubyte)0, cast(ubyte)255, randGen);
  }

  // Generate a list of chunk sizes to split the data into. A uniform
  // distribution is not quite realistic, but std.random doesn't have anything
  // else yet.
  enum MAX_FRAME_LENGTH = 512;
  auto chunkSizesList = new size_t[][2];
  foreach (ref chunkSizes; chunkSizesList) {
    size_t sum;
    while (true) {
      auto curLen = uniform(0, MAX_FRAME_LENGTH, randGen);
      sum += curLen;
      if (sum > data.length) break;
      chunkSizes ~= curLen;
    }
  }
  chunkSizesList ~= [data.length]; // Also test whole chunk at once.

  // Test writing data.
  {
    foreach (chunkSizes; chunkSizesList) {
      auto buf = new TMemoryBuffer;
      auto framed = new TFramedTransport(buf);

      auto remainingData = data;
      foreach (chunkSize; chunkSizes) {
        framed.write(remainingData[0..chunkSize]);
        remainingData = remainingData[chunkSize..$];
      }
      framed.flush();

      auto writtenData = data[0..($ - remainingData.length)];
      auto actualData = buf.getContents();

      // Check frame size.
      int frameSize = bswap((cast(int[])(actualData[0..int.sizeof]))[0]);
      enforce(frameSize == writtenData.length);

      // Check actual data.
      enforce(actualData[int.sizeof..$] == writtenData);
    }
  }

  // Test reading data.
  {
    foreach (chunkSizes; chunkSizesList) {
      auto buf = new TMemoryBuffer;

      auto size = bswap(cast(int)data.length);
      buf.write(cast(ubyte[])(&size)[0..1]);
      buf.write(data);

      auto framed = new TFramedTransport(buf);
      ubyte[] readData;
      readData.reserve(data.length);
      foreach (chunkSize; chunkSizes) {
        // This should work with read because we have one huge frame.
        auto oldReadLen = readData.length;
        readData.length += chunkSize;
        framed.read(readData[oldReadLen..$]);
      }

      enforce(readData == data[0..readData.length]);
    }
  }

  // Test combined reading/writing of multiple frames.
  foreach (flushProbability; [1, 2, 4, 8, 16, 32]) {
    foreach (chunkSizes; chunkSizesList) {
      auto buf = new TMemoryBuffer;
      auto framed = new TFramedTransport(buf);

      size_t[] frameSizes;

      // Write the data.
      size_t frameSize;
      auto remainingData = data;
      foreach (chunkSize; chunkSizes) {
        framed.write(remainingData[0..chunkSize]);
        remainingData = remainingData[chunkSize..$];

        frameSize += chunkSize;
        if (frameSize > 0 && uniform(0, flushProbability, randGen) == 0) {
          frameSizes ~= frameSize;
          frameSize = 0;
          framed.flush();
        }
      }
      if (frameSize > 0) {
        frameSizes ~= frameSize;
        frameSize = 0;
        framed.flush();
      }

      // Read it back.
      auto readData = new ubyte[data.length - remainingData.length];
      auto remainToRead = readData;
      foreach (fSize; frameSizes) {
        // We are exploiting an implementation detail of TFramedTransport:
        // The read buffer starts empty and it will never return more than one
        // frame per read, so by just requesting all of the data, we should
        // always get exactly one frame.
        auto got = framed.read(remainToRead);
        enforce(got == fSize);
        remainToRead = remainToRead[fSize..$];
      }

      enforce(remainToRead.empty);
      enforce(readData == data[0..readData.length]);
    }
  }
}

// Test flush()ing an empty buffer.
unittest {
  auto buf = new TMemoryBuffer();
  auto framed = new TFramedTransport(buf);
  immutable out1 = [0, 0, 0, 1, 'a'];
  immutable out2 = [0, 0, 0, 1, 'a', 0, 0, 0, 2, 'b', 'c'];

  framed.flush();
  enforce(buf.getContents() == []);
  framed.flush();
  framed.flush();
  enforce(buf.getContents() == []);
  framed.write(cast(ubyte[])"a");
  enforce(buf.getContents() == []);
  framed.flush();
  enforce(buf.getContents() == out1);
  framed.flush();
  framed.flush();
  enforce(buf.getContents() == out1);
  framed.write(cast(ubyte[])"bc");
  enforce(buf.getContents() == out1);
  framed.flush();
  enforce(buf.getContents() == out2);
  framed.flush();
  framed.flush();
  enforce(buf.getContents() == out2);
}
