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
import java.util.HashMap;
import java.util.Map;

import junit.framework.TestCase;

import org.apache.thrift.meta_data.FieldMetaData;
import org.apache.thrift.meta_data.ListMetaData;
import org.apache.thrift.meta_data.MapMetaData;
import org.apache.thrift.meta_data.SetMetaData;
import org.apache.thrift.meta_data.StructMetaData;
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TType;

import thrift.test.Bonk;
import thrift.test.CrazyNesting;
import thrift.test.HolyMoley;
import thrift.test.Insanity;
import thrift.test.JavaTestHelper;
import thrift.test.Nesting;
import thrift.test.Numberz;
import thrift.test.OneOfEach;
import thrift.test.StructA;
import thrift.test.StructB;
import thrift.test.Xtruct;

public class TestStruct extends TestCase {
  public void testIdentity() throws Exception {
    TSerializer   binarySerializer   = new   TSerializer(new TBinaryProtocol.Factory());
    TDeserializer binaryDeserializer = new TDeserializer(new TBinaryProtocol.Factory());

    OneOfEach ooe = Fixtures.oneOfEach;

    Nesting n = new Nesting();
    n.my_ooe = ooe;
    n.my_ooe.integer16 = 16;
    n.my_ooe.integer32 = 32;
    n.my_ooe.integer64 = 64;
    n.my_ooe.double_precision = (Math.sqrt(5)+1)/2;
    n.my_ooe.some_characters  = ":R (me going \"rrrr\")";
    n.my_ooe.zomg_unicode     = "\u04c0\u216e\u039d\u0020\u041d\u03bf\u217f"+
                                "\u043e\u0261\u0433\u0430\u03c1\u210e\u0020"+
                                "\u0391\u0074\u0074\u03b1\u217d\u03ba\u01c3"+
                                "\u203c";
    n.my_bonk = Fixtures.nesting.my_bonk;

    HolyMoley hm = Fixtures.holyMoley;

    OneOfEach ooe2 = new OneOfEach();
    binaryDeserializer.deserialize(
        ooe2,
        binarySerializer.serialize(ooe));

    assertEquals(ooe, ooe2);
    assertEquals(ooe.hashCode(), ooe2.hashCode());


    Nesting n2 = new Nesting();
    binaryDeserializer.deserialize(
        n2,
        binarySerializer.serialize(n));

    assertEquals(n, n2);
    assertEquals(n.hashCode(), n2.hashCode());

    HolyMoley hm2 = new HolyMoley();
    binaryDeserializer.deserialize(
        hm2,
        binarySerializer.serialize(hm));

    assertEquals(hm, hm2);
    assertEquals(hm.hashCode(), hm2.hashCode());
  }

  public void testDeepCopy() throws Exception {
    TSerializer   binarySerializer   = new   TSerializer(new TBinaryProtocol.Factory());
    TDeserializer binaryDeserializer = new TDeserializer(new TBinaryProtocol.Factory());

    HolyMoley hm = Fixtures.holyMoley;

    byte[] binaryCopy = binarySerializer.serialize(hm);
    HolyMoley hmCopy = new HolyMoley();
    binaryDeserializer.deserialize(hmCopy, binaryCopy);
    HolyMoley hmCopy2 = new HolyMoley(hm);

    assertEquals(hm, hmCopy);
    assertEquals(hmCopy, hmCopy2);

    // change binary value in original object
    hm.big.get(0).base64.array()[0]++;
    // make sure the change didn't propagate to the copied object
    assertFalse(hm.equals(hmCopy2));
    hm.big.get(0).base64.array()[0]--; // undo change

    hmCopy2.bonks.get("two").get(1).message = "What else?";

    assertFalse(hm.equals(hmCopy2));
  }

  public void testCompareTo() throws Exception {
    Bonk bonk1 = new Bonk();
    Bonk bonk2 = new Bonk();

    // Compare empty thrift objects.
    assertEquals(0, bonk1.compareTo(bonk2));

    bonk1.setMessage("m");

    // Compare one thrift object with a filled in field and another without it.
    assertTrue(bonk1.compareTo(bonk2) > 0);
    assertTrue(bonk2.compareTo(bonk1) < 0);

    // Compare both have filled-in fields.
    bonk2.setMessage("z");
    assertTrue(bonk1.compareTo(bonk2) < 0);
    assertTrue(bonk2.compareTo(bonk1) > 0);

    // Compare bonk1 has a field filled in that bonk2 doesn't.
    bonk1.setType(123);
    assertTrue(bonk1.compareTo(bonk2) > 0);
    assertTrue(bonk2.compareTo(bonk1) < 0);

    // Compare bonk1 and bonk2 equal.
    bonk2.setType(123);
    bonk2.setMessage("m");
    assertEquals(0, bonk1.compareTo(bonk2));
  }

  public void testCompareToWithDataStructures() {
    Insanity insanity1 = new Insanity();
    Insanity insanity2 = new Insanity();

    // Both empty.
    expectEquals(insanity1, insanity2);

    insanity1.setUserMap(new HashMap<Numberz, Long>());
    // insanity1.map = {}, insanity2.map = null
    expectGreaterThan(insanity1, insanity2);

    // insanity1.map = {2:1}, insanity2.map = null
    insanity1.getUserMap().put(Numberz.TWO, 1l);
    expectGreaterThan(insanity1, insanity2);

    // insanity1.map = {2:1}, insanity2.map = {}
    insanity2.setUserMap(new HashMap<Numberz, Long>());
    expectGreaterThan(insanity1, insanity2);

    // insanity1.map = {2:1}, insanity2.map = {2:2}
    insanity2.getUserMap().put(Numberz.TWO, 2l);
    expectLessThan(insanity1, insanity2);

    // insanity1.map = {2:1, 3:5}, insanity2.map = {2:2}
    insanity1.getUserMap().put(Numberz.THREE, 5l);
    expectGreaterThan(insanity1, insanity2);

    // insanity1.map = {2:1, 3:5}, insanity2.map = {2:1, 4:5}
    insanity2.getUserMap().put(Numberz.TWO, 1l);
    insanity2.getUserMap().put(Numberz.FIVE, 5l);
    expectLessThan(insanity1, insanity2);
  }

  private void expectLessThan(Insanity insanity1, Insanity insanity2) {
    int compareTo = insanity1.compareTo(insanity2);
    assertTrue(insanity1 + " should be less than " + insanity2 + ", but is: " + compareTo, compareTo < 0);
  }

  private void expectGreaterThan(Insanity insanity1, Insanity insanity2) {
    int compareTo = insanity1.compareTo(insanity2);
    assertTrue(insanity1 + " should be greater than " + insanity2 + ", but is: " + compareTo, compareTo > 0);
  }

  private void expectEquals(Insanity insanity1, Insanity insanity2) {
    int compareTo = insanity1.compareTo(insanity2);
    assertEquals(insanity1 + " should be equal to " + insanity2 + ", but is: " + compareTo, 0, compareTo);
  }

  public void testMetaData() throws Exception {
    Map<CrazyNesting._Fields, FieldMetaData> mdMap = CrazyNesting.metaDataMap;

    // Check for struct fields existence
    assertEquals(4, mdMap.size());
    assertTrue(mdMap.containsKey(CrazyNesting._Fields.SET_FIELD));
    assertTrue(mdMap.containsKey(CrazyNesting._Fields.LIST_FIELD));
    assertTrue(mdMap.containsKey(CrazyNesting._Fields.STRING_FIELD));
    assertTrue(mdMap.containsKey(CrazyNesting._Fields.BINARY_FIELD));

    // Check for struct fields contents
    assertEquals("string_field", mdMap.get(CrazyNesting._Fields.STRING_FIELD).fieldName);
    assertEquals("list_field", mdMap.get(CrazyNesting._Fields.LIST_FIELD).fieldName);
    assertEquals("set_field", mdMap.get(CrazyNesting._Fields.SET_FIELD).fieldName);
    assertEquals("binary_field", mdMap.get(CrazyNesting._Fields.BINARY_FIELD).fieldName);

    assertEquals(TFieldRequirementType.DEFAULT, mdMap.get(CrazyNesting._Fields.STRING_FIELD).requirementType);
    assertEquals(TFieldRequirementType.REQUIRED, mdMap.get(CrazyNesting._Fields.LIST_FIELD).requirementType);
    assertEquals(TFieldRequirementType.OPTIONAL, mdMap.get(CrazyNesting._Fields.SET_FIELD).requirementType);

    assertEquals(TType.STRING, mdMap.get(CrazyNesting._Fields.STRING_FIELD).valueMetaData.type);
    assertFalse(mdMap.get(CrazyNesting._Fields.STRING_FIELD).valueMetaData.isBinary());
    assertEquals(TType.LIST, mdMap.get(CrazyNesting._Fields.LIST_FIELD).valueMetaData.type);
    assertEquals(TType.SET, mdMap.get(CrazyNesting._Fields.SET_FIELD).valueMetaData.type);
    assertEquals(TType.STRING, mdMap.get(CrazyNesting._Fields.BINARY_FIELD).valueMetaData.type);
    assertTrue(mdMap.get(CrazyNesting._Fields.BINARY_FIELD).valueMetaData.isBinary());

    // Check nested structures
    assertTrue(mdMap.get(CrazyNesting._Fields.LIST_FIELD).valueMetaData.isContainer());

    assertFalse(mdMap.get(CrazyNesting._Fields.LIST_FIELD).valueMetaData.isStruct());

    assertEquals(TType.STRUCT, ((MapMetaData)((ListMetaData)((SetMetaData)((MapMetaData)((MapMetaData)((ListMetaData)mdMap.get(CrazyNesting._Fields.LIST_FIELD).valueMetaData).elemMetaData).valueMetaData).valueMetaData).elemMetaData).elemMetaData).keyMetaData.type);

    assertEquals(Insanity.class, ((StructMetaData)((MapMetaData)((ListMetaData)((SetMetaData)((MapMetaData)((MapMetaData)((ListMetaData)mdMap.get(CrazyNesting._Fields.LIST_FIELD).valueMetaData).elemMetaData).valueMetaData).valueMetaData).elemMetaData).elemMetaData).keyMetaData).structClass);

    // Check that FieldMetaData contains a map with metadata for all generated struct classes
    assertNotNull(FieldMetaData.getStructMetaDataMap(CrazyNesting.class));
    assertNotNull(FieldMetaData.getStructMetaDataMap(Insanity.class));
    assertNotNull(FieldMetaData.getStructMetaDataMap(Xtruct.class));

    assertEquals(CrazyNesting.metaDataMap, FieldMetaData.getStructMetaDataMap(CrazyNesting.class));
    assertEquals(Insanity.metaDataMap, FieldMetaData.getStructMetaDataMap(Insanity.class));

    for (Map.Entry<? extends TFieldIdEnum, FieldMetaData> mdEntry : mdMap.entrySet()) {
      assertEquals(mdEntry.getKey(), CrazyNesting._Fields.findByName(mdEntry.getValue().fieldName));
    }

    MapMetaData vmd = (MapMetaData)Insanity.metaDataMap.get(Insanity._Fields.USER_MAP).valueMetaData;
    assertTrue(vmd.valueMetaData.isTypedef());
    assertFalse(vmd.keyMetaData.isTypedef());
  }

  public void testToString() throws Exception {
    JavaTestHelper object = new JavaTestHelper();
    object.req_int = 0;
    object.req_obj = "";

    object.req_bin = ByteBuffer.wrap(new byte[] {
      0, -1, 2, -3, 4, -5, 6, -7, 8, -9, 10, -11, 12, -13, 14, -15,
      16, -17, 18, -19, 20, -21, 22, -23, 24, -25, 26, -27, 28, -29,
      30, -31, 32, -33, 34, -35, 36, -37, 38, -39, 40, -41, 42, -43, 44,
      -45, 46, -47, 48, -49, 50, -51, 52, -53, 54, -55, 56, -57, 58, -59,
      60, -61, 62, -63, 64, -65, 66, -67, 68, -69, 70, -71, 72, -73, 74,
      -75, 76, -77, 78, -79, 80, -81, 82, -83, 84, -85, 86, -87, 88, -89,
      90, -91, 92, -93, 94, -95, 96, -97, 98, -99, 100, -101, 102, -103,
      104, -105, 106, -107, 108, -109, 110, -111, 112, -113, 114, -115,
      116, -117, 118, -119, 120, -121, 122, -123, 124, -125, 126, -127,
    });

    assertEquals("JavaTestHelper(req_int:0, req_obj:, req_bin:"+
        "00 FF 02 FD 04 FB 06 F9 08 F7 0A F5 0C F3 0E F1 10 EF 12 ED 14 "+
        "EB 16 E9 18 E7 1A E5 1C E3 1E E1 20 DF 22 DD 24 DB 26 D9 28 D7 "+
        "2A D5 2C D3 2E D1 30 CF 32 CD 34 CB 36 C9 38 C7 3A C5 3C C3 3E "+
        "C1 40 BF 42 BD 44 BB 46 B9 48 B7 4A B5 4C B3 4E B1 50 AF 52 AD "+
        "54 AB 56 A9 58 A7 5A A5 5C A3 5E A1 60 9F 62 9D 64 9B 66 99 68 "+
        "97 6A 95 6C 93 6E 91 70 8F 72 8D 74 8B 76 89 78 87 7A 85 7C 83 "+
        "7E 81)",
        object.toString());
 
    object.req_bin = ByteBuffer.wrap(new byte[] {
      0, -1, 2, -3, 4, -5, 6, -7, 8, -9, 10, -11, 12, -13, 14, -15,
      16, -17, 18, -19, 20, -21, 22, -23, 24, -25, 26, -27, 28, -29,
      30, -31, 32, -33, 34, -35, 36, -37, 38, -39, 40, -41, 42, -43, 44,
      -45, 46, -47, 48, -49, 50, -51, 52, -53, 54, -55, 56, -57, 58, -59,
      60, -61, 62, -63, 64, -65, 66, -67, 68, -69, 70, -71, 72, -73, 74,
      -75, 76, -77, 78, -79, 80, -81, 82, -83, 84, -85, 86, -87, 88, -89,
      90, -91, 92, -93, 94, -95, 96, -97, 98, -99, 100, -101, 102, -103,
      104, -105, 106, -107, 108, -109, 110, -111, 112, -113, 114, -115,
      116, -117, 118, -119, 120, -121, 122, -123, 124, -125, 126, -127,
      0,
    });

    assertEquals("JavaTestHelper(req_int:0, req_obj:, req_bin:"+
        "00 FF 02 FD 04 FB 06 F9 08 F7 0A F5 0C F3 0E F1 10 EF 12 ED 14 "+
        "EB 16 E9 18 E7 1A E5 1C E3 1E E1 20 DF 22 DD 24 DB 26 D9 28 D7 "+
        "2A D5 2C D3 2E D1 30 CF 32 CD 34 CB 36 C9 38 C7 3A C5 3C C3 3E "+
        "C1 40 BF 42 BD 44 BB 46 B9 48 B7 4A B5 4C B3 4E B1 50 AF 52 AD "+
        "54 AB 56 A9 58 A7 5A A5 5C A3 5E A1 60 9F 62 9D 64 9B 66 99 68 "+
        "97 6A 95 6C 93 6E 91 70 8F 72 8D 74 8B 76 89 78 87 7A 85 7C 83 "+
        "7E 81...)",
        object.toString());

    object.req_bin = ByteBuffer.wrap(new byte[] {});
    object.setOpt_binIsSet(true);

    assertEquals("JavaTestHelper(req_int:0, req_obj:, req_bin:)", 
        object.toString());
  }

  private static void assertArrayEquals(byte[] expected, byte[] actual) {
    if (!java.util.Arrays.equals(expected, actual)) {
      fail("Expected byte array did not match actual.");
    }
  }

  public void testBytesBufferFeatures() throws Exception {
    
    final String testString = "testBytesBufferFeatures";
    final JavaTestHelper o = new JavaTestHelper();

    o.setReq_bin((ByteBuffer)null);
    assertNull(o.getReq_bin());

    o.setReq_bin(ByteBuffer.wrap(testString.getBytes()));
    assertArrayEquals(testString.getBytes(), o.getReq_bin());

    o.setReq_bin((byte[])null);
    assertNull(o.getReq_bin());

    o.setReq_bin(testString.getBytes());
    assertArrayEquals(testString.getBytes(), o.getReq_bin());

    o.setFieldValue(JavaTestHelper._Fields.REQ_BIN, null);
    assertNull(o.getReq_bin());

    o.setFieldValue(JavaTestHelper._Fields.REQ_BIN, testString.getBytes());
    assertArrayEquals(testString.getBytes(), o.getReq_bin());

    o.setFieldValue(JavaTestHelper._Fields.REQ_BIN, null);
    assertNull(o.getReq_bin());

    o.setFieldValue(JavaTestHelper._Fields.REQ_BIN, ByteBuffer.wrap(testString.getBytes()));
    assertArrayEquals(testString.getBytes(), o.getReq_bin());
  }

  public void testJavaSerializable() throws Exception {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    ObjectOutputStream oos = new ObjectOutputStream(baos);
    
    OneOfEach ooe = Fixtures.oneOfEach;

    // Serialize ooe the Java way...
    oos.writeObject(ooe);
    byte[] serialized = baos.toByteArray();

    // Attempt to deserialize it
    ByteArrayInputStream bais = new ByteArrayInputStream(serialized);
    ObjectInputStream ois = new ObjectInputStream(bais);
    OneOfEach ooe2 = (OneOfEach) ois.readObject();

    assertEquals(ooe, ooe2);
  }

  public void testSubStructValidation() throws Exception {
    StructA valid = new StructA("valid");
    StructA invalid = new StructA();

    StructB b = new StructB();
    try {
      b.validate();
      fail();
    } catch (TException e) {
      // expected
    }

    b = new StructB().setAb(valid);
    b.validate();

    b = new StructB().setAb(invalid);
    try {
      b.validate();
      fail();
    } catch (TException e) {
      // expected
    }

    b = new StructB().setAb(valid).setAa(invalid);
    try {
      b.validate();
      fail();
    } catch (TException e) {
      // expected
    }
  }
}
