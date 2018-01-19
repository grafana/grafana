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

#include <cstdlib>
#include <sstream>
#include <iostream>

#include <thrift/transport/THttpServer.h>
#include <thrift/transport/TSocket.h>
#if defined(_MSC_VER) || defined(__MINGW32__)
  #include <Shlwapi.h>
#endif

namespace apache {
namespace thrift {
namespace transport {

using namespace std;

THttpServer::THttpServer(boost::shared_ptr<TTransport> transport) : THttpTransport(transport) {
}

THttpServer::~THttpServer() {
}

#if defined(_MSC_VER) || defined(__MINGW32__)
  #define THRIFT_strncasecmp(str1, str2, len) _strnicmp(str1, str2, len)
  #define THRIFT_strcasestr(haystack, needle) StrStrIA(haystack, needle)
#else
  #define THRIFT_strncasecmp(str1, str2, len) strncasecmp(str1, str2, len)
  #define THRIFT_strcasestr(haystack, needle) strcasestr(haystack, needle)
#endif

void THttpServer::parseHeader(char* header) {
  char* colon = strchr(header, ':');
  if (colon == NULL) {
    return;
  }
  size_t sz = colon - header;
  char* value = colon + 1;

  if (THRIFT_strncasecmp(header, "Transfer-Encoding", sz) == 0) {
    if (THRIFT_strcasestr(value, "chunked") != NULL) {
      chunked_ = true;
    }
  } else if (THRIFT_strncasecmp(header, "Content-length", sz) == 0) {
    chunked_ = false;
    contentLength_ = atoi(value);
  } else if (strncmp(header, "X-Forwarded-For", sz) == 0) {
    origin_ = value;
  }
}

bool THttpServer::parseStatusLine(char* status) {
  char* method = status;

  char* path = strchr(method, ' ');
  if (path == NULL) {
    throw TTransportException(string("Bad Status: ") + status);
  }

  *path = '\0';
  while (*(++path) == ' ') {
  };

  char* http = strchr(path, ' ');
  if (http == NULL) {
    throw TTransportException(string("Bad Status: ") + status);
  }
  *http = '\0';

  if (strcmp(method, "POST") == 0) {
    // POST method ok, looking for content.
    return true;
  } else if (strcmp(method, "OPTIONS") == 0) {
    // preflight OPTIONS method, we don't need further content.
    // how to graciously close connection?
    uint8_t* buf;
    uint32_t len;
    writeBuffer_.getBuffer(&buf, &len);

    // Construct the HTTP header
    std::ostringstream h;
    h << "HTTP/1.1 200 OK" << CRLF << "Date: " << getTimeRFC1123() << CRLF
      << "Access-Control-Allow-Origin: *" << CRLF << "Access-Control-Allow-Methods: POST, OPTIONS"
      << CRLF << "Access-Control-Allow-Headers: Content-Type" << CRLF << CRLF;
    string header = h.str();

    // Write the header, then the data, then flush
    transport_->write((const uint8_t*)header.c_str(), static_cast<uint32_t>(header.size()));
    transport_->write(buf, len);
    transport_->flush();

    // Reset the buffer and header variables
    writeBuffer_.resetBuffer();
    readHeaders_ = true;
    return true;
  }
  throw TTransportException(string("Bad Status (unsupported method): ") + status);
}

void THttpServer::flush() {
  // Fetch the contents of the write buffer
  uint8_t* buf;
  uint32_t len;
  writeBuffer_.getBuffer(&buf, &len);

  // Construct the HTTP header
  std::ostringstream h;
  h << "HTTP/1.1 200 OK" << CRLF << "Date: " << getTimeRFC1123() << CRLF << "Server: Thrift/"
    << VERSION << CRLF << "Access-Control-Allow-Origin: *" << CRLF
    << "Content-Type: application/x-thrift" << CRLF << "Content-Length: " << len << CRLF
    << "Connection: Keep-Alive" << CRLF << CRLF;
  string header = h.str();

  // Write the header, then the data, then flush
  // cast should be fine, because none of "header" is under attacker control
  transport_->write((const uint8_t*)header.c_str(), static_cast<uint32_t>(header.size()));
  transport_->write(buf, len);
  transport_->flush();

  // Reset the buffer and header variables
  writeBuffer_.resetBuffer();
  readHeaders_ = true;
}

std::string THttpServer::getTimeRFC1123() {
  static const char* Days[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  static const char* Months[]
      = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  char buff[128];
  time_t t = time(NULL);
  tm* broken_t = gmtime(&t);

  sprintf(buff,
          "%s, %d %s %d %d:%d:%d GMT",
          Days[broken_t->tm_wday],
          broken_t->tm_mday,
          Months[broken_t->tm_mon],
          broken_t->tm_year + 1900,
          broken_t->tm_hour,
          broken_t->tm_min,
          broken_t->tm_sec);
  return std::string(buff);
}
}
}
} // apache::thrift::transport
