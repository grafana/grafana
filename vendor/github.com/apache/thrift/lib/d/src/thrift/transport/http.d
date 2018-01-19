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
 * HTTP tranpsort implementation, modelled after the C++ one.
 *
 * Unfortunately, libcurl is quite heavyweight and supports only client-side
 * applications. This is an implementation of the basic HTTP/1.1 parts
 * supporting HTTP 100 Continue, chunked transfer encoding, keepalive, etc.
 */
module thrift.transport.http;

import std.algorithm : canFind, countUntil, endsWith, findSplit, min, startsWith;
import std.ascii : toLower;
import std.array : empty;
import std.conv : parse, to;
import std.datetime : Clock, UTC;
import std.string : stripLeft;
import thrift.base : VERSION;
import thrift.transport.base;
import thrift.transport.memory;
import thrift.transport.socket;

/**
 * Base class for both client- and server-side HTTP transports.
 */
abstract class THttpTransport : TBaseTransport {
  this(TTransport transport) {
    transport_ = transport;
    readHeaders_ = true;
    httpBuf_ = new ubyte[HTTP_BUFFER_SIZE];
    httpBufRemaining_ = httpBuf_[0 .. 0];
    readBuffer_ = new TMemoryBuffer;
    writeBuffer_ = new TMemoryBuffer;
  }

  override bool isOpen() {
    return transport_.isOpen();
  }

  override bool peek() {
    return transport_.peek();
  }

  override void open() {
    transport_.open();
  }

  override void close() {
    transport_.close();
  }

  override size_t read(ubyte[] buf) {
    if (!readBuffer_.peek()) {
      readBuffer_.reset();

      if (!refill()) return 0;

      if (readHeaders_) {
        readHeaders();
      }

      size_t got;
      if (chunked_) {
        got = readChunked();
      } else {
        got = readContent(contentLength_);
      }
      readHeaders_ = true;

      if (got == 0) return 0;
    }
    return readBuffer_.read(buf);
  }

  override size_t readEnd() {
    // Read any pending chunked data (footers etc.)
    if (chunked_) {
      while (!chunkedDone_) {
        readChunked();
      }
    }
    return 0;
  }

  override void write(in ubyte[] buf) {
    writeBuffer_.write(buf);
  }

  override void flush() {
    auto data = writeBuffer_.getContents();
    string header = getHeader(data.length);

    transport_.write(cast(const(ubyte)[]) header);
    transport_.write(data);
    transport_.flush();

    // Reset the buffer and header variables.
    writeBuffer_.reset();
    readHeaders_ = true;
  }

  /**
   * The size of the buffer to read HTTP requests into, in bytes. Will expand
   * as required.
   */
  enum HTTP_BUFFER_SIZE = 1024;

protected:
  abstract string getHeader(size_t dataLength);
  abstract bool parseStatusLine(const(ubyte)[] status);

  void parseHeader(const(ubyte)[] header) {
    auto split = findSplit(header, [':']);
    if (split[1].empty) {
      // No colon found.
      return;
    }

    static bool compToLower(ubyte a, ubyte b) {
      return toLower(cast(char)a) == toLower(cast(char)b);
    }

    if (startsWith!compToLower(split[0], cast(ubyte[])"transfer-encoding")) {
      if (endsWith!compToLower(split[2], cast(ubyte[])"chunked")) {
        chunked_ = true;
      }
    } else if (startsWith!compToLower(split[0], cast(ubyte[])"content-length")) {
      chunked_ = false;
      auto lengthString = stripLeft(cast(const(char)[])split[2]);
      contentLength_ = parse!size_t(lengthString);
    }
  }

private:
  ubyte[] readLine() {
    while (true) {
      auto split = findSplit(httpBufRemaining_, cast(ubyte[])"\r\n");

      if (split[1].empty) {
        // No CRLF yet, move whatever we have now to front and refill.
        if (httpBufRemaining_.empty) {
          httpBufRemaining_ = httpBuf_[0 .. 0];
        } else {
          httpBuf_[0 .. httpBufRemaining_.length] = httpBufRemaining_;
          httpBufRemaining_ = httpBuf_[0 .. httpBufRemaining_.length];
        }

        if (!refill()) {
          auto buf = httpBufRemaining_;
          httpBufRemaining_ = httpBufRemaining_[$ - 1 .. $ - 1];
          return buf;
        }
      } else {
        // Set the remaining buffer to the part after \r\n and return the part
        // (line) before it.
        httpBufRemaining_ = split[2];
        return split[0];
      }
    }
  }

  void readHeaders() {
    // Initialize headers state variables
    contentLength_ = 0;
    chunked_ = false;
    chunkedDone_ = false;
    chunkSize_ = 0;

    // Control state flow
    bool statusLine = true;
    bool finished;

    // Loop until headers are finished
    while (true) {
      auto line = readLine();

      if (line.length == 0) {
        if (finished) {
          readHeaders_ = false;
          return;
        } else {
          // Must have been an HTTP 100, keep going for another status line
          statusLine = true;
        }
      } else {
        if (statusLine) {
          statusLine = false;
          finished = parseStatusLine(line);
        } else {
          parseHeader(line);
        }
      }
    }
  }

  size_t readChunked() {
    size_t length;

    auto line = readLine();
    size_t chunkSize;
    try {
      auto charLine = cast(char[])line;
      chunkSize = parse!size_t(charLine, 16);
    } catch (Exception e) {
      throw new TTransportException("Invalid chunk size: " ~ to!string(line),
        TTransportException.Type.CORRUPTED_DATA);
    }

    if (chunkSize == 0) {
      readChunkedFooters();
    } else {
      // Read data content
      length += readContent(chunkSize);
      // Read trailing CRLF after content
      readLine();
    }
    return length;
  }

  void readChunkedFooters() {
    while (true) {
      auto line = readLine();
      if (line.length == 0) {
        chunkedDone_ = true;
        break;
      }
    }
  }

  size_t readContent(size_t size) {
    auto need = size;
    while (need > 0) {
      if (httpBufRemaining_.length == 0) {
        // We have given all the data, reset position to head of the buffer.
        httpBufRemaining_ = httpBuf_[0 .. 0];
        if (!refill()) return size - need;
      }

      auto give = min(httpBufRemaining_.length, need);
      readBuffer_.write(cast(ubyte[])httpBufRemaining_[0 .. give]);
      httpBufRemaining_ = httpBufRemaining_[give .. $];
      need -= give;
    }
    return size;
  }

  bool refill() {
    // Is there a nicer way to do this?
    auto indexBegin = httpBufRemaining_.ptr - httpBuf_.ptr;
    auto indexEnd = indexBegin + httpBufRemaining_.length;

    if (httpBuf_.length - indexEnd <= (httpBuf_.length / 4)) {
      httpBuf_.length *= 2;
    }

    // Read more data.
    auto got = transport_.read(cast(ubyte[])httpBuf_[indexEnd .. $]);
    if (got == 0) return false;
    httpBufRemaining_ = httpBuf_[indexBegin .. indexEnd + got];
    return true;
  }

  TTransport transport_;

  TMemoryBuffer writeBuffer_;
  TMemoryBuffer readBuffer_;

  bool readHeaders_;
  bool chunked_;
  bool chunkedDone_;
  size_t chunkSize_;
  size_t contentLength_;

  ubyte[] httpBuf_;
  ubyte[] httpBufRemaining_;
}

/**
 * HTTP client transport.
 */
final class TClientHttpTransport : THttpTransport {
  /**
   * Constructs a client http transport operating on the passed underlying
   * transport.
   *
   * Params:
   *   transport = The underlying transport used for the actual I/O.
   *   host = The HTTP host string.
   *   path = The HTTP path string.
   */
  this(TTransport transport, string host, string path) {
    super(transport);
    host_ = host;
    path_ = path;
  }

  /**
   * Convenience overload for constructing a client HTTP transport using a
   * TSocket connecting to the specified host and port.
   *
   * Params:
   *   host = The server to connect to, also used as HTTP host string.
   *   port = The port to connect to.
   *   path = The HTTP path string.
   */
  this(string host, ushort port, string path) {
    this(new TSocket(host, port), host, path);
  }

protected:
  override string getHeader(size_t dataLength) {
    return "POST " ~ path_ ~ " HTTP/1.1\r\n" ~
      "Host: " ~ host_ ~ "\r\n" ~
      "Content-Type: application/x-thrift\r\n" ~
      "Content-Length: " ~ to!string(dataLength) ~ "\r\n" ~
      "Accept: application/x-thrift\r\n"
      "User-Agent: Thrift/" ~ VERSION ~ " (D/TClientHttpTransport)\r\n" ~
      "\r\n";
  }

  override bool parseStatusLine(const(ubyte)[] status) {
    // HTTP-Version SP Status-Code SP Reason-Phrase CRLF
    auto firstSplit = findSplit(status, [' ']);
    if (firstSplit[1].empty) {
      throw new TTransportException("Bad status: " ~ to!string(status),
        TTransportException.Type.CORRUPTED_DATA);
    }

    auto codeReason = firstSplit[2][countUntil!"a != b"(firstSplit[2], ' ') .. $];
    auto secondSplit = findSplit(codeReason, [' ']);
    if (secondSplit[1].empty) {
      throw new TTransportException("Bad status: " ~ to!string(status),
        TTransportException.Type.CORRUPTED_DATA);
    }

    if (secondSplit[0] == "200") {
      // HTTP 200 = OK, we got the response
      return true;
    } else if (secondSplit[0] == "100") {
      // HTTP 100 = continue, just keep reading
      return false;
    }

    throw new TTransportException("Bad status (unhandled status code): " ~
      to!string(cast(const(char[]))status), TTransportException.Type.CORRUPTED_DATA);
  }

private:
  string host_;
  string path_;
}

/**
 * HTTP server transport.
 */
final class TServerHttpTransport : THttpTransport {
  /**
   * Constructs a new instance.
   *
   * Param:
   *   transport = The underlying transport used for the actual I/O.
   */
  this(TTransport transport) {
    super(transport);
  }

protected:
  override string getHeader(size_t dataLength) {
    return "HTTP/1.1 200 OK\r\n" ~
      "Date: " ~ getRFC1123Time() ~ "\r\n" ~
      "Server: Thrift/" ~ VERSION ~ "\r\n" ~
      "Content-Type: application/x-thrift\r\n" ~
      "Content-Length: " ~ to!string(dataLength) ~ "\r\n" ~
      "Connection: Keep-Alive\r\n" ~
      "\r\n";
  }

  override bool parseStatusLine(const(ubyte)[] status) {
    // Method SP Request-URI SP HTTP-Version CRLF.
    auto split = findSplit(status, [' ']);
    if (split[1].empty) {
      throw new TTransportException("Bad status: " ~ to!string(status),
        TTransportException.Type.CORRUPTED_DATA);
    }

    auto uriVersion = split[2][countUntil!"a != b"(split[2], ' ') .. $];
    if (!canFind(uriVersion, ' ')) {
      throw new TTransportException("Bad status: " ~ to!string(status),
        TTransportException.Type.CORRUPTED_DATA);
    }

    if (split[0] == "POST") {
      // POST method ok, looking for content.
      return true;
    }

    throw new TTransportException("Bad status (unsupported method): " ~
      to!string(status), TTransportException.Type.CORRUPTED_DATA);
  }
}

/**
 * Wraps a transport into a HTTP server protocol.
 */
alias TWrapperTransportFactory!TServerHttpTransport TServerHttpTransportFactory;

private {
  import std.string : format;
  string getRFC1123Time() {
    auto sysTime = Clock.currTime(UTC());

    auto dayName = capMemberName(sysTime.dayOfWeek);
    auto monthName = capMemberName(sysTime.month);

    return format("%s, %s %s %s %s:%s:%s GMT", dayName, sysTime.day,
      monthName, sysTime.year, sysTime.hour, sysTime.minute, sysTime.second);
  }

  import std.ascii : toUpper;
  import std.traits : EnumMembers;
  string capMemberName(T)(T val) if (is(T == enum)) {
    foreach (i, e; EnumMembers!T) {
      enum name = __traits(derivedMembers, T)[i];
      enum capName = cast(char) toUpper(name[0]) ~ name [1 .. $];
      if (val == e) {
        return capName;
      }
    }
    throw new Exception("Not a member of " ~ T.stringof ~ ": " ~ to!string(val));
  }

  unittest {
    enum Foo {
      bar,
      bAZ
    }

    import std.exception;
    enforce(capMemberName(Foo.bar) == "Bar");
    enforce(capMemberName(Foo.bAZ) == "BAZ");
  }
}
