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

#include <thrift/processor/PeekProcessor.h>

using namespace apache::thrift::transport;
using namespace apache::thrift::protocol;
using namespace apache::thrift;

namespace apache {
namespace thrift {
namespace processor {

PeekProcessor::PeekProcessor() {
  memoryBuffer_.reset(new TMemoryBuffer());
  targetTransport_ = memoryBuffer_;
}
PeekProcessor::~PeekProcessor() {
}

void PeekProcessor::initialize(boost::shared_ptr<TProcessor> actualProcessor,
                               boost::shared_ptr<TProtocolFactory> protocolFactory,
                               boost::shared_ptr<TPipedTransportFactory> transportFactory) {
  actualProcessor_ = actualProcessor;
  pipedProtocol_ = protocolFactory->getProtocol(targetTransport_);
  transportFactory_ = transportFactory;
  transportFactory_->initializeTargetTransport(targetTransport_);
}

boost::shared_ptr<TTransport> PeekProcessor::getPipedTransport(boost::shared_ptr<TTransport> in) {
  return transportFactory_->getTransport(in);
}

void PeekProcessor::setTargetTransport(boost::shared_ptr<TTransport> targetTransport) {
  targetTransport_ = targetTransport;
  if (boost::dynamic_pointer_cast<TMemoryBuffer>(targetTransport_)) {
    memoryBuffer_ = boost::dynamic_pointer_cast<TMemoryBuffer>(targetTransport);
  } else if (boost::dynamic_pointer_cast<TPipedTransport>(targetTransport_)) {
    memoryBuffer_ = boost::dynamic_pointer_cast<TMemoryBuffer>(
        boost::dynamic_pointer_cast<TPipedTransport>(targetTransport_)->getTargetTransport());
  }

  if (!memoryBuffer_) {
    throw TException(
        "Target transport must be a TMemoryBuffer or a TPipedTransport with TMemoryBuffer");
  }
}

bool PeekProcessor::process(boost::shared_ptr<TProtocol> in,
                            boost::shared_ptr<TProtocol> out,
                            void* connectionContext) {

  std::string fname;
  TMessageType mtype;
  int32_t seqid;
  in->readMessageBegin(fname, mtype, seqid);

  if (mtype != T_CALL && mtype != T_ONEWAY) {
    throw TException("Unexpected message type");
  }

  // Peek at the name
  peekName(fname);

  TType ftype;
  int16_t fid;
  while (true) {
    in->readFieldBegin(fname, ftype, fid);
    if (ftype == T_STOP) {
      break;
    }

    // Peek at the variable
    peek(in, ftype, fid);
    in->readFieldEnd();
  }
  in->readMessageEnd();
  in->getTransport()->readEnd();

  //
  // All the data is now in memoryBuffer_ and ready to be processed
  //

  // Let's first take a peek at the full data in memory
  uint8_t* buffer;
  uint32_t size;
  memoryBuffer_->getBuffer(&buffer, &size);
  peekBuffer(buffer, size);

  // Done peeking at variables
  peekEnd();

  bool ret = actualProcessor_->process(pipedProtocol_, out, connectionContext);
  memoryBuffer_->resetBuffer();
  return ret;
}

void PeekProcessor::peekName(const std::string& fname) {
  (void)fname;
}

void PeekProcessor::peekBuffer(uint8_t* buffer, uint32_t size) {
  (void)buffer;
  (void)size;
}

void PeekProcessor::peek(boost::shared_ptr<TProtocol> in, TType ftype, int16_t fid) {
  (void)fid;
  in->skip(ftype);
}

void PeekProcessor::peekEnd() {
}
}
}
}
