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

package;

import org.apache.thrift.*;
import org.apache.thrift.protocol.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.server.*;
import org.apache.thrift.meta_data.*;

import thrift.test.*;  // generated code


class TestServer
{
    public static function Execute(args : Arguments) :  Void
    {
        try
        {
            // Transport
            var transport : TServerTransport = null;
            switch( args.transport) {
            case socket:
                trace("- socket port "+args.port);
                transport = new TServerSocket( args.port);
            case http:
                trace("- http");
                #if !phpwebserver
                  throw "HTTP server not implemented yet";
                 //transport = new THttpServer( targetHost);
                #else
                transport =    new TWrappingServerTransport(
                        new TStreamTransport(
                          new TFileStream("php://input", Read),
                          new TFileStream("php://output", Append)
                          )
                        );

                #end
            default:
                throw "Unhandled transport";
            }

            // optional: layered transport
            var transfactory : TTransportFactory = null;
            if ( args.framed) {
                trace("- framed transport");
                transfactory = new TFramedTransportFactory();
            }
            if ( args.buffered) {
                trace("- buffered transport");
                transfactory = new TBufferedTransportFactory();
            }

            // protocol
            var protfactory : TProtocolFactory = null;
            switch( args.protocol)
            {
            case binary:
                trace("- binary protocol");
                protfactory = new TBinaryProtocolFactory();
            case json:
                trace("- json protocol");
                protfactory = new TJSONProtocolFactory();
            case compact:
                trace("- compact protocol");
                protfactory = new TCompactProtocolFactory();
            }


            // Processor
            var handler = new TestServerHandler();
            var processor = new ThriftTestProcessor(handler);

            // Simple Server
            var server : TServer = null;
            switch( args.servertype)
            {
            case simple:
                var simpleServer = new TSimpleServer( processor, transport, transfactory, protfactory);
                #if phpwebserver
                simpleServer.runOnce = true;
                #end
                server = simpleServer;

            default:
                throw "Unhandled server type";
            }


            /*
            // Server event handler
            if( args.serverEvents) {
                var events = new TestServerEventHandler();
                server.setEventHandler(serverEvents);
                handler.server = serverEngine;
            }
            */

            // Run it
            server.Serve();
            trace("done.");

        }
        catch (x : TException)
        {
            trace('$x ${x.errorID} ${x.errorMsg}');
        }
        catch (x : Dynamic)
        {
            trace('$x');
        }
    }
}
