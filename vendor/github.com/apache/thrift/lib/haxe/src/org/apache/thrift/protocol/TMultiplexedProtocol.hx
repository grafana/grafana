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
 */

package org.apache.thrift.protocol;

import org.apache.thrift.transport.TTransport;


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
class TMultiplexedProtocol extends TProtocolDecorator {

    /** Used to delimit the service name from the function name */
    public static inline var SEPARATOR : String = ":";

    private var service : String;

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
    public function new( protocol : TProtocol, serviceName : String)    {
        super( protocol);
        service = serviceName;
    }

    /**
     * Prepends the service name to the function name, separated by TMultiplexedProtocol.SEPARATOR.
     * Args:
     *   tMessage     The original message.
     */
    public override function writeMessageBegin( message : TMessage) : Void {
        switch( message.type)
        {
            case TMessageType.CALL:
                super.writeMessageBegin(new TMessage(
                    service + SEPARATOR + message.name,
                    message.type,
                    message.seqid));

            case TMessageType.ONEWAY:
                super.writeMessageBegin(new TMessage(
                    service + SEPARATOR + message.name,
                    message.type,
                    message.seqid));

            default:
                super.writeMessageBegin(message);
        }
    }
}

