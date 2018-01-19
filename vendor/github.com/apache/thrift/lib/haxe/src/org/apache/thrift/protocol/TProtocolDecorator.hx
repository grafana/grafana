/**
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
import haxe.Int64;

import org.apache.thrift.transport.TTransport;


/**
 * TProtocolDecorator forwards all requests to an enclosed TProtocol instance,
 * providing a way to author concise concrete decorator subclasses.  While it has
 * no abstract methods, it is marked abstract as a reminder that by itself,
 * it does not modify the behaviour of the enclosed TProtocol.
 *
 * See p.175 of Design Patterns (by Gamma et al.)
 * See TMultiplexedProtocol
 */
class TProtocolDecorator implements TProtocol
{
    private var wrapped : TProtocol;

    /**
     * Encloses the specified protocol.
     * @param protocol All operations will be forward to this protocol.  Must be non-null.
     */
    private function new( protocol : TProtocol)  // not to be instantiated, must derive a class
    {
        wrapped = protocol;
    }

    public function getTransport() : TTransport {
      return wrapped.getTransport();
    }

    public function writeMessageBegin( value : TMessage) : Void    {
        wrapped.writeMessageBegin( value);
    }

    public function writeMessageEnd() : Void {
        wrapped.writeMessageEnd();
    }

    public function writeStructBegin(value : TStruct) : Void {
        wrapped.writeStructBegin( value);
    }

    public function writeStructEnd() : Void {
        wrapped.writeStructEnd();
    }

    public function writeFieldBegin(value : TField) : Void {
        wrapped.writeFieldBegin( value);
    }

    public function writeFieldEnd() : Void {
        wrapped.writeFieldEnd();
    }

    public function writeFieldStop() : Void {
        wrapped.writeFieldStop();
    }

    public function writeMapBegin( value : TMap) : Void {
        wrapped.writeMapBegin( value);
    }

    public function writeMapEnd() : Void {
        wrapped.writeMapEnd();
    }

    public function writeListBegin( value : TList) : Void {
        wrapped.writeListBegin( value);
    }

    public function writeListEnd() : Void {
        wrapped.writeListEnd();
    }

    public function writeSetBegin( value : TSet) : Void {
        wrapped.writeSetBegin( value);
    }

    public function writeSetEnd() : Void {
        wrapped.writeSetEnd();
    }

    public function writeBool(value : Bool) : Void {
        wrapped.writeBool( value);
    }

    public function writeByte(value : Int) : Void {
        wrapped.writeByte( value);
    }

    public function writeI16(value : Int) : Void {
        wrapped.writeI16( value);
    }

    public function writeI32(value : Int) : Void {
        wrapped.writeI32( value);
    }

    public function writeI64(value : haxe.Int64) : Void {
        wrapped.writeI64( value);
    }

    public function writeDouble(value : Float) : Void {
        wrapped.writeDouble( value);
    }

    public function writeString(value : String) : Void {
        wrapped.writeString( value);
    }

    public function writeBinary(value : Bytes ) : Void {
        wrapped.writeBinary( value);
    }

    public function readMessageBegin() : TMessage {
        return wrapped.readMessageBegin();
    }

    public function readMessageEnd() : Void {
        wrapped.readMessageEnd();
    }

    public function readStructBegin() : TStruct {
        return wrapped.readStructBegin();
    }

    public function readStructEnd() : Void {
        wrapped.readStructEnd();
    }

    public function readFieldBegin() : TField {
        return wrapped.readFieldBegin();
    }

    public function readFieldEnd() : Void {
        wrapped.readFieldEnd();
    }

    public function readMapBegin() : TMap {
        return wrapped.readMapBegin();
    }

    public function readMapEnd() : Void {
        wrapped.readMapEnd();
    }

    public function readListBegin() : TList {
        return wrapped.readListBegin();
    }

    public function readListEnd() : Void {
        wrapped.readListEnd();
    }

    public function readSetBegin() : TSet {
        return wrapped.readSetBegin();
    }

    public function readSetEnd() : Void {
        wrapped.readSetEnd();
    }

    public function readBool() : Bool
    {
        return wrapped.readBool();
    }

    public function readByte() : Int {
        return wrapped.readByte();
    }

    public function readI16() : Int {
        return wrapped.readI16();
    }

    public function readI32() : Int {
        return wrapped.readI32();
    }

    public function readI64() : haxe.Int64 {
        return wrapped.readI64();
    }

    public function readDouble() : Float {
        return wrapped.readDouble();
    }

    public function readString() : String {
        return wrapped.readString();
    }

    public function readBinary() : Bytes {
        return wrapped.readBinary();
    }

    public function IncrementRecursionDepth() : Void {
        return wrapped.IncrementRecursionDepth();
    }

    public function DecrementRecursionDepth() : Void {
        return wrapped.DecrementRecursionDepth();
    }
}
