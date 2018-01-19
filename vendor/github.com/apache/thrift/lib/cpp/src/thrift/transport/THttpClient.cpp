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

#include <limits>
#include <cstdlib>
#include <sstream>
#include <boost/algorithm/string.hpp>

#include <thrift/transport/THttpClient.h>
#include <thrift/transport/TSocket.h>

namespace apache {
namespace thrift {
namespace transport {

using namespace std;

THttpClient::THttpClient(boost::shared_ptr<TTransport> transport,
                         std::string host,
                         std::string path)
  : THttpTransport(transport), host_(host), path_(path) {
}

THttpClient::THttpClient(string host, int port, string path)
  : THttpTransport(boost::shared_ptr<TTransport>(new TSocket(host, port))),
    host_(host),
    path_(path) {
}

THttpClient::~THttpClient() {
}

void THttpClient::parseHeader(char* header) {
  char* colon = strchr(header, ':');
  if (colon == NULL) {
    return;
  }
  char* value = colon + 1;

  if (boost::istarts_with(header, "Transfer-Encoding")) {
    if (boost::iends_with(value, "chunked")) {
      chunked_ = true;
    }
  } else if (boost::istarts_with(header, "Content-Length")) {
    chunked_ = false;
    contentLength_ = atoi(value);
  }
}

bool THttpClient::parseStatusLine(char* status) {
  char* http = status;

  char* code = strchr(http, ' ');
  if (code == NULL) {
    throw TTransportException(string("Bad Status: ") + status);
  }

  *code = '\0';
  while (*(code++) == ' ') {
  };

  char* msg = strchr(code, ' ');
  if (msg == NULL) {
    throw TTransportException(string("Bad Status: ") + status);
  }
  *msg = '\0';

  if (strcmp(code, "200") == 0) {
    // HTTP 200 = OK, we got the response
    return true;
  } else if (strcmp(code, "100") == 0) {
    // HTTP 100 = continue, just keep reading
    return false;
  } else {
    throw TTransportException(string("Bad Status: ") + status);
  }
}

void THttpClient::flush() {
  // Fetch the contents of the write buffer
  uint8_t* buf;
  uint32_t len;
  writeBuffer_.getBuffer(&buf, &len);

  // Construct the HTTP header
  std::ostringstream h;
  h << "POST " << path_ << " HTTP/1.1" << CRLF << "Host: " << host_ << CRLF
    << "Content-Type: application/x-thrift" << CRLF << "Content-Length: " << len << CRLF
    << "Accept: application/x-thrift" << CRLF << "User-Agent: Thrift/" << VERSION
    << " (C++/THttpClient)" << CRLF << CRLF;
  string header = h.str();

  if (header.size() > (std::numeric_limits<uint32_t>::max)())
    throw TTransportException("Header too big");
  // Write the header, then the data, then flush
  transport_->write((const uint8_t*)header.c_str(), static_cast<uint32_t>(header.size()));
  transport_->write(buf, len);
  transport_->flush();

  // Reset the buffer and header variables
  writeBuffer_.resetBuffer();
  readHeaders_ = true;
}
}
}
} // apache::thrift::transport
