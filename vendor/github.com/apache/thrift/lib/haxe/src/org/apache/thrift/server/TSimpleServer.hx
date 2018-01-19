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

package org.apache.thrift.server;

import org.apache.thrift.*;
import org.apache.thrift.protocol.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.meta_data.*;

// Simple single-threaded server for testing
class TSimpleServer extends TServer  {

    private var stop : Bool = false;

    //stops just after input transport returns EOF
    //useful for limited scenarios, like embeding into php server
    public var runOnce : Bool = false;

    public function new( processor : TProcessor,
                         serverTransport : TServerTransport,
                         transportFactory : TTransportFactory = null,
                         protocolFactory : TProtocolFactory = null,
                         logger : Dynamic->Void = null) {
      super( processor, serverTransport,
             transportFactory, transportFactory,
             protocolFactory, protocolFactory,
             logger);
    }


    public override function Serve() : Void
    {
        try
        {
            serverTransport.Listen();
        }
        catch (ttx : TTransportException)
        {
            logDelegate(ttx);
            return;
        }

        // Fire the preServe server event when server is up,
        // but before any client connections
        if (serverEventHandler != null) {
            serverEventHandler.preServe();
        }

        while( ! stop)
        {
            var client : TTransport = null;
            var inputTransport : TTransport = null;
            var outputTransport : TTransport = null;
            var inputProtocol : TProtocol = null;
            var outputProtocol : TProtocol = null;
            var connectionContext : Dynamic = null;
            try
            {
                client = serverTransport.Accept();
                if (client != null) {
                    inputTransport = inputTransportFactory.getTransport( client);
                    outputTransport = outputTransportFactory.getTransport( client);
                    inputProtocol = inputProtocolFactory.getProtocol( inputTransport);
                    outputProtocol = outputProtocolFactory.getProtocol( outputTransport);

                    // Recover event handler (if any) and fire createContext
                    // server event when a client connects
                    if (serverEventHandler != null) {
                        connectionContext = serverEventHandler.createContext(inputProtocol, outputProtocol);
                    }

                    // Process client requests until client disconnects
                    while( true) {
                        // Fire processContext server event
                        // N.B. This is the pattern implemented in C++ and the event fires provisionally.
                        // That is to say it may be many minutes between the event firing and the client request
                        // actually arriving or the client may hang up without ever makeing a request.
                        if (serverEventHandler != null) {
                            serverEventHandler.processContext(connectionContext, inputTransport);
                        }

                        //Process client request (blocks until transport is readable)
                        if( ! processor.process( inputProtocol, outputProtocol)) {
                            break;
                        }
                    }
                }
            }
            catch( ttx : TTransportException)
            {
                // Usually a client disconnect, expected
                if(runOnce && ttx.errorID == TTransportException.END_OF_FILE) {
                  //input returns eof, exit
                  //follows lib/cpp/src/thrift/server/TServerFramework.cpp
                  Stop();
                }
            }
            catch( pex : TProtocolException)
            {
                logDelegate('$pex ${pex.errorID} ${pex.errorMsg}'); // Unexpected
            }
            catch( e : Dynamic)
            {
                logDelegate(e); // Unexpected
            }

            // Fire deleteContext server event after client disconnects
            if (serverEventHandler != null) {
                serverEventHandler.deleteContext(connectionContext, inputProtocol, outputProtocol);
            }
        }
    }

    public override function Stop() : Void
    {
      stop = true;
      serverTransport.Close();
    }
}
