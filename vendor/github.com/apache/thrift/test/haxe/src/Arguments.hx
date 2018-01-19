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
import haxe.io.Path;

using StringTools;


enum ProtocolType {
    binary;
    json;
    compact;
}

enum EndpointTransport {
    socket;
    http;
}

enum ServerType {
    simple;
    /*
    threadpool;
    threaded;
    nonblocking;
    */
}


class Arguments
{
    public var printHelpOnly(default,null) : Bool = false;

    public var server(default,null) : Bool = false;
    public var servertype(default,null) : ServerType = simple;

    public var host(default,null) : String = "localhost";
    public var port(default,null) : Int = 9090;

    public var protocol(default,null) : ProtocolType = binary;
    public var transport(default,null) : EndpointTransport = socket;
    public var framed(default,null) : Bool = false;
    public var buffered(default,null) : Bool = false;

    public var numIterations(default,null) : Int = 1;
    public var numThreads(default,null) : Int = 1;
    public var skipSpeedTest(default,null) : Bool = false;


    public function new() {
        #if sys
          #if !phpwebserver
          try {
              ParseArgs();
          } catch (e : String) {
            trace(GetHelp());
            throw e;
          }
          #else
            //forcing server
            server = true;
            transport = http;
          #end
        #else
        trace("WN: Platform does not support program arguments, using defaults.");
        #end
    }

    #if sys

    private static function GetHelp() : String {
        var sProg = Path.withoutDirectory( Sys.executablePath());
        return "\n"
            +sProg+"  [client|server]  [options]\n"
            +"\n"
            +"Modus: Either client or server, the default is client.\n"
            +"\n"
            +"Common options:\n"
            +"  -h [ --help ]               produce help message\n"
            +"  --port arg (=9090)          Port number to listen / connect to\n"
            /* not supported yet
            +"  --domain-socket arg         Unix Domain Socket (e.g. /tmp/ThriftTest.thrift)\n"
            +"  --named-pipe arg            Windows Named Pipe (e.g. MyThriftPipe)\n"
            */
            +"  --protocol arg (=binary)    protocol: binary, compact, json\n"
            /* not supported yet
            +"  --ssl                       Encrypted Transport using SSL\n"
            */
            +"\n"
            +"Server only options:\n"
            +"  --transport arg (=sockets)  Transport: buffered, framed, http, anonpipe\n"
            /* not supported yet
            +"  --processor-events          processor-events\n"
            +"  --server-type arg (=simple) type of server, \"simple\", \"thread-pool\", \n"
            +"                              \"threaded\", or \"nonblocking\"\n"
            +"  -n [ --workers ] arg (=4)   Number of thread pools workers. Only valid for \n"
            +"                              thread-pool server type\n"
            */
            +"\n"
            +"Client only options:\n"
            +"  --host arg (=localhost)     Host to connect\n"
            +"  --transport arg (=sockets)  Transport: buffered, framed, http, evhttp\n"
            /* not supported yet
            +"  --anon-pipes hRead hWrite   Windows Anonymous Pipes pair (handles)\n"
            */
            +"  -n [ --testloops ] arg (=1) Number of Tests\n"
            +"  -t [ --threads ] arg (=1)   Number of Test threads\n"
            +"  --skip-speed-test           Skip the speed test\n"
            +"\n"
            +"All arguments are optional.\n"
            ;
    }


    private function ParseArgs() : Void {

        var args = Sys.args().copy();
        if( (args == null) || (args.length <= 0)) {
            server = false;
            numThreads = 1;
            return;
        }

        var arg = args.shift();
        if ( arg == "client") {
            server = false;
            numThreads = 1;
        }
        else if ( arg == "server") {
            server = true;
            numThreads = 4;
        }
        else if ( (arg == "-h") || (arg == "--help")) {
            // -h [ --help ]               produce help message
            Sys.println( GetHelp());
            printHelpOnly = true;
            return;
        }
        else {
            throw "First argument must be 'server' or 'client'";
        }


        while( args.length > 0) {
            arg = args.shift();

            if ( (arg == "-h") || (arg == "--help")) {
                // -h [ --help ]               produce help message
                Sys.println( GetHelp());
                printHelpOnly = true;
                return;
            }
            else if (arg == "--port") {
                // --port arg (=9090)          Port number to listen
                arg = args.shift();
                var tmp = Std.parseInt(arg);
                if( tmp != null) {
                    port = tmp;
                } else {
                    throw "Invalid port number "+arg;
                }
            }
            else if (arg == "--domain-socket") {
                //   --domain-socket arg         Unix Domain Socket (e.g. /tmp/ThriftTest.thrift)
                throw "domain sockets not supported yet";
            }
            else if (arg == "--named-pipe") {
                //   --named-pipe arg            Windows Named Pipe (e.g. MyThriftPipe)
                throw "named pipes not supported yet";
            }
            else if (arg == "--protocol") {
                // --protocol arg (=binary)    protocol: binary, compact, json
                arg = args.shift();
                if( arg == "binary") {
                    protocol = binary;
                } else if( arg == "compact") {
                    protocol = compact;
                } else if( arg == "json") {
                    protocol = json;
                } else {
                    InvalidArg(arg);
                }
            }
            else if (arg == "--ssl") {
                // --ssl                       Encrypted Transport using SSL
                throw "SSL not supported yet";
            }
            else {
                //Server only options:
                if( server) {
                    ParseServerArgument( arg, args);
                } else {
                    ParseClientArgument( arg, args);
                }
            }
        }
    }


    private function ParseServerArgument( arg : String, args : Array<String>) : Void {
        if (arg == "--transport") {
            //  --transport arg (=sockets)  Transport: buffered, framed, http, anonpipe
            arg = args.shift();
            if( arg == "buffered") {
                buffered = true;
            } else if( arg == "framed") {
                framed = true;
            } else if( arg == "http") {
                transport = http;
            } else if( arg == "anonpipe") {
                throw "Anon pipes transport not supported yet";
            } else {
                InvalidArg(arg);
            }
        }
        else if (arg == "--processor-events") {
            throw "Processor events not supported yet";
        }
        else if (arg == "--server-type") {
            //  --server-type arg (=simple) type of server,
            // one of "simple", "thread-pool", "threaded", "nonblocking"
            arg = args.shift();
            if( arg == "simple") {
                servertype = simple;
            } else if( arg == "thread-pool") {
                throw arg+" server not supported yet";
            } else if( arg == "threaded") {
                throw arg+" server not supported yet";
            } else if( arg == "nonblocking") {
                throw arg+" server not supported yet";
            } else {
                InvalidArg(arg);
            }
        }
        else if ((arg == "-n") || (arg == "--workers")) {
            //  -n [ --workers ] arg (=4)   Number of thread pools workers. Only valid for
            //                              thread-pool server type
            arg = args.shift();
            var tmp = Std.parseInt(arg);
            if( tmp != null) {
                numThreads = tmp;
            } else{
                throw "Invalid number "+arg;
            }
        }
        else {
            InvalidArg(arg);
        }
    }


    private function ParseClientArgument( arg : String, args : Array<String>) : Void {
        if (arg == "--host") {
            //  --host arg (=localhost)     Host to connect
            host = args.shift();
        }
        else if (arg == "--transport") {
            //  --transport arg (=sockets)  Transport: buffered, framed, http, evhttp
            arg = args.shift();
            if( arg == "buffered") {
                buffered = true;
            } else if( arg == "framed") {
                framed = true;
            } else if( arg == "http") {
                transport = http;
            } else if( arg == "evhttp") {
                throw "evhttp transport not supported yet";
            } else {
                InvalidArg(arg);
            }
        }
        else if (arg == "--anon-pipes") {
            //  --anon-pipes hRead hWrite   Windows Anonymous Pipes pair (handles)
            throw "Anon pipes transport not supported yet";
        }
        else if ((arg == "-n") || (arg == "--testloops")) {
            //  -n [ --testloops ] arg (=1) Number of Tests
            arg = args.shift();
            var tmp = Std.parseInt(arg);
            if( tmp != null) {
                numIterations = tmp;
            } else {
                throw "Invalid number "+arg;
            }
        }
        else if ((arg == "-t") || (arg == "--threads")) {
            //  -t [ --threads ] arg (=1)   Number of Test threads
            arg = args.shift();
            var tmp = Std.parseInt(arg);
            if( tmp != null) {
                numThreads = tmp;
            } else {
                throw "Invalid number "+arg;
            }
        }
        else if (arg == "--skip-speed-test") {
            //  --skip-speed-test              Skip the speed test
            skipSpeedTest = true;
        }
        else {
            InvalidArg(arg);
        }
    }


    #end


    private function InvalidArg( arg : String) : Void {
        throw 'Invalid argument $arg';
    }
}
