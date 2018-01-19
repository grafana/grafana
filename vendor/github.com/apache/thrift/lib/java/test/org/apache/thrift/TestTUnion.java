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

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import junit.framework.TestCase;

import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TTupleProtocol;
import org.apache.thrift.transport.TMemoryBuffer;

import thrift.test.ComparableUnion;
import thrift.test.Empty;
import thrift.test.RandomStuff;
import thrift.test.SomeEnum;
import thrift.test.StructWithAUnion;
import thrift.test.TestUnion;
import thrift.test.TestUnionMinusStringField;

public class TestTUnion extends TestCase {

  public void testBasic() throws Exception {
    TestUnion union = new TestUnion();

    assertFalse(union.isSet());
    assertFalse(union.isSetI32_field());
    assertNull(union.getFieldValue());

    union = new TestUnion(TestUnion._Fields.I32_FIELD, 25);

    assertEquals(Integer.valueOf(25), union.getFieldValue());
  
    assertEquals(Integer.valueOf(25), union.getFieldValue(TestUnion._Fields.I32_FIELD));
    
    assertTrue(union.isSetI32_field());
  
    try {
      union.getFieldValue(TestUnion._Fields.STRING_FIELD);
      fail("should have thrown an exception");
    } catch (IllegalArgumentException e) {
      // cool!
    }

    union = new TestUnion();

    // should not throw an exception here
    union.hashCode();

    union.setI32_field(1);
    assertEquals(1, union.getI32_field());
    union.hashCode();

    assertFalse(union.isSetString_field());
    
    try {
      union.getString_field();
      fail("should have thrown an exception");
    } catch (Exception e) {
      // sweet
    }

    union = TestUnion.i32_field(1);

    assertFalse(union.equals((TestUnion)null));

    union = TestUnion.enum_field(SomeEnum.ONE);
    union.hashCode();

    union = new TestUnion();
    // should not throw an exception
    union.toString();
  }

  public void testCompareTo() throws Exception {
    ComparableUnion cu = ComparableUnion.string_field("a");
    ComparableUnion cu2 = ComparableUnion.string_field("b");

    assertTrue(cu.compareTo(cu) == 0);
    assertTrue(cu2.compareTo(cu2) == 0);

    assertTrue(cu.compareTo(cu2) < 0);
    assertTrue(cu2.compareTo(cu) > 0);

    cu2 = ComparableUnion.binary_field(ByteBuffer.wrap(new byte[]{2}));

    assertTrue(cu.compareTo(cu2) < 0);
    assertTrue(cu2.compareTo(cu) > 0);

    cu = ComparableUnion.binary_field(ByteBuffer.wrap(new byte[]{1}));

    assertTrue(cu.compareTo(cu2) < 0);
    assertTrue(cu2.compareTo(cu) > 0);
    
    TestUnion union1 = new TestUnion(TestUnion._Fields.STRUCT_LIST, new ArrayList<RandomStuff>());
    TestUnion union2 = new TestUnion(TestUnion._Fields.STRUCT_LIST, new ArrayList<RandomStuff>());
    assertTrue(union1.compareTo(union2) == 0);

    TestUnion union3 = new TestUnion(TestUnion._Fields.I32_SET, new HashSet<Integer>());
    Set<Integer> i32_set = new HashSet<Integer>();
    i32_set.add(1);
    TestUnion union4 = new TestUnion(TestUnion._Fields.I32_SET, i32_set);
    assertTrue(union3.compareTo(union4) < 0);

    Map<Integer, Integer> i32_map = new HashMap<Integer, Integer>();
    i32_map.put(1,1);
    TestUnion union5 = new TestUnion(TestUnion._Fields.I32_MAP, i32_map);
    TestUnion union6 = new TestUnion(TestUnion._Fields.I32_MAP, new HashMap<Integer, Integer>());
    assertTrue(union5.compareTo(union6) > 0);
  }

  public void testEquality() throws Exception {
    TestUnion union = new TestUnion(TestUnion._Fields.I32_FIELD, 25);

    TestUnion otherUnion = new TestUnion(TestUnion._Fields.STRING_FIELD, "blah!!!");

    assertFalse(union.equals(otherUnion));

    otherUnion = new TestUnion(TestUnion._Fields.I32_FIELD, 400);

    assertFalse(union.equals(otherUnion));

    otherUnion = new TestUnion(TestUnion._Fields.OTHER_I32_FIELD, 25);

    assertFalse(union.equals(otherUnion));
  }

  public void testSerialization() throws Exception {
    TestUnion union = new TestUnion(TestUnion._Fields.I32_FIELD, 25);
    union.setI32_set(Collections.singleton(42));

    TMemoryBuffer buf = new TMemoryBuffer(0);
    TProtocol proto = new TBinaryProtocol(buf);

    union.write(proto);

    TestUnion u2 = new TestUnion();

    u2.read(proto);

    assertEquals(u2, union);

    StructWithAUnion swau = new StructWithAUnion(u2);

    buf = new TMemoryBuffer(0);
    proto = new TBinaryProtocol(buf);

    swau.write(proto);

    StructWithAUnion swau2 = new StructWithAUnion();
    assertFalse(swau2.equals(swau));
    swau2.read(proto);
    assertEquals(swau2, swau);

    // this should NOT throw an exception.
    buf = new TMemoryBuffer(0);
    proto = new TBinaryProtocol(buf);

    swau.write(proto);
    new Empty().read(proto);
  }
  
  public void testTupleProtocolSerialization () throws Exception {
    TestUnion union = new TestUnion(TestUnion._Fields.I32_FIELD, 25);
    union.setI32_set(Collections.singleton(42));

    TMemoryBuffer buf = new TMemoryBuffer(0);
    TProtocol proto = new TTupleProtocol(buf);

    union.write(proto);

    TestUnion u2 = new TestUnion();

    u2.read(proto);

    assertEquals(u2, union);

    StructWithAUnion swau = new StructWithAUnion(u2);

    buf = new TMemoryBuffer(0);
    proto = new TBinaryProtocol(buf);

    swau.write(proto);

    StructWithAUnion swau2 = new StructWithAUnion();
    assertFalse(swau2.equals(swau));
    swau2.read(proto);
    assertEquals(swau2, swau);

    // this should NOT throw an exception.
    buf = new TMemoryBuffer(0);
    proto = new TTupleProtocol(buf);

    swau.write(proto);
    new Empty().read(proto);
  }

  public void testSkip() throws Exception {
    TestUnion tu = TestUnion.string_field("string");
    byte[] tuSerialized = new TSerializer().serialize(tu);
    TestUnionMinusStringField tums = new TestUnionMinusStringField();
    new TDeserializer().deserialize(tums, tuSerialized);
    assertNull(tums.getSetField());
    assertNull(tums.getFieldValue());
  }

  public void testDeepCopy() throws Exception {
    byte[] bytes = {1, 2, 3};
    ByteBuffer value = ByteBuffer.wrap(bytes);
    ComparableUnion cu = ComparableUnion.binary_field(value);
    ComparableUnion copy = cu.deepCopy();
    assertEquals(cu, copy);
    assertNotSame(cu.bufferForBinary_field().array(), copy.bufferForBinary_field().array());
  }
  
  public void testToString() throws Exception {
    byte[] bytes = {1, 2, 3};
    ByteBuffer value = ByteBuffer.wrap(bytes);
    ComparableUnion cu = ComparableUnion.binary_field(value);
    String expectedString = "<ComparableUnion binary_field:01 02 03>";
    assertEquals(expectedString, cu.toString());
  }

  public void testJavaSerializable() throws Exception {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    ObjectOutputStream oos = new ObjectOutputStream(baos);
    
    TestUnion tu = TestUnion.string_field("string");

    // Serialize tu the Java way...
    oos.writeObject(tu);
    byte[] serialized = baos.toByteArray();

    // Attempt to deserialize it
    ByteArrayInputStream bais = new ByteArrayInputStream(serialized);
    ObjectInputStream ois = new ObjectInputStream(bais);
    TestUnion tu2 = (TestUnion) ois.readObject();

    assertEquals(tu, tu2);
  }
}
