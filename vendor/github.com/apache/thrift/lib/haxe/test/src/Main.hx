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


enum WhatTests {
    Normal;
    Multiplex;
}

class Main
{
    static private var tests : WhatTests = Normal;
    static private var server : Bool = false;

    static private inline var CMDLINEHELP : String
        = "\nHaxeTests  [client|server]  [multiplex]\n"
        + "  client|server  ... determines run mode for some tests, default is client\n"
        + "  multiplex ........ run multiplex test server or client\n";

    static private function ParseArgs() {
        #if sys

        var args = Sys.args();
        if ( args != null) {
            for ( arg in args) {
                switch(arg.toLowerCase()) {
                    case "client":
                        server = false;
                    case "server" :
                        server = true;
                    case "multiplex" :
                        tests = Multiplex;
                    default:
                throw 'Invalid argument "$arg"\n'+CMDLINEHELP;
                }
            }
        }

        #end
    }

    static public function main()
    {
        try
        {
            ParseArgs();

            switch( tests) {
                case Normal:
                    StreamTest.Run(server);
                case Multiplex:
                    MultiplexTest.Run(server);
                default:
                    throw "Unhandled test mode $tests";
            }

            trace("All tests completed.");
        }
        catch( e: Dynamic)
        {
            trace('$e');
            #if sys
            Sys.exit(1);  // indicate error
            #end
        }
    }
}