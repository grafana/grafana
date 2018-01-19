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

#include <thrift/transport/TTransportException.h>
#include <boost/lexical_cast.hpp>
#include <cstring>

#include <thrift/thrift-config.h>

using std::string;
using boost::lexical_cast;

namespace apache {
namespace thrift {
namespace transport {

const char* TTransportException::what() const throw() {
  if (message_.empty()) {
    switch (type_) {
    case UNKNOWN:
      return "TTransportException: Unknown transport exception";
    case NOT_OPEN:
      return "TTransportException: Transport not open";
    case TIMED_OUT:
      return "TTransportException: Timed out";
    case END_OF_FILE:
      return "TTransportException: End of file";
    case INTERRUPTED:
      return "TTransportException: Interrupted";
    case BAD_ARGS:
      return "TTransportException: Invalid arguments";
    case CORRUPTED_DATA:
      return "TTransportException: Corrupted Data";
    case INTERNAL_ERROR:
      return "TTransportException: Internal error";
    default:
      return "TTransportException: (Invalid exception type)";
    }
  } else {
    return message_.c_str();
  }
}
}
}
} // apache::thrift::transport
