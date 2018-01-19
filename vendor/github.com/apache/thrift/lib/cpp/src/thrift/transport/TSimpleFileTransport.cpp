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

#include <thrift/thrift-config.h>

#include <thrift/transport/TSimpleFileTransport.h>

#include <sys/types.h>
#ifdef HAVE_SYS_STAT_H
#include <sys/stat.h>
#endif
#include <fcntl.h>

#ifdef _WIN32
#include <io.h>
#endif

namespace apache {
namespace thrift {
namespace transport {

TSimpleFileTransport::TSimpleFileTransport(const std::string& path, bool read, bool write)
  : TFDTransport(-1, TFDTransport::CLOSE_ON_DESTROY) {
  int flags = 0;
  if (read && write) {
    flags = O_RDWR;
  } else if (read) {
    flags = O_RDONLY;
  } else if (write) {
    flags = O_WRONLY;
  } else {
    throw TTransportException("Neither READ nor WRITE specified");
  }
  if (write) {
    flags |= O_CREAT | O_APPEND;
  }
#ifndef _WIN32
  mode_t mode = S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH;
#else
  int mode = _S_IREAD | _S_IWRITE;
#endif
  int fd = ::THRIFT_OPEN(path.c_str(), flags, mode);
  if (fd < 0) {
    throw TTransportException("failed to open file for writing: " + path);
  }
  setFD(fd);
  open();
}
}
}
} // apache::thrift::transport
