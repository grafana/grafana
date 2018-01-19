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

import tutorial.*;
import shared.*;


enum Prot {
    binary;
    json;
}

enum Trns {
    socket;
    http;
}

class Main {

    private static var server : Bool = false;
    private static var framed : Bool = false;
    private static var buffered : Bool = false;
    private static var prot : Prot = binary;
    private static var trns : Trns = socket;

    private static var targetHost : String = "localhost";
    private static var targetPort : Int = 9090;

    static function main() {

        #if ! (flash || js || phpwebserver)
        try {
              ParseArgs();
        } catch (e : String) {
            trace(e);
            trace(GetHelp());
            return;
        }

        #elseif  phpwebserver
        //forcing server
        server = true;
        trns = http;
        initPhpWebServer();
        //check method
        if(php.Web.getMethod() != 'POST') {
          Sys.println('http endpoint for thrift test server');
          return;
        }
        #end

        try {
            if (server)
                RunServer();
            else
                RunClient();
        } catch (e : String) {
            trace(e);
        }

        trace("Completed.");
    }

    #if phpwebserver
    private static function initPhpWebServer()
    {
        //remap trace to error log
        haxe.Log.trace = function(v:Dynamic, ?infos:haxe.PosInfos)
        {
          // handle trace
          var newValue : Dynamic;
          if (infos != null && infos.customParams!=null) {
            var extra:String = "";
            for( v in infos.customParams )
              extra += "," + v;
            newValue = v + extra;
          }
          else {
            newValue = v;
          }
          var msg = infos != null ? infos.fileName + ':' + infos.lineNumber + ': ' : '';
          Sys.stderr().writeString('${msg}${newValue}\n');
        }
    }
    #end


    #if ! (flash || js)

    private static function GetHelp() : String {
        return Sys.executablePath()+"  modus  trnsOption  transport  protocol\n"
        +"Options:\n"
        +"  modus:       client, server   (default: client)\n"
        +"  trnsOption:  framed, buffered (default: none)\n"
        +"  transport:   socket, http     (default: socket)\n"
        +"  protocol:    binary, json     (default: binary)\n"
        +"\n"
        +"All arguments are optional.\n";
    }


    private static function ParseArgs() : Void {
        var step = 0;
        for (arg in Sys.args()) {

            // server|client
            switch(step) {
            case 0:
                ++step;
                if ( arg == "client")
                    server = false;
                else if ( arg == "server")
                    server = true;
                else
                    throw "First argument must be 'server' or 'client'";

            case 1:
                if ( arg == "framed") {
                    framed = true;
                } else if ( arg == "buffered") {
                    buffered = true;
                } else if ( arg == "socket") {
                    trns = socket;
                    ++step;
                } else if ( arg == "http") {
                    trns = http;
                    ++step;
                } else {
                    throw "Unknown transport "+arg;
                }

            case 2:
                if ( arg == "binary") {
                    prot = binary;
                    ++step;
                } else if ( arg == "json") {
                    prot = json;
                    ++step;
                } else {
                    throw "Unknown protocol "+arg;
                }

            default:
                throw "Unexpected argument "+arg;
            }

            if ( framed && buffered)
            {
                trace("WN: framed supersedes buffered");
            }

        }
    }

    #end

    private static function ClientSetup() : Calculator {
         trace("Client configuration:");

        // endpoint transport
        var transport : TTransport;
        switch(trns)
        {
        case socket:
             trace('- socket transport $targetHost:$targetPort');
            transport = new TSocket( targetHost, targetPort);
        case http:
            var uri = 'http://${targetHost}:${targetPort}';
            trace('- HTTP transport $uri');
            transport = new THttpClient(uri);
        default:
            throw "Unhandled transport";
        }


        // optinal layered transport
        if ( framed) {
            trace("- framed transport");
            transport = new TFramedTransport(transport);
        } else if ( buffered) {
            trace("- buffered transport");
            transport = new TBufferedTransport(transport);
        }


        // protocol
        var protocol : TProtocol;
        switch(prot)
        {
        case binary:
             trace("- binary protocol");
             protocol = new TBinaryProtocol( transport);
        case json:
             trace("- JSON protocol");
             protocol = new TJSONProtocol( transport);
        default:
            throw "Unhandled protocol";
        }


        // put everything together
        transport.open();
        return new CalculatorImpl(protocol,protocol);
    }


    private static function RunClient() : Void {
        var client = ClientSetup();

        try {
              client.ping();
            trace("ping() successful");
        } catch(error : TException) {
            trace('ping() failed: $error');
        } catch(error : Dynamic) {
            trace('ping() failed: $error');
        }

        try {
            var sum = client.add( 1, 1);
            trace('1+1=$sum');
        } catch(error : TException) {
            trace('add() failed: $error');
        } catch(error : Dynamic) {
            trace('add() failed: $error');
        }


        var work = new tutorial.Work();
        work.op = tutorial.Operation.DIVIDE;
        work.num1 = 1;
        work.num2 = 0;
        try {
            var quotient = client.calculate( 1, work);
            trace('Whoa we can divide by 0! Result = $quotient');
        } catch(error : TException) {
            trace('calculate() failed: $error');
        } catch(error : Dynamic) {
            trace('calculate() failed: $error');
        }

        work.op = tutorial.Operation.SUBTRACT;
        work.num1 = 15;
        work.num2 = 10;
        try {
            var diff = client.calculate( 1, work);
            trace('15-10=$diff');
        } catch(error : TException) {
            trace('calculate() failed: $error');
        } catch(error : Dynamic) {
            trace('calculate() failed: $error');
        }


        try {
            var log : SharedStruct = client.getStruct( 1);
            var logval = log.value;
            trace('Check log: $logval');
        } catch(error : TException) {
            trace('getStruct() failed: $error');
        } catch(error : Dynamic) {
            trace('getStruct() failed: $error');
        }
    }


    private static function ServerSetup() : TServer {
         trace("Server configuration:");

        // endpoint transport
        var transport : TServerTransport = null;
        switch(trns)
        {
        case socket:
            #if (flash || js)
            throw 'current platform does not support socket servers';
            #else
             trace('- socket transport port $targetPort');
            transport = new TServerSocket( targetPort);
            #end
        case http:
            #if !phpwebserver
              throw "HTTP server not implemented yet";
              //trace("- http transport");
              //transport = new THttpClient( targetHost);
            #else
              trace("- http transport");
              transport = new TWrappingServerTransport(
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
        if ( framed) {
            trace("- framed transport");
            transfactory = new TFramedTransportFactory();
        } else if ( buffered) {
            trace("- buffered transport");
            transfactory = new TBufferedTransportFactory();
        }

        // protocol
        var protfactory : TProtocolFactory = null;
        switch(prot)
        {
        case binary:
             trace("- binary protocol");
             protfactory = new TBinaryProtocolFactory();
        case json:
            trace("- JSON protocol");
             protfactory = new TJSONProtocolFactory();
        default:
            throw "Unhandled protocol";
        }

        var handler = new CalculatorHandler();
        var processor = new CalculatorProcessor(handler);
        var server = new TSimpleServer( processor, transport, transfactory, protfactory);
        #if phpwebserver
        server.runOnce = true;
        #end

        return server;
    }


    private static function RunServer() : Void {
        try
        {
            var server = ServerSetup();

            trace("\nStarting the server...");
            server.Serve();
        }
        catch( e : Dynamic)
        {
            trace('RunServer() failed: $e');
        }
        trace("done.");
    }

}

