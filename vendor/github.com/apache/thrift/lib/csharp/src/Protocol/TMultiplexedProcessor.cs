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
using System.IO;

namespace Thrift.Protocol
{

    /**
     * TMultiplexedProcessor is a TProcessor allowing a single TServer to provide multiple services.
     * To do so, you instantiate the processor and then register additional processors with it,
     * as shown in the following example:
     *
     *     TMultiplexedProcessor processor = new TMultiplexedProcessor();
     *
     *     processor.registerProcessor(
     *         "Calculator",
     *         new Calculator.Processor(new CalculatorHandler()));
     *
     *     processor.registerProcessor(
     *         "WeatherReport",
     *         new WeatherReport.Processor(new WeatherReportHandler()));
     *
     *     TServerTransport t = new TServerSocket(9090);
     *     TSimpleServer server = new TSimpleServer(processor, t);
     *
     *     server.serve();
     */
    public class TMultiplexedProcessor : TProcessor
    {
        private Dictionary<String,TProcessor> ServiceProcessorMap = new Dictionary<String,TProcessor>();

        /**
         * 'Register' a service with this TMultiplexedProcessor. This allows us to broker
         * requests to individual services by using the service name to select them at request time.
         *
         * Args:
         * - serviceName    Name of a service, has to be identical to the name
         *                  declared in the Thrift IDL, e.g. "WeatherReport".
         * - processor      Implementation of a service, usually referred to as "handlers",
         *                  e.g. WeatherReportHandler implementing WeatherReport.Iface.
         */
        public void RegisterProcessor(String serviceName, TProcessor processor)
        {
            ServiceProcessorMap.Add(serviceName, processor);
        }


        private void Fail( TProtocol oprot, TMessage message, TApplicationException.ExceptionType extype, string etxt)
        {
            TApplicationException appex = new TApplicationException( extype, etxt);

            TMessage newMessage = new TMessage(message.Name, TMessageType.Exception, message.SeqID);

            oprot.WriteMessageBegin(newMessage);
            appex.Write( oprot);
            oprot.WriteMessageEnd();
            oprot.Transport.Flush();
        }


        /**
         * This implementation of process performs the following steps:
         *
         * - Read the beginning of the message.
         * - Extract the service name from the message.
         * - Using the service name to locate the appropriate processor.
         * - Dispatch to the processor, with a decorated instance of TProtocol
         *    that allows readMessageBegin() to return the original TMessage.
         *
         * Throws an exception if
         * - the message type is not CALL or ONEWAY,
         * - the service name was not found in the message, or
         * - the service name has not been RegisterProcessor()ed.
         */
        public bool Process(TProtocol iprot, TProtocol oprot)
        {
            /*  Use the actual underlying protocol (e.g. TBinaryProtocol) to read the
                message header.  This pulls the message "off the wire", which we'll
                deal with at the end of this method. */

            try
            {
                TMessage message = iprot.ReadMessageBegin();

                if ((message.Type != TMessageType.Call) && (message.Type != TMessageType.Oneway))
                {
                    Fail(oprot, message,
                          TApplicationException.ExceptionType.InvalidMessageType,
                          "Message type CALL or ONEWAY expected");
                    return false;
                }

                // Extract the service name
                int index = message.Name.IndexOf(TMultiplexedProtocol.SEPARATOR);
                if (index < 0)
                {
                    Fail(oprot, message,
                          TApplicationException.ExceptionType.InvalidProtocol,
                          "Service name not found in message name: " + message.Name + ". " +
                          "Did you forget to use a TMultiplexProtocol in your client?");
                    return false;
                }

                // Create a new TMessage, something that can be consumed by any TProtocol
                string serviceName = message.Name.Substring(0, index);
                TProcessor actualProcessor;
                if (!ServiceProcessorMap.TryGetValue(serviceName, out actualProcessor))
                {
                    Fail(oprot, message,
                          TApplicationException.ExceptionType.InternalError,
                          "Service name not found: " + serviceName + ". " +
                          "Did you forget to call RegisterProcessor()?");
                    return false;
                }

                // Create a new TMessage, removing the service name
                TMessage newMessage = new TMessage(
                        message.Name.Substring(serviceName.Length + TMultiplexedProtocol.SEPARATOR.Length),
                        message.Type,
                        message.SeqID);

                // Dispatch processing to the stored processor
                return actualProcessor.Process(new StoredMessageProtocol(iprot, newMessage), oprot);

            }
            catch (IOException)
            {
                return false;  // similar to all other processors
            }

        }

        /**
         *  Our goal was to work with any protocol.  In order to do that, we needed
         *  to allow them to call readMessageBegin() and get a TMessage in exactly
         *  the standard format, without the service name prepended to TMessage.name.
         */
        private class StoredMessageProtocol : TProtocolDecorator
        {
            TMessage MsgBegin;

            public StoredMessageProtocol(TProtocol protocol, TMessage messageBegin)
                :base(protocol)
            {
                this.MsgBegin = messageBegin;
            }

            public override TMessage ReadMessageBegin()
            {
                return MsgBegin;
            }
        }

    }
}
