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

#include <thrift/qt/TQTcpServer.h>
#include <thrift/qt/TQIODeviceTransport.h>

#include <QMetaType>
#include <QTcpSocket>

#include <thrift/cxxfunctional.h>

#include <thrift/protocol/TProtocol.h>
#include <thrift/async/TAsyncProcessor.h>

using boost::shared_ptr;
using apache::thrift::protocol::TProtocol;
using apache::thrift::protocol::TProtocolFactory;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;
using apache::thrift::transport::TQIODeviceTransport;
using apache::thrift::stdcxx::function;
using apache::thrift::stdcxx::bind;

QT_USE_NAMESPACE

namespace apache {
namespace thrift {
namespace async {

struct TQTcpServer::ConnectionContext {
  shared_ptr<QTcpSocket> connection_;
  shared_ptr<TTransport> transport_;
  shared_ptr<TProtocol> iprot_;
  shared_ptr<TProtocol> oprot_;

  explicit ConnectionContext(shared_ptr<QTcpSocket> connection,
                             shared_ptr<TTransport> transport,
                             shared_ptr<TProtocol> iprot,
                             shared_ptr<TProtocol> oprot)
    : connection_(connection), transport_(transport), iprot_(iprot), oprot_(oprot) {}
};

TQTcpServer::TQTcpServer(shared_ptr<QTcpServer> server,
                         shared_ptr<TAsyncProcessor> processor,
                         shared_ptr<TProtocolFactory> pfact,
                         QObject* parent)
  : QObject(parent), server_(server), processor_(processor), pfact_(pfact) {
  qRegisterMetaType<QTcpSocket*>("QTcpSocket*");
  connect(server.get(), SIGNAL(newConnection()), SLOT(processIncoming()));
}

TQTcpServer::~TQTcpServer() {
}

void TQTcpServer::processIncoming() {
  while (server_->hasPendingConnections()) {
    // take ownership of the QTcpSocket; technically it could be deleted
    // when the QTcpServer is destroyed, but any real app should delete this
    // class before deleting the QTcpServer that we are using
    shared_ptr<QTcpSocket> connection(server_->nextPendingConnection());

    shared_ptr<TTransport> transport;
    shared_ptr<TProtocol> iprot;
    shared_ptr<TProtocol> oprot;

    try {
      transport = shared_ptr<TTransport>(new TQIODeviceTransport(connection));
      iprot = shared_ptr<TProtocol>(pfact_->getProtocol(transport));
      oprot = shared_ptr<TProtocol>(pfact_->getProtocol(transport));
    } catch (...) {
      qWarning("[TQTcpServer] Failed to initialize transports/protocols");
      continue;
    }

    ctxMap_[connection.get()]
        = shared_ptr<ConnectionContext>(new ConnectionContext(connection, transport, iprot, oprot));

    connect(connection.get(), SIGNAL(readyRead()), SLOT(beginDecode()));

    connect(connection.get(), SIGNAL(disconnected()), SLOT(socketClosed()));
  }
}

void TQTcpServer::beginDecode() {
  QTcpSocket* connection(qobject_cast<QTcpSocket*>(sender()));
  Q_ASSERT(connection);

  if (ctxMap_.find(connection) == ctxMap_.end()) {
    qWarning("[TQTcpServer] Got data on an unknown QTcpSocket");
    return;
  }

  shared_ptr<ConnectionContext> ctx = ctxMap_[connection];

  try {
    processor_
        ->process(bind(&TQTcpServer::finish, this, ctx, apache::thrift::stdcxx::placeholders::_1),
                  ctx->iprot_,
                  ctx->oprot_);
  } catch (const TTransportException& ex) {
    qWarning("[TQTcpServer] TTransportException during processing: '%s'", ex.what());
    scheduleDeleteConnectionContext(connection);
  } catch (...) {
    qWarning("[TQTcpServer] Unknown processor exception");
    scheduleDeleteConnectionContext(connection);
  }
}

void TQTcpServer::socketClosed() {
  QTcpSocket* connection(qobject_cast<QTcpSocket*>(sender()));
  Q_ASSERT(connection);
  scheduleDeleteConnectionContext(connection);
}

void TQTcpServer::deleteConnectionContext(QTcpSocket* connection) {
  const ConnectionContextMap::size_type deleted = ctxMap_.erase(connection);
  if (0 == deleted) {
      qWarning("[TQTcpServer] Unknown QTcpSocket");
  }
}

void TQTcpServer::scheduleDeleteConnectionContext(QTcpSocket* connection) {
  QMetaObject::invokeMethod(this, "deleteConnectionContext", Qt::QueuedConnection, Q_ARG(QTcpSocket*, connection));
}

void TQTcpServer::finish(shared_ptr<ConnectionContext> ctx, bool healthy) {
  if (!healthy) {
    qWarning("[TQTcpServer] Processor failed to process data successfully");
    deleteConnectionContext(ctx->connection_.get());
  }
}
}
}
} // apache::thrift::async
