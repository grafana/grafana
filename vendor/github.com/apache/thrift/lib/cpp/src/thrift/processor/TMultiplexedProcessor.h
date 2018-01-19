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

#ifndef THRIFT_TMULTIPLEXEDPROCESSOR_H_
#define THRIFT_TMULTIPLEXEDPROCESSOR_H_ 1

#include <thrift/protocol/TProtocolDecorator.h>
#include <thrift/TApplicationException.h>
#include <thrift/TProcessor.h>
#include <boost/tokenizer.hpp>

namespace apache {
namespace thrift {
using boost::shared_ptr;

namespace protocol {

/**
 *  To be able to work with any protocol, we needed
 *  to allow them to call readMessageBegin() and get a TMessage in exactly
 *  the standard format, without the service name prepended to TMessage.name.
 */
class StoredMessageProtocol : public TProtocolDecorator {
public:
  StoredMessageProtocol(shared_ptr<protocol::TProtocol> _protocol,
                        const std::string& _name,
                        const TMessageType _type,
                        const int32_t _seqid)
    : TProtocolDecorator(_protocol), name(_name), type(_type), seqid(_seqid) {}

  uint32_t readMessageBegin_virt(std::string& _name, TMessageType& _type, int32_t& _seqid) {

    _name = name;
    _type = type;
    _seqid = seqid;

    return 0; // (Normal TProtocol read functions return number of bytes read)
  }

  std::string name;
  TMessageType type;
  int32_t seqid;
};
} // namespace protocol

/**
 * <code>TMultiplexedProcessor</code> is a <code>TProcessor</code> allowing
 * a single <code>TServer</code> to provide multiple services.
 *
 * <p>To do so, you instantiate the processor and then register additional
 * processors with it, as shown in the following example:</p>
 *
 * <blockquote><code>
 *     shared_ptr<TMultiplexedProcessor> processor(new TMultiplexedProcessor());
 *
 *     processor->registerProcessor(
 *         "Calculator",
 *         shared_ptr<TProcessor>( new CalculatorProcessor(
 *             shared_ptr<CalculatorHandler>( new CalculatorHandler()))));
 *
 *     processor->registerProcessor(
 *         "WeatherReport",
 *         shared_ptr<TProcessor>( new WeatherReportProcessor(
 *             shared_ptr<WeatherReportHandler>( new WeatherReportHandler()))));
 *
 *     shared_ptr<TServerTransport> transport(new TServerSocket(9090));
 *     TSimpleServer server(processor, transport);
 *
 *     server.serve();
 * </code></blockquote>
 */
class TMultiplexedProcessor : public TProcessor {
public:
  typedef std::map<std::string, shared_ptr<TProcessor> > services_t;

  /**
    * 'Register' a service with this <code>TMultiplexedProcessor</code>.  This
    * allows us to broker requests to individual services by using the service
    * name to select them at request time.
    *
    * \param [in] serviceName Name of a service, has to be identical to the name
    *                         declared in the Thrift IDL, e.g. "WeatherReport".
    * \param [in] processor   Implementation of a service, usually referred to
    *                         as "handlers", e.g. WeatherReportHandler,
    *                         implementing WeatherReportIf interface.
    */
  void registerProcessor(const std::string& serviceName, shared_ptr<TProcessor> processor) {
    services[serviceName] = processor;
  }

  /**
   * This implementation of <code>process</code> performs the following steps:
   *
   * <ol>
   *     <li>Read the beginning of the message.</li>
   *     <li>Extract the service name from the message.</li>
   *     <li>Using the service name to locate the appropriate processor.</li>
   *     <li>Dispatch to the processor, with a decorated instance of TProtocol
   *         that allows readMessageBegin() to return the original TMessage.</li>
   * </ol>
   *
   * \throws TException If the message type is not T_CALL or T_ONEWAY, if
   * the service name was not found in the message, or if the service
   * name was not found in the service map.
   */
  bool process(shared_ptr<protocol::TProtocol> in,
               shared_ptr<protocol::TProtocol> out,
               void* connectionContext) {
    std::string name;
    protocol::TMessageType type;
    int32_t seqid;

    // Use the actual underlying protocol (e.g. TBinaryProtocol) to read the
    // message header.  This pulls the message "off the wire", which we'll
    // deal with at the end of this method.
    in->readMessageBegin(name, type, seqid);

    if (type != protocol::T_CALL && type != protocol::T_ONEWAY) {
      // Unexpected message type.
      in->skip(::apache::thrift::protocol::T_STRUCT);
      in->readMessageEnd();
      in->getTransport()->readEnd();
      const std::string msg("TMultiplexedProcessor: Unexpected message type");
      ::apache::thrift::TApplicationException
          x(::apache::thrift::TApplicationException::PROTOCOL_ERROR, msg);
      out->writeMessageBegin(name, ::apache::thrift::protocol::T_EXCEPTION, seqid);
      x.write(out.get());
      out->writeMessageEnd();
      out->getTransport()->writeEnd();
      out->getTransport()->flush();
      throw TException(msg);
    }

    // Extract the service name

    boost::tokenizer<boost::char_separator<char> > tok(name, boost::char_separator<char>(":"));

    std::vector<std::string> tokens;
    std::copy(tok.begin(), tok.end(), std::back_inserter(tokens));

    // A valid message should consist of two tokens: the service
    // name and the name of the method to call.
    if (tokens.size() == 2) {
      // Search for a processor associated with this service name.
      services_t::iterator it = services.find(tokens[0]);

      if (it != services.end()) {
        shared_ptr<TProcessor> processor = it->second;
        // Let the processor registered for this service name
        // process the message.
        return processor
            ->process(shared_ptr<protocol::TProtocol>(
                          new protocol::StoredMessageProtocol(in, tokens[1], type, seqid)),
                      out,
                      connectionContext);
      } else {
        // Unknown service.
        in->skip(::apache::thrift::protocol::T_STRUCT);
        in->readMessageEnd();
        in->getTransport()->readEnd();

        std::string msg("TMultiplexedProcessor: Unknown service: ");
        msg += tokens[0];
        ::apache::thrift::TApplicationException
            x(::apache::thrift::TApplicationException::PROTOCOL_ERROR, msg);
        out->writeMessageBegin(name, ::apache::thrift::protocol::T_EXCEPTION, seqid);
        x.write(out.get());
        out->writeMessageEnd();
        out->getTransport()->writeEnd();
        out->getTransport()->flush();
        msg += ". Did you forget to call registerProcessor()?";
        throw TException(msg);
      }
    }
    return false;
  }

private:
  /** Map of service processor objects, indexed by service names. */
  services_t services;
};
}
}

#endif // THRIFT_TMULTIPLEXEDPROCESSOR_H_
