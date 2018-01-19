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


class TestBase {

    private function new() {
        // override, if necessary
    }

    public static function Run(server : Bool) : Void {
          throw new AbstractMethodError();
    }

    public static function Expect( expr : Bool, info : String, ?pos : haxe.PosInfos) : Void {
        if( ! expr) {
            throw ('Test "$info" failed at '+pos.methodName+' in '+pos.fileName+':'+pos.lineNumber);
        }
    }

}
 