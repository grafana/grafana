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
package org.apache.thrift;

import java.nio.ByteBuffer;

import junit.framework.TestCase;

import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TCompactProtocol;
import org.apache.thrift.protocol.TJSONProtocol;
import org.apache.thrift.protocol.TProtocolFactory;

import thrift.test.Backwards;
import thrift.test.OneOfEach;
import thrift.test.PrimitiveThenStruct;
import thrift.test.StructWithAUnion;
import thrift.test.TestUnion;

public class TestTDeserializer extends TestCase {

  private static final TProtocolFactory[] PROTOCOLS = new TProtocolFactory[] {
    new TBinaryProtocol.Factory(), 
    new TCompactProtocol.Factory(), 
    new TJSONProtocol.Factory()
  };

  public void testPartialDeserialize() throws Exception {
    //Root:StructWithAUnion
    //  1:Union
    //    1.3:OneOfEach
    OneOfEach level3OneOfEach = Fixtures.oneOfEach;
    TestUnion level2TestUnion = new TestUnion(TestUnion._Fields.STRUCT_FIELD, level3OneOfEach);
    StructWithAUnion level1SWU = new StructWithAUnion(level2TestUnion);

    Backwards bw = new Backwards(2, 1);
    PrimitiveThenStruct pts = new PrimitiveThenStruct(12345, 67890, bw);

    for (TProtocolFactory factory : PROTOCOLS) {

      //Level 2 test
      testPartialDeserialize(factory, level1SWU, new TestUnion(), level2TestUnion, StructWithAUnion._Fields.TEST_UNION);

      //Level 3 on 3rd field test
      testPartialDeserialize(factory, level1SWU, new OneOfEach(), level3OneOfEach, StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD);

      //Test early termination when traversed path Field.id exceeds the one being searched for
      testPartialDeserialize(factory, level1SWU, new OneOfEach(), new OneOfEach(), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.I32_FIELD);

      //Test that readStructBegin isn't called on primitive
      testPartialDeserialize(factory, pts, new Backwards(), bw, PrimitiveThenStruct._Fields.BW);

      //Test primitive types
      TDeserializer deserializer = new TDeserializer(factory);

      Boolean expectedBool = level3OneOfEach.isIm_true();
      Boolean resultBool = deserializer.partialDeserializeBool(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD, OneOfEach._Fields.IM_TRUE);
      assertEquals(expectedBool, resultBool);

      Byte expectedByte = level3OneOfEach.getA_bite();
      Byte resultByte = deserializer.partialDeserializeByte(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD, OneOfEach._Fields.A_BITE);
      assertEquals(expectedByte, resultByte);

      Double expectedDouble = level3OneOfEach.getDouble_precision();
      Double resultDouble = deserializer.partialDeserializeDouble(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD, OneOfEach._Fields.DOUBLE_PRECISION);
      assertEquals(expectedDouble, resultDouble);

      Short expectedI16 = level3OneOfEach.getInteger16();
      Short resultI16 = deserializer.partialDeserializeI16(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD, OneOfEach._Fields.INTEGER16);
      assertEquals(expectedI16, resultI16);

      Integer expectedI32 = level3OneOfEach.getInteger32();
      Integer resultI32 = deserializer.partialDeserializeI32(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD, OneOfEach._Fields.INTEGER32);
      assertEquals(expectedI32, resultI32);

      Long expectedI64 = level3OneOfEach.getInteger64();
      Long resultI64= deserializer.partialDeserializeI64(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD, OneOfEach._Fields.INTEGER64);
      assertEquals(expectedI64, resultI64);

      String expectedString = level3OneOfEach.getSome_characters();
      String resultString = deserializer.partialDeserializeString(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD, OneOfEach._Fields.SOME_CHARACTERS);
      assertEquals(expectedString, resultString);

      byte[] expectedBinary = level3OneOfEach.getBase64();
      ByteBuffer resultBinary = deserializer.partialDeserializeByteArray(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION, TestUnion._Fields.STRUCT_FIELD, OneOfEach._Fields.BASE64);
      assertEquals(expectedBinary.length, resultBinary.limit() - resultBinary.position() - resultBinary.arrayOffset());
      assertEquals(ByteBuffer.wrap(expectedBinary), resultBinary);

      // Test field id in Union
      short id = deserializer.partialDeserializeSetFieldIdInUnion(serialize(level1SWU, factory), StructWithAUnion._Fields.TEST_UNION);
      assertEquals(level2TestUnion.getSetField().getThriftFieldId(), id);
    }
  }

  public static void testPartialDeserialize(TProtocolFactory protocolFactory, TBase input, TBase output, TBase expected, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    byte[] record = serialize(input, protocolFactory);
    TDeserializer deserializer = new TDeserializer(protocolFactory);
    for (int i = 0; i < 2; i++) {
      TBase outputCopy = output.deepCopy();
      deserializer.partialDeserialize(outputCopy, record, fieldIdPathFirst, fieldIdPathRest);
      assertEquals("on attempt " + i + ", with " + protocolFactory.toString() 
          + ", expected " + expected + " but got " + outputCopy,
          expected, outputCopy);
    }
  }

  private static byte[] serialize(TBase input, TProtocolFactory protocolFactory) throws TException{
    return new TSerializer(protocolFactory).serialize(input);
  }
}
