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

package org.apache.thrift.protocol;

import haxe.io.Bytes;
import org.apache.thrift.TException;
import org.apache.thrift.transport.TTransport;

/**
* Protocol interface definition
*/
interface TProtocol {

    function getTransport() : TTransport;

    /**
     * Writing methods.
     */
    function writeMessageBegin(message:TMessage) : Void;
    function writeMessageEnd() : Void;
    function writeStructBegin(struct:TStruct) : Void;
    function writeStructEnd() : Void;
    function writeFieldBegin(field:TField) : Void;
    function writeFieldEnd() : Void;
    function writeFieldStop() : Void;
    function writeMapBegin(map:TMap) : Void;
    function writeMapEnd() : Void;
    function writeListBegin(list:TList) : Void;
    function writeListEnd() : Void;
    function writeSetBegin(set:TSet) : Void;
    function writeSetEnd() : Void;
    function writeBool(b : Bool) : Void;
    function writeByte(b : Int) : Void;
    function writeI16(i16 : Int) : Void;
    function writeI32(i32 : Int) : Void;
    function writeI64(i64 : haxe.Int64) : Void;
    function writeDouble(dub : Float) : Void;
    function writeString(str : String) : Void;
    function writeBinary(bin : Bytes) : Void;

    /**
     * Reading methods.
     */
    function readMessageBegin():TMessage;
    function readMessageEnd() : Void;
    function readStructBegin():TStruct;
    function readStructEnd() : Void;
    function readFieldBegin():TField;
    function readFieldEnd() : Void;
    function readMapBegin():TMap;
    function readMapEnd() : Void;
    function readListBegin():TList;
    function readListEnd() : Void;
    function readSetBegin():TSet;
    function readSetEnd() : Void;
    function readBool() : Bool;
    function readByte() : Int;
    function readI16() : Int;
    function readI32() : Int;
    function readI64() : haxe.Int64;
    function readDouble() : Float;
    function readString() : String;
    function readBinary() : Bytes;

    // recursion tracking
    function IncrementRecursionDepth() : Void;
    function DecrementRecursionDepth() : Void;
}
