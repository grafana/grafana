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

import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.List;

import junit.framework.TestCase;

import org.apache.thrift.Fixtures;
import org.apache.thrift.TBase;
import org.apache.thrift.TDeserializer;
import org.apache.thrift.TException;
import org.apache.thrift.TSerializer;
import org.apache.thrift.transport.TMemoryBuffer;

import thrift.test.CompactProtoTestStruct;
import thrift.test.HolyMoley;
import thrift.test.Nesting;
import thrift.test.OneOfEach;
import thrift.test.Srv;

public abstract class ProtocolTestBase extends TestCase {

  /** Does it make sense to call methods like writeI32 directly on your protocol? */
  protected abstract boolean canBeUsedNaked();

  /** The protocol factory for the protocol being tested. */
  protected abstract TProtocolFactory getFactory();

  public void testDouble() throws Exception {
    if (canBeUsedNaked()) {
      TMemoryBuffer buf = new TMemoryBuffer(1000);
      TProtocol proto = getFactory().getProtocol(buf);
      proto.writeDouble(123.456);
      assertEquals(123.456, proto.readDouble());
    }

    internalTestStructField(new StructFieldTestCase(TType.DOUBLE, (short)15) {
      @Override
      public void readMethod(TProtocol proto) throws TException {
        assertEquals(123.456, proto.readDouble());
      }

      @Override
      public void writeMethod(TProtocol proto) throws TException {
        proto.writeDouble(123.456);
      }
    });
  }

  public void testSerialization() throws Exception {
    internalTestSerialization(OneOfEach.class, Fixtures.oneOfEach);
    internalTestSerialization(Nesting.class, Fixtures.nesting);
    internalTestSerialization(HolyMoley.class, Fixtures.holyMoley);
    internalTestSerialization(CompactProtoTestStruct.class, Fixtures.compactProtoTestStruct);
  }

  public void testBinary() throws Exception {
    for (byte[] b : Arrays.asList(new byte[0],
                                  new byte[]{0,1,2,3,4,5,6,7,8,9,10},
                                  new byte[]{0,1,2,3,4,5,6,7,8,9,10,11,12,13,14},
                                  new byte[]{0x5D},
                                  new byte[]{(byte)0xD5,(byte)0x5D},
                                  new byte[]{(byte)0xFF,(byte)0xD5,(byte)0x5D},
                                  new byte[128])) {
      if (canBeUsedNaked()) {
        internalTestNakedBinary(b);
      }
      internalTestBinaryField(b);
    }

    if (canBeUsedNaked()) {
      byte[] data = {1, 2, 3, 4, 5, 6};

      TMemoryBuffer buf = new TMemoryBuffer(0);
      TProtocol proto = getFactory().getProtocol(buf);
      ByteBuffer bb = ByteBuffer.wrap(data);
      bb.get();
      proto.writeBinary(bb.slice());
      assertEquals(ByteBuffer.wrap(data, 1, 5), proto.readBinary());
    }
  }

  public void testString() throws Exception {
    for (String s : Arrays.asList("", "short", "borderlinetiny", "a bit longer than the smallest possible")) {
      if (canBeUsedNaked()) {
        internalTestNakedString(s);
      }
      internalTestStringField(s);
    }
  }

  public void testLong() throws Exception {
    if (canBeUsedNaked()) {
      internalTestNakedI64(0);
    }
    internalTestI64Field(0);
    for (int i = 0; i < 62; i++) {
      if (canBeUsedNaked()) {
        internalTestNakedI64(1L << i);
        internalTestNakedI64(-(1L << i));
      }
      internalTestI64Field(1L << i);
      internalTestI64Field(-(1L << i));
    }
  }

  public void testInt() throws Exception {
    for (int i : Arrays.asList(0, 1, 7, 150, 15000, 31337, 0xffff, 0xffffff, -1, -7, -150, -15000, -0xffff, -0xffffff)) {
      if (canBeUsedNaked()) {
        internalTestNakedI32(i);
      }
      internalTestI32Field(i);
    }
  }

  public void testShort() throws Exception {
    for (int s : Arrays.asList(0, 1, 7, 150, 15000, 0x7fff, -1, -7, -150, -15000, -0x7fff)) {
      if (canBeUsedNaked()) {
        internalTestNakedI16((short)s);
      }
      internalTestI16Field((short)s);
    }
  }

  public void testByte() throws Exception {
    if (canBeUsedNaked()) {
      internalTestNakedByte();
    }
    for (int i = 0; i < 128; i++) {
      internalTestByteField((byte)i);
      internalTestByteField((byte)-i);
    }
  }

  private void internalTestNakedByte() throws Exception {
    TMemoryBuffer buf = new TMemoryBuffer(1000);
    TProtocol proto = getFactory().getProtocol(buf);
    proto.writeByte((byte)123);
    assertEquals((byte) 123, proto.readByte());
  }

  private void internalTestByteField(final byte b) throws Exception {
    internalTestStructField(new StructFieldTestCase(TType.BYTE, (short)15) {
      public void writeMethod(TProtocol proto) throws TException {
        proto.writeByte(b);
      }

      public void readMethod(TProtocol proto) throws TException {
        assertEquals((byte)b, proto.readByte());
      }
    });
  }

  private void internalTestNakedI16(short n) throws Exception {
    TMemoryBuffer buf = new TMemoryBuffer(0);
    TProtocol proto = getFactory().getProtocol(buf);
    proto.writeI16(n);
    assertEquals(n, proto.readI16());
  }

  private void internalTestI16Field(final short n) throws Exception {
    internalTestStructField(new StructFieldTestCase(TType.I16, (short)15) {
      public void writeMethod(TProtocol proto) throws TException {
        proto.writeI16(n);
      }

      public void readMethod(TProtocol proto) throws TException {
        assertEquals(n, proto.readI16());
      }
    });
  }

  private void internalTestNakedI32(int n) throws Exception {
    TMemoryBuffer buf = new TMemoryBuffer(0);
    TProtocol proto = getFactory().getProtocol(buf);
    proto.writeI32(n);
    assertEquals(n, proto.readI32());
  }

  private void internalTestI32Field(final int n) throws Exception {
    internalTestStructField(new StructFieldTestCase(TType.I32, (short)15) {
      public void writeMethod(TProtocol proto) throws TException {
        proto.writeI32(n);
      }

      public void readMethod(TProtocol proto) throws TException {
        assertEquals(n, proto.readI32());
      }
    });
  }

  private void internalTestNakedI64(long n) throws Exception {
    TMemoryBuffer buf = new TMemoryBuffer(0);
    TProtocol proto = getFactory().getProtocol(buf);
    proto.writeI64(n);
    assertEquals(n, proto.readI64());
  }

  private void internalTestI64Field(final long n) throws Exception {
    internalTestStructField(new StructFieldTestCase(TType.I64, (short)15) {
      public void writeMethod(TProtocol proto) throws TException {
        proto.writeI64(n);
      }

      public void readMethod(TProtocol proto) throws TException {
        assertEquals(n, proto.readI64());
      }
    });
  }

  private void internalTestNakedString(String str) throws Exception {
    TMemoryBuffer buf = new TMemoryBuffer(0);
    TProtocol proto = getFactory().getProtocol(buf);
    proto.writeString(str);
    assertEquals(str, proto.readString());
  }

  private void internalTestStringField(final String str) throws Exception {
    internalTestStructField(new StructFieldTestCase(TType.STRING, (short)15) {
      public void writeMethod(TProtocol proto) throws TException {
        proto.writeString(str);
      }

      public void readMethod(TProtocol proto) throws TException {
        assertEquals(str, proto.readString());
      }
    });
  }

  private void internalTestNakedBinary(byte[] data) throws Exception {
    TMemoryBuffer buf = new TMemoryBuffer(0);
    TProtocol proto = getFactory().getProtocol(buf);
    proto.writeBinary(ByteBuffer.wrap(data));
    assertEquals(ByteBuffer.wrap(data), proto.readBinary());
  }

  private void internalTestBinaryField(final byte[] data) throws Exception {
    internalTestStructField(new StructFieldTestCase(TType.STRING, (short)15) {
      public void writeMethod(TProtocol proto) throws TException {
        proto.writeBinary(ByteBuffer.wrap(data));
      }

      public void readMethod(TProtocol proto) throws TException {
        assertEquals(ByteBuffer.wrap(data), proto.readBinary());
      }
    });
  }

  private <T extends TBase> void internalTestSerialization(Class<T> klass, T expected) throws Exception {
    TMemoryBuffer buf = new TMemoryBuffer(0);
    TBinaryProtocol binproto = new TBinaryProtocol(buf);

    expected.write(binproto);

    buf = new TMemoryBuffer(0);
    TProtocol proto = getFactory().getProtocol(buf);

    expected.write(proto);
    System.out.println("Size in " +  proto.getClass().getSimpleName() + ": " + buf.length());

    T actual = klass.newInstance();
    actual.read(proto);
    assertEquals(expected, actual);
  }

  public void testMessage() throws Exception {
    List<TMessage> msgs = Arrays.asList(new TMessage[]{
      new TMessage("short message name", TMessageType.CALL, 0),
      new TMessage("1", TMessageType.REPLY, 12345),
      new TMessage("loooooooooooooooooooooooooooooooooong", TMessageType.EXCEPTION, 1 << 16),
      new TMessage("Janky", TMessageType.CALL, 0),
    });

    for (TMessage msg : msgs) {
      TMemoryBuffer buf = new TMemoryBuffer(0);
      TProtocol proto = getFactory().getProtocol(buf);
      TMessage output = null;

      proto.writeMessageBegin(msg);
      proto.writeMessageEnd();

      output = proto.readMessageBegin();

      assertEquals(msg, output);
    }
  }

  public void testServerRequest() throws Exception {
    Srv.Iface handler = new Srv.Iface() {
      public int Janky(int i32arg) throws TException {
        return i32arg * 2;
      }

      public int primitiveMethod() throws TException {
        return 0;
      }

      public CompactProtoTestStruct structMethod() throws TException {
        return null;
      }

      public void voidMethod() throws TException {
      }

      public void methodWithDefaultArgs(int something) throws TException {
      }

      @Override
      public void onewayMethod() throws TException {
      }

      @Override
      public boolean declaredExceptionMethod(boolean shouldThrow) throws TException {
        return shouldThrow;
      }
    };

    Srv.Processor testProcessor = new Srv.Processor(handler);

    TMemoryBuffer clientOutTrans = new TMemoryBuffer(0);
    TProtocol clientOutProto = getFactory().getProtocol(clientOutTrans);
    TMemoryBuffer clientInTrans = new TMemoryBuffer(0);
    TProtocol clientInProto = getFactory().getProtocol(clientInTrans);

    Srv.Client testClient = new Srv.Client(clientInProto, clientOutProto);

    testClient.send_Janky(1);
    // System.out.println(clientOutTrans.inspect());
    testProcessor.process(clientOutProto, clientInProto);
    // System.out.println(clientInTrans.inspect());
    assertEquals(2, testClient.recv_Janky());
  }

  public void testTDeserializer() throws TException {
    TSerializer ser = new TSerializer(getFactory());
    byte[] bytes = ser.serialize(Fixtures.compactProtoTestStruct);

    TDeserializer deser = new TDeserializer(getFactory());
    CompactProtoTestStruct cpts = new CompactProtoTestStruct();
    deser.deserialize(cpts, bytes);

    assertEquals(Fixtures.compactProtoTestStruct, cpts);
  }

  //
  // Helper methods
  //

  private void internalTestStructField(StructFieldTestCase testCase) throws Exception {
    TMemoryBuffer buf = new TMemoryBuffer(0);
    TProtocol proto = getFactory().getProtocol(buf);

    TField field = new TField("test_field", testCase.type_, testCase.id_);
    proto.writeStructBegin(new TStruct("test_struct"));
    proto.writeFieldBegin(field);
    testCase.writeMethod(proto);
    proto.writeFieldEnd();
    proto.writeStructEnd();

    proto.readStructBegin();
    TField readField = proto.readFieldBegin();
    assertEquals(testCase.id_, readField.id);
    assertEquals(testCase.type_, readField.type);
    testCase.readMethod(proto);
    proto.readStructEnd();
  }

  private static abstract class StructFieldTestCase {
    byte type_;
    short id_;
    public StructFieldTestCase(byte type, short id) {
      type_ = type;
      id_ = id;
    }

    public abstract void writeMethod(TProtocol proto) throws TException;
    public abstract void readMethod(TProtocol proto) throws TException;
  }

  private static final int NUM_TRIALS = 5;
  private static final int NUM_REPS = 10000;

  protected void benchmark() throws Exception {
    for (int trial = 0; trial < NUM_TRIALS; trial++) {
      TSerializer ser = new TSerializer(getFactory());
      byte[] serialized = null;
      long serStart = System.currentTimeMillis();
      for (int rep = 0; rep < NUM_REPS; rep++) {
        serialized = ser.serialize(Fixtures.holyMoley);
      }
      long serEnd = System.currentTimeMillis();
      long serElapsed = serEnd - serStart;
      System.out.println("Ser:\t" + serElapsed + "ms\t" 
          + ((double)serElapsed / NUM_REPS) + "ms per serialization");

      HolyMoley cpts = new HolyMoley();
      TDeserializer deser = new TDeserializer(getFactory());
      long deserStart = System.currentTimeMillis();
      for (int rep = 0; rep < NUM_REPS; rep++) {
        deser.deserialize(cpts, serialized);
      }
      long deserEnd = System.currentTimeMillis();
      long deserElapsed = deserEnd - deserStart;
      System.out.println("Des:\t" + deserElapsed + "ms\t" 
          + ((double)deserElapsed / NUM_REPS) + "ms per deserialization");
    }
  }
}
