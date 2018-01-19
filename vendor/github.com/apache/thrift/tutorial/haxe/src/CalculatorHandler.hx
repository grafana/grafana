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

import haxe.ds.IntMap;

import org.apache.thrift.*;
import org.apache.thrift.protocol.*;
import org.apache.thrift.transport.*;
import org.apache.thrift.server.*;
import org.apache.thrift.meta_data.*;

import tutorial.*;
import shared.*;


class CalculatorHandler implements Calculator {

    private var log = new IntMap<SharedStruct>();

    public function new() {
    }

    public function ping() : Void {
        trace("ping()");
    }


    public function add( num1 : haxe.Int32, num2 : haxe.Int32) : haxe.Int32 {
        trace('add( $num1, $num2)');
        return num1 + num2;
    }

    public function calculate( logid : haxe.Int32, work : Work) : haxe.Int32  {
        trace('calculate( $logid, '+work.op+","+work.num1+","+work.num2+")");

        var val : haxe.Int32 = 0;
        switch (work.op)
        {
            case Operation.ADD:
                val = work.num1 + work.num2;

            case Operation.SUBTRACT:
                val = work.num1 - work.num2;

            case Operation.MULTIPLY:
                val = work.num1 * work.num2;

            case Operation.DIVIDE:
                if (work.num2 == 0)
                {
                    var io = new InvalidOperation();
                    io.whatOp = work.op;
                    io.why = "Cannot divide by 0";
                    throw io;
                }
                val = Std.int( work.num1 / work.num2);

            default:
                var io = new InvalidOperation();
                io.whatOp = work.op;
                io.why = "Unknown operation";
                throw io;
        }

        var entry = new SharedStruct();
        entry.key = logid;
        entry.value = '$val';
        log.set(logid, entry);

        return val;
    }

    public function getStruct( key : haxe.Int32) : SharedStruct {
        trace('getStruct($key)');
        return log.get(key);
    }

    // oneway method,  no args
    public function zip() : Void {
        trace("zip()");
    }

}
