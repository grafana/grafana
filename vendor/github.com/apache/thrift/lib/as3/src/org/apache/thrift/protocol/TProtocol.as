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

package org.apache.thrift.protocol {

  import org.apache.thrift.TError;
  import org.apache.thrift.transport.TTransport;

  import flash.utils.ByteArray;
  
  /**
   * Protocol interface definition
   */
  public interface TProtocol {
  
    function TProtocol(trans:TTransport);

    function getTransport():TTransport;

    /**
     * Writing methods.
     */
    function writeMessageBegin(message:TMessage):void;
  
    function writeMessageEnd():void;
    
    function writeStructBegin(struct:TStruct):void;
    
    function writeStructEnd():void;
    
    function writeFieldBegin(field:TField):void;
    
    function writeFieldEnd():void;
    
    function writeFieldStop():void;
    
    function writeMapBegin(map:TMap):void;
    
    function writeMapEnd():void;
    
    function writeListBegin(list:TList):void;
    
    function writeListEnd():void;
    
    function writeSetBegin(set:TSet):void;
    
    function writeSetEnd():void;
    
    function writeBool(b:Boolean):void;
    
    function writeByte(b:int):void;
    
    function writeI16(i16:int):void;
    
    function writeI32(i32:int):void;
    
    //function writeI64(i64:Number):void;
    
    function writeDouble(dub:Number):void;
    
    function writeString(str:String):void;
    
    function writeBinary(bin:ByteArray):void;
    
    /**
     * Reading methods.
     */
    function readMessageBegin():TMessage;
    
    function readMessageEnd():void;
    
    function readStructBegin():TStruct;
    
    function readStructEnd():void;
    
    function readFieldBegin():TField;
    
    function readFieldEnd():void;
    
    function readMapBegin():TMap;
    
    function readMapEnd():void;
    
    function readListBegin():TList;
    
    function readListEnd():void;
    
    function readSetBegin():TSet;
    
    function readSetEnd():void;
    
    function readBool():Boolean;
    
    function readByte():int;
    
    function readI16():int;
    
    function readI32():int;
    
    //function readI64():Number;
    
    function readDouble():Number;
    
    function readString():String;
    
    function readBinary():ByteArray;
  }
}