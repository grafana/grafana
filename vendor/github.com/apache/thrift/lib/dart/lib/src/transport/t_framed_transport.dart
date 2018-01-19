/// Licensed to the Apache Software Foundation (ASF) under one
/// or more contributor license agreements. See the NOTICE file
/// distributed with this work for additional information
/// regarding copyright ownership. The ASF licenses this file
/// to you under the Apache License, Version 2.0 (the
/// "License"); you may not use this file except in compliance
/// with the License. You may obtain a copy of the License at
///
/// http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
/// KIND, either express or implied. See the License for the
/// specific language governing permissions and limitations
/// under the License.

part of thrift;

/// Framed [TTransport].
///
/// Adapted from the Java Framed transport.
class TFramedTransport extends TBufferedTransport {
  static const int headerByteCount = 4;

  final TTransport _transport;

  final Uint8List headerBytes = new Uint8List(headerByteCount);

  TFramedTransport(TTransport transport) : _transport = transport {
    if (transport == null) {
      throw new ArgumentError.notNull("transport");
    }
  }

  bool get isOpen => _transport.isOpen;

  Future open() {
    _reset(isOpen: true);
    return _transport.open();
  }

  Future close() {
    _reset(isOpen: false);
    return _transport.close();
  }

  int read(Uint8List buffer, int offset, int length) {
    if (hasReadData) {
      int got = super.read(buffer, offset, length);
      if (got > 0) return got;
    }

    _readFrame();

    return super.read(buffer, offset, length);
  }

  void _readFrame() {
    _transport.readAll(headerBytes, 0, headerByteCount);
    int size = headerBytes.buffer.asByteData().getUint32(0);

    if (size < 0) {
      throw new TTransportError(
          TTransportErrorType.UNKNOWN, "Read a negative frame size: $size");
    }

    Uint8List buffer = new Uint8List(size);
    _transport.readAll(buffer, 0, size);
    _setReadBuffer(buffer);
  }

  Future flush() {
    Uint8List buffer = consumeWriteBuffer();
    int length = buffer.length;

    headerBytes.buffer.asByteData().setUint32(0, length);
    _transport.write(headerBytes, 0, headerByteCount);
    _transport.write(buffer, 0, length);

    return _transport.flush();
  }
}
