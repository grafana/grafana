/**
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
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

using System;
using System.Text;
using Thrift.Transport;
using System.Collections.Generic;

namespace Thrift.Protocol
{

    /**
     * TMultiplexedProtocol is a protocol-independent concrete decorator that allows a Thrift
     * client to communicate with a multiplexing Thrift server, by prepending the service name
     * to the function name during function calls.
     *
     * NOTE: THIS IS NOT TO BE USED BY SERVERS.
     * On the server, use TMultiplexedProcessor to handle requests from a multiplexing client.
     *
     * This example uses a single socket transport to invoke two services:
     *
     *     TSocket transport = new TSocket("localhost", 9090);
     *     transport.open();
     *
     *     TBinaryProtocol protocol = new TBinaryProtocol(transport);
     *
     *     TMultiplexedProtocol mp = new TMultiplexedProtocol(protocol, "Calculator");
     *     Calculator.Client service = new Calculator.Client(mp);
     *
     *     TMultiplexedProtocol mp2 = new TMultiplexedProtocol(protocol, "WeatherReport");
     *     WeatherReport.Client service2 = new WeatherReport.Client(mp2);
     *
     *     System.out.println(service.add(2,2));
     *     System.out.println(service2.getTemperature());
     *
     */
    public class TMultiplexedProtocol : TProtocolDecorator
    {

        /** Used to delimit the service name from the function name */
        public static String SEPARATOR = ":";

        private String ServiceName;

        /**
         * Wrap the specified protocol, allowing it to be used to communicate with a
         * multiplexing server.  The <code>serviceName</code> is required as it is
         * prepended to the message header so that the multiplexing server can broker
         * the function call to the proper service.
         *
         * Args:
         *  protocol        Your communication protocol of choice, e.g. TBinaryProtocol
         *  serviceName     The service name of the service communicating via this protocol.
         */
        public TMultiplexedProtocol(TProtocol protocol, String serviceName)
            : base(protocol)
        {
            ServiceName = serviceName;
        }

        /**
         * Prepends the service name to the function name, separated by TMultiplexedProtocol.SEPARATOR.
         * Args:
         *   tMessage     The original message.
         */
        public override void WriteMessageBegin(TMessage tMessage)
        {
            switch(tMessage.Type)
            {
                case TMessageType.Call:
                case TMessageType.Oneway:
                    base.WriteMessageBegin(new TMessage(
                        ServiceName + SEPARATOR + tMessage.Name,
                        tMessage.Type,
                        tMessage.SeqID));
                    break;

                default:
                    base.WriteMessageBegin(tMessage);
                    break;
            }
        }
    }

}
