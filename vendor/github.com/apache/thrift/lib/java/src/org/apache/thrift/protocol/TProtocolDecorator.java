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

import org.apache.thrift.TException;

import java.nio.ByteBuffer;

/**
 * <code>TProtocolDecorator</code> forwards all requests to an enclosed
 * <code>TProtocol</code> instance, providing a way to author concise
 * concrete decorator subclasses.  While it has no abstract methods, it
 * is marked abstract as a reminder that by itself, it does not modify
 * the behaviour of the enclosed <code>TProtocol</code>.
 *
 * <p>See p.175 of Design Patterns (by Gamma et al.)</p>
 * 
 * @see org.apache.thrift.protocol.TMultiplexedProtocol
 */
public abstract class TProtocolDecorator extends TProtocol {

    private final TProtocol concreteProtocol;

    /**
     * Encloses the specified protocol.
     * @param protocol All operations will be forward to this protocol.  Must be non-null.
     */
    public TProtocolDecorator(TProtocol protocol) {
        super(protocol.getTransport());
        concreteProtocol = protocol;
    }

    public void writeMessageBegin(TMessage tMessage) throws TException {
        concreteProtocol.writeMessageBegin(tMessage);
    }

    public void writeMessageEnd() throws TException {
        concreteProtocol.writeMessageEnd();
    }

    public void writeStructBegin(TStruct tStruct) throws TException {
        concreteProtocol.writeStructBegin(tStruct);
    }

    public void writeStructEnd() throws TException {
        concreteProtocol.writeStructEnd();
    }

    public void writeFieldBegin(TField tField) throws TException {
        concreteProtocol.writeFieldBegin(tField);
    }

    public void writeFieldEnd() throws TException {
        concreteProtocol.writeFieldEnd();
    }

    public void writeFieldStop() throws TException {
        concreteProtocol.writeFieldStop();
    }

    public void writeMapBegin(TMap tMap) throws TException {
        concreteProtocol.writeMapBegin(tMap);
    }

    public void writeMapEnd() throws TException {
        concreteProtocol.writeMapEnd();
    }

    public void writeListBegin(TList tList) throws TException {
        concreteProtocol.writeListBegin(tList);
    }

    public void writeListEnd() throws TException {
        concreteProtocol.writeListEnd();
    }

    public void writeSetBegin(TSet tSet) throws TException {
        concreteProtocol.writeSetBegin(tSet);
    }

    public void writeSetEnd() throws TException {
        concreteProtocol.writeSetEnd();
    }

    public void writeBool(boolean b) throws TException {
        concreteProtocol.writeBool(b);
    }

    public void writeByte(byte b) throws TException {
        concreteProtocol.writeByte(b);
    }

    public void writeI16(short i) throws TException {
        concreteProtocol.writeI16(i);
    }

    public void writeI32(int i) throws TException {
        concreteProtocol.writeI32(i);
    }

    public void writeI64(long l) throws TException {
        concreteProtocol.writeI64(l);
    }

    public void writeDouble(double v) throws TException {
        concreteProtocol.writeDouble(v);
    }

    public void writeString(String s) throws TException {
        concreteProtocol.writeString(s);
    }

    public void writeBinary(ByteBuffer buf) throws TException {
        concreteProtocol.writeBinary(buf);
    }

    public TMessage readMessageBegin() throws TException {
        return concreteProtocol.readMessageBegin();
    }

    public void readMessageEnd() throws TException {
        concreteProtocol.readMessageEnd();
    }

    public TStruct readStructBegin() throws TException {
        return concreteProtocol.readStructBegin();
    }

    public void readStructEnd() throws TException {
        concreteProtocol.readStructEnd();
    }

    public TField readFieldBegin() throws TException {
        return concreteProtocol.readFieldBegin();
    }

    public void readFieldEnd() throws TException {
        concreteProtocol.readFieldEnd();
    }

    public TMap readMapBegin() throws TException {
        return concreteProtocol.readMapBegin();
    }

    public void readMapEnd() throws TException {
        concreteProtocol.readMapEnd();
    }

    public TList readListBegin() throws TException {
        return concreteProtocol.readListBegin();
    }

    public void readListEnd() throws TException {
        concreteProtocol.readListEnd();
    }

    public TSet readSetBegin() throws TException {
        return concreteProtocol.readSetBegin();
    }

    public void readSetEnd() throws TException {
        concreteProtocol.readSetEnd();
    }

    public boolean readBool() throws TException {
        return concreteProtocol.readBool();
    }

    public byte readByte() throws TException {
        return concreteProtocol.readByte();
    }

    public short readI16() throws TException {
        return concreteProtocol.readI16();
    }

    public int readI32() throws TException {
        return concreteProtocol.readI32();
    }

    public long readI64() throws TException {
        return concreteProtocol.readI64();
    }

    public double readDouble() throws TException {
        return concreteProtocol.readDouble();
    }

    public String readString() throws TException {
        return concreteProtocol.readString();
    }

    public ByteBuffer readBinary() throws TException {
        return concreteProtocol.readBinary();
    }
}
