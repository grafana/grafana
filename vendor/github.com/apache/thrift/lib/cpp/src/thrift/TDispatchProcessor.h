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
#ifndef _THRIFT_TDISPATCHPROCESSOR_H_
#define _THRIFT_TDISPATCHPROCESSOR_H_ 1

#include <thrift/TProcessor.h>

namespace apache {
namespace thrift {

/**
 * TDispatchProcessor is a helper class to parse the message header then call
 * another function to dispatch based on the function name.
 *
 * Subclasses must implement dispatchCall() to dispatch on the function name.
 */
template <class Protocol_>
class TDispatchProcessorT : public TProcessor {
public:
  virtual bool process(boost::shared_ptr<protocol::TProtocol> in,
                       boost::shared_ptr<protocol::TProtocol> out,
                       void* connectionContext) {
    protocol::TProtocol* inRaw = in.get();
    protocol::TProtocol* outRaw = out.get();

    // Try to dynamic cast to the template protocol type
    Protocol_* specificIn = dynamic_cast<Protocol_*>(inRaw);
    Protocol_* specificOut = dynamic_cast<Protocol_*>(outRaw);
    if (specificIn && specificOut) {
      return processFast(specificIn, specificOut, connectionContext);
    }

    // Log the fact that we have to use the slow path
    T_GENERIC_PROTOCOL(this, inRaw, specificIn);
    T_GENERIC_PROTOCOL(this, outRaw, specificOut);

    std::string fname;
    protocol::TMessageType mtype;
    int32_t seqid;
    inRaw->readMessageBegin(fname, mtype, seqid);

    // If this doesn't look like a valid call, log an error and return false so
    // that the server will close the connection.
    //
    // (The old generated processor code used to try to skip a T_STRUCT and
    // continue.  However, that seems unsafe.)
    if (mtype != protocol::T_CALL && mtype != protocol::T_ONEWAY) {
      GlobalOutput.printf("received invalid message type %d from client", mtype);
      return false;
    }

    return this->dispatchCall(inRaw, outRaw, fname, seqid, connectionContext);
  }

protected:
  bool processFast(Protocol_* in, Protocol_* out, void* connectionContext) {
    std::string fname;
    protocol::TMessageType mtype;
    int32_t seqid;
    in->readMessageBegin(fname, mtype, seqid);

    if (mtype != protocol::T_CALL && mtype != protocol::T_ONEWAY) {
      GlobalOutput.printf("received invalid message type %d from client", mtype);
      return false;
    }

    return this->dispatchCallTemplated(in, out, fname, seqid, connectionContext);
  }

  /**
   * dispatchCall() methods must be implemented by subclasses
   */
  virtual bool dispatchCall(apache::thrift::protocol::TProtocol* in,
                            apache::thrift::protocol::TProtocol* out,
                            const std::string& fname,
                            int32_t seqid,
                            void* callContext) = 0;

  virtual bool dispatchCallTemplated(Protocol_* in,
                                     Protocol_* out,
                                     const std::string& fname,
                                     int32_t seqid,
                                     void* callContext) = 0;
};

/**
 * Non-templatized version of TDispatchProcessor, that doesn't bother trying to
 * perform a dynamic_cast.
 */
class TDispatchProcessor : public TProcessor {
public:
  virtual bool process(boost::shared_ptr<protocol::TProtocol> in,
                       boost::shared_ptr<protocol::TProtocol> out,
                       void* connectionContext) {
    std::string fname;
    protocol::TMessageType mtype;
    int32_t seqid;
    in->readMessageBegin(fname, mtype, seqid);

    if (mtype != protocol::T_CALL && mtype != protocol::T_ONEWAY) {
      GlobalOutput.printf("received invalid message type %d from client", mtype);
      return false;
    }

    return dispatchCall(in.get(), out.get(), fname, seqid, connectionContext);
  }

protected:
  virtual bool dispatchCall(apache::thrift::protocol::TProtocol* in,
                            apache::thrift::protocol::TProtocol* out,
                            const std::string& fname,
                            int32_t seqid,
                            void* callContext) = 0;
};

// Specialize TDispatchProcessorT for TProtocol and TDummyProtocol just to use
// the generic TDispatchProcessor.
template <>
class TDispatchProcessorT<protocol::TDummyProtocol> : public TDispatchProcessor {};
template <>
class TDispatchProcessorT<protocol::TProtocol> : public TDispatchProcessor {};
}
} // apache::thrift

#endif // _THRIFT_TDISPATCHPROCESSOR_H_
