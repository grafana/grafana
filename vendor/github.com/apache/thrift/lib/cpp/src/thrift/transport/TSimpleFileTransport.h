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

#ifndef _THRIFT_TRANSPORT_TSIMPLEFILETRANSPORT_H_
#define _THRIFT_TRANSPORT_TSIMPLEFILETRANSPORT_H_ 1

#include <thrift/transport/TFDTransport.h>

namespace apache {
namespace thrift {
namespace transport {

/**
 * Dead-simple wrapper around a file.
 *
 * Writeable files are opened with O_CREAT and O_APPEND
 */
class TSimpleFileTransport : public TFDTransport {
public:
  TSimpleFileTransport(const std::string& path, bool read = true, bool write = false);
};
}
}
} // apache::thrift::transport

#endif //  _THRIFT_TRANSPORT_TSIMPLEFILETRANSPORT_H_
