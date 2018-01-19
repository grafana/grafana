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

#ifndef _THRIFT_TRANSPORT_TTRANSPORTEXCEPTION_H_
#define _THRIFT_TRANSPORT_TTRANSPORTEXCEPTION_H_ 1

#include <string>
#include <thrift/Thrift.h>

namespace apache {
namespace thrift {
namespace transport {

/**
 * Class to encapsulate all the possible types of transport errors that may
 * occur in various transport systems. This provides a sort of generic
 * wrapper around the vague UNIX E_ error codes that lets a common code
 * base of error handling to be used for various types of transports, i.e.
 * pipes etc.
 *
 */
class TTransportException : public apache::thrift::TException {
public:
  /**
   * Error codes for the various types of exceptions.
   */
  enum TTransportExceptionType {
    UNKNOWN = 0,
    NOT_OPEN = 1,
    TIMED_OUT = 2,
    END_OF_FILE = 3,
    INTERRUPTED = 4,
    BAD_ARGS = 5,
    CORRUPTED_DATA = 6,
    INTERNAL_ERROR = 7
  };

  TTransportException() : apache::thrift::TException(), type_(UNKNOWN) {}

  TTransportException(TTransportExceptionType type) : apache::thrift::TException(), type_(type) {}

  TTransportException(const std::string& message)
    : apache::thrift::TException(message), type_(UNKNOWN) {}

  TTransportException(TTransportExceptionType type, const std::string& message)
    : apache::thrift::TException(message), type_(type) {}

  TTransportException(TTransportExceptionType type, const std::string& message, int errno_copy)
    : apache::thrift::TException(message + ": " + TOutput::strerror_s(errno_copy)), type_(type) {}

  virtual ~TTransportException() throw() {}

  /**
   * Returns an error code that provides information about the type of error
   * that has occurred.
   *
   * @return Error code
   */
  TTransportExceptionType getType() const throw() { return type_; }

  virtual const char* what() const throw();

protected:
  /** Just like strerror_r but returns a C++ string object. */
  std::string strerror_s(int errno_copy);

  /** Error code */
  TTransportExceptionType type_;
};
}
}
} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_TTRANSPORTEXCEPTION_H_
