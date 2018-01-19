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

package org.apache.thrift;

import org.apache.thrift.protocol.*;

import java.util.Map;
import java.util.HashMap;

/**
 * <code>TMultiplexedProcessor</code> is a <code>TProcessor</code> allowing
 * a single <code>TServer</code> to provide multiple services.
 *
 * <p>To do so, you instantiate the processor and then register additional
 * processors with it, as shown in the following example:</p>
 *
 * <blockquote><code>
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
 * </code></blockquote>
 */
public class TMultiplexedProcessor implements TProcessor {

    private final Map<String,TProcessor> SERVICE_PROCESSOR_MAP
            = new HashMap<String,TProcessor>();

    /**
     * 'Register' a service with this <code>TMultiplexedProcessor</code>.  This
     * allows us to broker requests to individual services by using the service
     * name to select them at request time.
     *
     * @param serviceName Name of a service, has to be identical to the name
     * declared in the Thrift IDL, e.g. "WeatherReport".
     * @param processor Implementation of a service, usually referred to
     * as "handlers", e.g. WeatherReportHandler implementing WeatherReport.Iface.
     */
    public void registerProcessor(String serviceName, TProcessor processor) {
        SERVICE_PROCESSOR_MAP.put(serviceName, processor);
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
     * @throws TException If the message type is not CALL or ONEWAY, if
     * the service name was not found in the message, or if the service
     * name was not found in the service map.  You called {@link #registerProcessor(String, TProcessor) registerProcessor}
     * during initialization, right? :)
     */
    public boolean process(TProtocol iprot, TProtocol oprot) throws TException {
        /*
            Use the actual underlying protocol (e.g. TBinaryProtocol) to read the
            message header.  This pulls the message "off the wire", which we'll
            deal with at the end of this method.
        */
        TMessage message = iprot.readMessageBegin();

        if (message.type != TMessageType.CALL && message.type != TMessageType.ONEWAY) {
            // TODO Apache Guys - Can the server ever get an EXCEPTION or REPLY?
            // TODO Should we check for this here?
            throw new TException("This should not have happened!?");
        }

        // Extract the service name
        int index = message.name.indexOf(TMultiplexedProtocol.SEPARATOR);
        if (index < 0) {
            throw new TException("Service name not found in message name: " + message.name + ".  Did you " +
                    "forget to use a TMultiplexProtocol in your client?");
        }

        // Create a new TMessage, something that can be consumed by any TProtocol
        String serviceName = message.name.substring(0, index);
        TProcessor actualProcessor = SERVICE_PROCESSOR_MAP.get(serviceName);
        if (actualProcessor == null) {
            throw new TException("Service name not found: " + serviceName + ".  Did you forget " +
                    "to call registerProcessor()?");
        }

        // Create a new TMessage, removing the service name
        TMessage standardMessage = new TMessage(
                message.name.substring(serviceName.length()+TMultiplexedProtocol.SEPARATOR.length()),
                message.type,
                message.seqid
        );

        // Dispatch processing to the stored processor
        return actualProcessor.process(new StoredMessageProtocol(iprot, standardMessage), oprot);
    }

    /**
     *  Our goal was to work with any protocol.  In order to do that, we needed
     *  to allow them to call readMessageBegin() and get a TMessage in exactly
     *  the standard format, without the service name prepended to TMessage.name.
     */
    private static class StoredMessageProtocol extends TProtocolDecorator {
        TMessage messageBegin;
        public StoredMessageProtocol(TProtocol protocol, TMessage messageBegin) {
            super(protocol);
            this.messageBegin = messageBegin;
        }
        @Override
        public TMessage readMessageBegin() throws TException {
            return messageBegin;
        }
    }

}
