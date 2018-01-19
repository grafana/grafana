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

class Main
{
    static function main() {
        #if phpwebserver
        initPhpWebServer();
        //check method
        if(php.Web.getMethod() != 'POST') {
          Sys.println('http endpoint for thrift test server');
          return;
        }
        #end

        try {
            var args = new Arguments();

            if( args.printHelpOnly)
                return;

            if (args.server)
                TestServer.Execute(args);
            else
                TestClient.Execute(args);

            trace("Completed.");
        } catch (e : String) {
            trace(e);
        }
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

}
