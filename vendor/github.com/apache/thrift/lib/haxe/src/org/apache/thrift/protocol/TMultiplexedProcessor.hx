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

import haxe.ds.StringMap;
import org.apache.thrift.TApplicationException;
import org.apache.thrift.TProcessor;

import org.apache.thrift.transport.TTransport;


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
class TMultiplexedProcessor implements TProcessor
{
    private var serviceProcessorMap : StringMap<TProcessor> = new StringMap<TProcessor>();
    private var defaultProcessor : TProcessor = null;

    public function new() {
    }

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
    public function RegisterProcessor(serviceName : String, processor : TProcessor, asDefault : Bool = false) : Void {
        serviceProcessorMap.set(serviceName, processor);
        if ( asDefault) {
            if( defaultProcessor != null) {
                throw new TApplicationException( TApplicationException.UNKNOWN, "Can't have multiple default processors");
            } else {
                defaultProcessor = processor;
            }
        }
    }


    private function Fail( oprot : TProtocol, message : TMessage, extype : Int, etxt : String) : Void {
        var appex = new TApplicationException( extype, etxt);

        var newMessage = new TMessage(message.name, TMessageType.EXCEPTION, message.seqid);

        oprot.writeMessageBegin(newMessage);
        appex.write( oprot);
        oprot.writeMessageEnd();
        oprot.getTransport().flush();
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
    public function process( iprot : TProtocol, oprot : TProtocol) : Bool {
        /*  Use the actual underlying protocol (e.g. TBinaryProtocol) to read the
            message header.  This pulls the message "off the wire", which we'll
            deal with at the end of this method. */

        var message : TMessage = iprot.readMessageBegin();
        var methodName : String = "";

        if ((message.type != TMessageType.CALL) && (message.type != TMessageType.ONEWAY))
        {
            Fail(oprot, message,
                  TApplicationException.INVALID_MESSAGE_TYPE,
                  "Message type CALL or ONEWAY expected");
            return false;
        }

        // Extract the service name
        var actualProcessor : TProcessor = null;
        var index = message.name.indexOf(TMultiplexedProtocol.SEPARATOR);
        if (index < 0) {
            // fallback to default processor
            methodName = message.name;
            actualProcessor = defaultProcessor;
            if( actualProcessor == null) {
                Fail(oprot, message,
                      TApplicationException.INVALID_PROTOCOL,
                      "Service name not found in message name: " + message.name + " and no default processor defined. " +
                      "Did you forget to use a TMultiplexProtocol in your client?");
                return false;
            }

        } else {
            // service name given
            var serviceName = message.name.substring(0, index);
            methodName = message.name.substring( serviceName.length + TMultiplexedProtocol.SEPARATOR.length);
            actualProcessor = serviceProcessorMap.get( serviceName);
            if( actualProcessor == null) {
                Fail(oprot, message,
                      TApplicationException.INTERNAL_ERROR,
                      "Service name not found: " + serviceName + ". " +
                      "Did you forget to call RegisterProcessor()?");
                return false;
            }
        }

        // Create a new TMessage, removing the service name
        // Dispatch processing to the stored processor
        var newMessage = new TMessage( methodName, message.type, message.seqid);
        var storedMsg = new StoredMessageProtocol( iprot, newMessage);
        return actualProcessor.process( storedMsg, oprot);
    }
}


/**
 *  Our goal was to work with any protocol.  In order to do that, we needed
 *  to allow them to call readMessageBegin() and get a TMessage in exactly
 *  the standard format, without the service name prepended to TMessage.name.
 */
class StoredMessageProtocol extends TProtocolDecorator
{
    private var messageBegin : TMessage;

    public function new( protocol : TProtocol, messageBegin : TMessage) {
        super( protocol);
        this.messageBegin = messageBegin;
    }

    public override function readMessageBegin() : TMessage {
        return messageBegin;
    }
}

