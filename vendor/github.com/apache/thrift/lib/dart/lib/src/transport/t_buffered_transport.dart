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

/// Buffered implementation of [TTransport].
class TBufferedTransport extends TTransport {
  final List<int> _writeBuffer = [];
  Iterator<int> _readIterator;

  Uint8List consumeWriteBuffer() {
    Uint8List buffer = new Uint8List.fromList(_writeBuffer);
    _writeBuffer.clear();
    return buffer;
  }

  void _setReadBuffer(Uint8List readBuffer) {
    _readIterator = readBuffer != null ? readBuffer.iterator : null;
  }

  void _reset({bool isOpen: false}) {
    _isOpen = isOpen;
    _writeBuffer.clear();
    _readIterator = null;
  }

  bool get hasReadData => _readIterator != null;

  bool _isOpen;
  bool get isOpen => _isOpen;

  Future open() async {
    _reset(isOpen: true);
  }

  Future close() async {
    _reset(isOpen: false);
  }

  int read(Uint8List buffer, int offset, int length) {
    if (buffer == null) {
      throw new ArgumentError.notNull("buffer");
    }

    if (offset + length > buffer.length) {
      throw new ArgumentError("The range exceeds the buffer length");
    }

    if (_readIterator == null || length <= 0) {
      return 0;
    }

    int i = 0;
    while (i < length && _readIterator.moveNext()) {
      buffer[offset + i] = _readIterator.current;
      i++;
    }

    // cleanup iterator when we've reached the end
    if (_readIterator.current == null) {
      _readIterator = null;
    }

    return i;
  }

  void write(Uint8List buffer, int offset, int length) {
    if (buffer == null) {
      throw new ArgumentError.notNull("buffer");
    }

    if (offset + length > buffer.length) {
      throw new ArgumentError("The range exceeds the buffer length");
    }

    _writeBuffer.addAll(buffer.sublist(offset, offset + length));
  }

  Future flush() {
    _readIterator = consumeWriteBuffer().iterator;

    return new Future.value();
  }
}
