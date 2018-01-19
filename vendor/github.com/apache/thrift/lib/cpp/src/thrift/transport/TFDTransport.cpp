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

#include <cerrno>
#include <exception>

#include <thrift/transport/TFDTransport.h>
#include <thrift/transport/PlatformSocket.h>

#ifdef HAVE_UNISTD_H
#include <unistd.h>
#endif

#ifdef _WIN32
#include <io.h>
#endif

using namespace std;

namespace apache {
namespace thrift {
namespace transport {

void TFDTransport::close() {
  if (!isOpen()) {
    return;
  }

  int rv = ::THRIFT_CLOSE(fd_);
  int errno_copy = THRIFT_ERRNO;
  fd_ = -1;
  // Have to check uncaught_exception because this is called in the destructor.
  if (rv < 0 && !std::uncaught_exception()) {
    throw TTransportException(TTransportException::UNKNOWN, "TFDTransport::close()", errno_copy);
  }
}

uint32_t TFDTransport::read(uint8_t* buf, uint32_t len) {
  unsigned int maxRetries = 5; // same as the TSocket default
  unsigned int retries = 0;
  while (true) {
    THRIFT_SSIZET rv = ::THRIFT_READ(fd_, buf, len);
    if (rv < 0) {
      if (THRIFT_ERRNO == THRIFT_EINTR && retries < maxRetries) {
        // If interrupted, try again
        ++retries;
        continue;
      }
      int errno_copy = THRIFT_ERRNO;
      throw TTransportException(TTransportException::UNKNOWN, "TFDTransport::read()", errno_copy);
    }
    // this should be fine, since we already checked for negative values,
    // and ::read should only return a 32-bit value since len is 32-bit.
    return static_cast<uint32_t>(rv);
  }
}

void TFDTransport::write(const uint8_t* buf, uint32_t len) {
  while (len > 0) {
    THRIFT_SSIZET rv = ::THRIFT_WRITE(fd_, buf, len);

    if (rv < 0) {
      int errno_copy = THRIFT_ERRNO;
      throw TTransportException(TTransportException::UNKNOWN, "TFDTransport::write()", errno_copy);
    } else if (rv == 0) {
      throw TTransportException(TTransportException::END_OF_FILE, "TFDTransport::write()");
    }

    buf += rv;
    // this should be fine, as we've already checked for negative values, and
    //::write shouldn't return more than a uint32_t since len is a uint32_t
    len -= static_cast<uint32_t>(rv);
  }
}
}
}
} // apache::thrift::transport
