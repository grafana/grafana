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

/// Socket implementation of [TTransport].
///
/// For example:
///
///     var transport = new TClientSocketTransport(new TWebSocket(url));
///     var protocol = new TBinaryProtocol(transport);
///     var client = new MyThriftServiceClient(protocol);
///     var result = client.myMethod();
///
/// Adapted from the JS WebSocket transport.
abstract class TSocketTransport extends TBufferedTransport {
  final Logger logger = new Logger('thrift.TSocketTransport');

  final TSocket socket;

  /// A transport using the provided [socket].
  TSocketTransport(this.socket) {
    if (socket == null) {
      throw new ArgumentError.notNull('socket');
    }

    socket.onError.listen((e) => logger.warning(e));
    socket.onMessage.listen(handleIncomingMessage);
  }

  bool get isOpen => socket.isOpen;

  Future open() {
    _reset(isOpen: true);
    return socket.open();
  }

  Future close() {
    _reset(isOpen: false);
    return socket.close();
  }

  /// Make an incoming message available to read from the transport.
  void handleIncomingMessage(Uint8List messageBytes) {
    _setReadBuffer(messageBytes);
  }
}

/// [TClientSocketTransport] is a basic client socket transport.  It sends
/// outgoing messages and expects a response.
///
/// NOTE: This transport expects a single threaded server, as it will process
/// responses in FIFO order.
class TClientSocketTransport extends TSocketTransport {
  final List<Completer<Uint8List>> _completers = [];

  TClientSocketTransport(TSocket socket) : super(socket);

  Future flush() {
    Uint8List bytes = consumeWriteBuffer();

    // Use a sync completer to ensure that the buffer can be read immediately
    // after the read buffer is set, and avoid a race condition where another
    // response could overwrite the read buffer.
    var completer = new Completer<Uint8List>.sync();
    _completers.add(completer);

    socket.send(bytes);

    return completer.future;
  }

  void handleIncomingMessage(Uint8List messageBytes) {
    super.handleIncomingMessage(messageBytes);

    if (_completers.isNotEmpty) {
      var completer = _completers.removeAt(0);
      completer.complete();
    }
  }
}

/// [TAsyncClientSocketTransport] sends outgoing messages and expects an
/// asynchronous response.
///
/// NOTE: This transport uses a [MessageReader] to read a [TMessage] when an
/// incoming message arrives to correlate a response to a request, using the
/// seqid.
class TAsyncClientSocketTransport extends TSocketTransport {
  static const defaultTimeout = const Duration(seconds: 30);

  final Map<int, Completer<Uint8List>> _completers = {};

  final TMessageReader messageReader;

  final Duration responseTimeout;

  TAsyncClientSocketTransport(TSocket socket, TMessageReader messageReader,
      {Duration responseTimeout: defaultTimeout})
      : this.messageReader = messageReader,
        this.responseTimeout = responseTimeout,
        super(socket);

  Future flush() {
    Uint8List bytes = consumeWriteBuffer();
    TMessage message = messageReader.readMessage(bytes);
    int seqid = message.seqid;

    // Use a sync completer to ensure that the buffer can be read immediately
    // after the read buffer is set, and avoid a race condition where another
    // response could overwrite the read buffer.
    var completer = new Completer<Uint8List>.sync();
    _completers[seqid] = completer;

    if (responseTimeout != null) {
      new Future.delayed(responseTimeout, () {
        var completer = _completers.remove(seqid);
        if (completer != null) {
          completer.completeError(
              new TimeoutException("Response timed out.", responseTimeout));
        }
      });
    }

    socket.send(bytes);

    return completer.future;
  }

  void handleIncomingMessage(Uint8List messageBytes) {
    super.handleIncomingMessage(messageBytes);

    TMessage message = messageReader.readMessage(messageBytes);
    var completer = _completers.remove(message.seqid);
    if (completer != null) {
      completer.complete();
    }
  }
}

/// [TServerSocketTransport] listens for incoming messages.  When it sends a
/// response, it does not expect an acknowledgement.
class TServerSocketTransport extends TSocketTransport {
  final StreamController _onIncomingMessageController;
  Stream get onIncomingMessage => _onIncomingMessageController.stream;

  TServerSocketTransport(TSocket socket)
      : _onIncomingMessageController = new StreamController.broadcast(),
        super(socket);

  Future flush() async {
    Uint8List message = consumeWriteBuffer();
    socket.send(message);
  }

  void handleIncomingMessage(Uint8List messageBytes) {
    super.handleIncomingMessage(messageBytes);

    _onIncomingMessageController.add(null);
  }
}
