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

#include <thrift/qt/TQIODeviceTransport.h>

#include <QAbstractSocket>
#include <QIODevice>

#include <thrift/transport/TBufferTransports.h>

using boost::shared_ptr;

namespace apache {
namespace thrift {
namespace transport {

TQIODeviceTransport::TQIODeviceTransport(shared_ptr<QIODevice> dev) : dev_(dev) {
}

TQIODeviceTransport::~TQIODeviceTransport() {
  dev_->close();
}

void TQIODeviceTransport::open() {
  if (!isOpen()) {
    throw TTransportException(TTransportException::NOT_OPEN,
                              "open(): underlying QIODevice isn't open");
  }
}

bool TQIODeviceTransport::isOpen() {
  return dev_->isOpen();
}

bool TQIODeviceTransport::peek() {
  return dev_->bytesAvailable() > 0;
}

void TQIODeviceTransport::close() {
  dev_->close();
}

uint32_t TQIODeviceTransport::readAll(uint8_t* buf, uint32_t len) {
  uint32_t requestLen = len;
  while (len) {
    uint32_t readSize;
    try {
      readSize = read(buf, len);
    } catch (...) {
      if (len != requestLen) {
        // something read already
        return requestLen - len;
      }
      // error but nothing read yet
      throw;
    }
    if (readSize == 0) {
      dev_->waitForReadyRead(50);
    } else {
      buf += readSize;
      len -= readSize;
    }
  }
  return requestLen;
}

uint32_t TQIODeviceTransport::read(uint8_t* buf, uint32_t len) {
  uint32_t actualSize;
  qint64 readSize;

  if (!dev_->isOpen()) {
    throw TTransportException(TTransportException::NOT_OPEN,
                              "read(): underlying QIODevice is not open");
  }

  actualSize = (uint32_t)std::min((qint64)len, dev_->bytesAvailable());
  readSize = dev_->read(reinterpret_cast<char*>(buf), actualSize);

  if (readSize < 0) {
    QAbstractSocket* socket;
    if ((socket = qobject_cast<QAbstractSocket*>(dev_.get()))) {
      throw TTransportException(TTransportException::UNKNOWN,
                                "Failed to read() from QAbstractSocket",
                                socket->error());
    }
    throw TTransportException(TTransportException::UNKNOWN, "Failed to read from from QIODevice");
  }

  return (uint32_t)readSize;
}

void TQIODeviceTransport::write(const uint8_t* buf, uint32_t len) {
  while (len) {
    uint32_t written = write_partial(buf, len);
    len -= written;
    dev_->waitForBytesWritten(50);
  }
}

uint32_t TQIODeviceTransport::write_partial(const uint8_t* buf, uint32_t len) {
  qint64 written;

  if (!dev_->isOpen()) {
    throw TTransportException(TTransportException::NOT_OPEN,
                              "write_partial(): underlying QIODevice is not open");
  }

  written = dev_->write(reinterpret_cast<const char*>(buf), len);
  if (written < 0) {
    QAbstractSocket* socket;
    if ((socket = qobject_cast<QAbstractSocket*>(dev_.get()))) {
      throw TTransportException(TTransportException::UNKNOWN,
                                "write_partial(): failed to write to QAbstractSocket",
                                socket->error());
    }

    throw TTransportException(TTransportException::UNKNOWN,
                              "write_partial(): failed to write to underlying QIODevice");
  }

  return (uint32_t)written;
}

void TQIODeviceTransport::flush() {
  if (!dev_->isOpen()) {
    throw TTransportException(TTransportException::NOT_OPEN,
                              "flush(): underlying QIODevice is not open");
  }

  QAbstractSocket* socket;

  if ((socket = qobject_cast<QAbstractSocket*>(dev_.get()))) {
    socket->flush();
  } else {
    dev_->waitForBytesWritten(1);
  }
}

uint8_t* TQIODeviceTransport::borrow(uint8_t* buf, uint32_t* len) {
  (void)buf;
  (void)len;
  return NULL;
}

void TQIODeviceTransport::consume(uint32_t len) {
  (void)len;
  throw TTransportException(TTransportException::UNKNOWN);
}
}
}
} // apache::thrift::transport
