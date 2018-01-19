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

#ifndef THRIFT_TMULTIPLEXEDPROTOCOL_H_
#define THRIFT_TMULTIPLEXEDPROTOCOL_H_ 1

#include <thrift/protocol/TProtocolDecorator.h>

namespace apache {
namespace thrift {
namespace protocol {
using boost::shared_ptr;

/**
 * <code>TMultiplexedProtocol</code> is a protocol-independent concrete decorator
 * that allows a Thrift client to communicate with a multiplexing Thrift server,
 * by prepending the service name to the function name during function calls.
 *
 * \note THIS IS NOT USED BY SERVERS.  On the server, use
 * {@link apache::thrift::TMultiplexedProcessor TMultiplexedProcessor} to handle requests
 * from a multiplexing client.
 *
 * This example uses a single socket transport to invoke two services:
 *
 * <blockquote><code>
 *     shared_ptr<TSocket> transport(new TSocket("localhost", 9090));
 *     transport->open();
 *
 *     shared_ptr<TBinaryProtocol> protocol(new TBinaryProtocol(transport));
 *
 *     shared_ptr<TMultiplexedProtocol> mp1(new TMultiplexedProtocol(protocol, "Calculator"));
 *     shared_ptr<CalculatorClient> service1(new CalculatorClient(mp1));
 *
 *     shared_ptr<TMultiplexedProtocol> mp2(new TMultiplexedProtocol(protocol, "WeatherReport"));
 *     shared_ptr<WeatherReportClient> service2(new WeatherReportClient(mp2));
 *
 *     service1->add(2,2);
 *     int temp = service2->getTemperature();
 * </code></blockquote>
 *
 * @see apache::thrift::protocol::TProtocolDecorator
 */
class TMultiplexedProtocol : public TProtocolDecorator {
public:
  /**
   * Wrap the specified protocol, allowing it to be used to communicate with a
   * multiplexing server.  The <code>serviceName</code> is required as it is
   * prepended to the message header so that the multiplexing server can broker
   * the function call to the proper service.
   *
   * \param _protocol    Your communication protocol of choice, e.g. <code>TBinaryProtocol</code>.
   * \param _serviceName The service name of the service communicating via this protocol.
   */
  TMultiplexedProtocol(shared_ptr<TProtocol> _protocol, const std::string& _serviceName)
    : TProtocolDecorator(_protocol), serviceName(_serviceName), separator(":") {}
  virtual ~TMultiplexedProtocol() {}

  /**
   * Prepends the service name to the function name, separated by TMultiplexedProtocol::SEPARATOR.
   *
   * \param [in] _name   The name of the method to be called in the service.
   * \param [in] _type   The type of message
   * \param [in] _name   The sequential id of the message
   *
   * \throws TException  Passed through from wrapped <code>TProtocol</code> instance.
   */
  uint32_t writeMessageBegin_virt(const std::string& _name,
                                  const TMessageType _type,
                                  const int32_t _seqid);

private:
  const std::string serviceName;
  const std::string separator;
};
}
}
}

#endif // THRIFT_TMULTIPLEXEDPROTOCOL_H_
