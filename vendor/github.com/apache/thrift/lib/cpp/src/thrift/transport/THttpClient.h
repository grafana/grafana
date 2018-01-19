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

#ifndef _THRIFT_TRANSPORT_THTTPCLIENT_H_
#define _THRIFT_TRANSPORT_THTTPCLIENT_H_ 1

#include <thrift/transport/THttpTransport.h>

namespace apache {
namespace thrift {
namespace transport {

class THttpClient : public THttpTransport {
public:
  THttpClient(boost::shared_ptr<TTransport> transport, std::string host, std::string path = "");

  THttpClient(std::string host, int port, std::string path = "");

  virtual ~THttpClient();

  virtual void flush();

protected:
  std::string host_;
  std::string path_;

  virtual void parseHeader(char* header);
  virtual bool parseStatusLine(char* status);
};
}
}
} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_THTTPCLIENT_H_
