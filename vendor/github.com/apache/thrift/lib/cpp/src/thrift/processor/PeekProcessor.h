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

#ifndef PEEKPROCESSOR_H
#define PEEKPROCESSOR_H

#include <string>
#include <thrift/TProcessor.h>
#include <thrift/transport/TTransport.h>
#include <thrift/transport/TTransportUtils.h>
#include <thrift/transport/TBufferTransports.h>
#include <boost/shared_ptr.hpp>

namespace apache {
namespace thrift {
namespace processor {

/*
 * Class for peeking at the raw data that is being processed by another processor
 * and gives the derived class a chance to change behavior accordingly
 *
 */
class PeekProcessor : public apache::thrift::TProcessor {

public:
  PeekProcessor();
  virtual ~PeekProcessor();

  // Input here: actualProcessor  - the underlying processor
  //             protocolFactory  - the protocol factory used to wrap the memory buffer
  //             transportFactory - this TPipedTransportFactory is used to wrap the source transport
  //                                via a call to getPipedTransport
  void initialize(
      boost::shared_ptr<apache::thrift::TProcessor> actualProcessor,
      boost::shared_ptr<apache::thrift::protocol::TProtocolFactory> protocolFactory,
      boost::shared_ptr<apache::thrift::transport::TPipedTransportFactory> transportFactory);

  boost::shared_ptr<apache::thrift::transport::TTransport> getPipedTransport(
      boost::shared_ptr<apache::thrift::transport::TTransport> in);

  void setTargetTransport(boost::shared_ptr<apache::thrift::transport::TTransport> targetTransport);

  virtual bool process(boost::shared_ptr<apache::thrift::protocol::TProtocol> in,
                       boost::shared_ptr<apache::thrift::protocol::TProtocol> out,
                       void* connectionContext);

  // The following three functions can be overloaded by child classes to
  // achieve desired peeking behavior
  virtual void peekName(const std::string& fname);
  virtual void peekBuffer(uint8_t* buffer, uint32_t size);
  virtual void peek(boost::shared_ptr<apache::thrift::protocol::TProtocol> in,
                    apache::thrift::protocol::TType ftype,
                    int16_t fid);
  virtual void peekEnd();

private:
  boost::shared_ptr<apache::thrift::TProcessor> actualProcessor_;
  boost::shared_ptr<apache::thrift::protocol::TProtocol> pipedProtocol_;
  boost::shared_ptr<apache::thrift::transport::TPipedTransportFactory> transportFactory_;
  boost::shared_ptr<apache::thrift::transport::TMemoryBuffer> memoryBuffer_;
  boost::shared_ptr<apache::thrift::transport::TTransport> targetTransport_;
};
}
}
} // apache::thrift::processor

#endif
