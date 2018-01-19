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

import java.io.UnsupportedEncodingException;

import junit.framework.TestCase;

import org.apache.thrift.Fixtures;
import org.apache.thrift.TException;
import org.apache.thrift.transport.TMemoryBuffer;

import thrift.test.CompactProtoTestStruct;
import thrift.test.HolyMoley;

public class TestTSimpleJSONProtocol extends TestCase {
  private TMemoryBuffer buf;
  private TSimpleJSONProtocol proto;

  @Override
  protected void setUp() throws Exception {
    buf = new TMemoryBuffer(1000);
    proto = new TSimpleJSONProtocol(buf);
  }

  private String bufToString() {
    try {
      return buf.toString("UTF-8");
    } catch (UnsupportedEncodingException e) {
      throw new RuntimeException(e);
    }
  }

  public void testHolyMoley() throws TException {
    final HolyMoley holyMoley = Fixtures.holyMoley.deepCopy();
    // unset sets that produce inconsistent ordering between JDK7/8
    holyMoley.unsetBonks();
    holyMoley.unsetContain();
    holyMoley.write(proto);
    assertEquals("{\"big\":[{\"im_true\":1,\"im_false\":0,\"a_bite\":35,\"integer16\":27000,\"integer32\":16777216,\"integer64\":6000000000,\"double_precision\":3.141592653589793,\"some_characters\":\"JSON THIS! \\\"\\u0001\",\"zomg_unicode\":\"ӀⅮΝ Нοⅿоɡгаρℎ Αttαⅽκ�‼\",\"what_who\":0,\"base64\":\"base64\",\"byte_list\":[1,2,3],\"i16_list\":[1,2,3],\"i64_list\":[1,2,3]},{\"im_true\":1,\"im_false\":0,\"a_bite\":-42,\"integer16\":27000,\"integer32\":16777216,\"integer64\":6000000000,\"double_precision\":3.141592653589793,\"some_characters\":\"JSON THIS! \\\"\\u0001\",\"zomg_unicode\":\"ӀⅮΝ Нοⅿоɡгаρℎ Αttαⅽκ�‼\",\"what_who\":0,\"base64\":\"base64\",\"byte_list\":[1,2,3],\"i16_list\":[1,2,3],\"i64_list\":[1,2,3]}]}", bufToString());
  }

  public void testNesting() throws TException {
    Fixtures.nesting.write(proto);
    assertEquals("{\"my_bonk\":{\"type\":31337,\"message\":\"I am a bonk... xor!\"},\"my_ooe\":{\"im_true\":1,\"im_false\":0,\"a_bite\":-42,\"integer16\":27000,\"integer32\":16777216,\"integer64\":6000000000,\"double_precision\":3.141592653589793,\"some_characters\":\"JSON THIS! \\\"\\u0001\",\"zomg_unicode\":\"ӀⅮΝ Нοⅿоɡгаρℎ Αttαⅽκ�‼\",\"what_who\":0,\"base64\":\"base64\",\"byte_list\":[1,2,3],\"i16_list\":[1,2,3],\"i64_list\":[1,2,3]}}", bufToString());
  }

  public void testOneOfEach() throws TException {
    Fixtures.oneOfEach.write(proto);
    assertEquals("{\"im_true\":1,\"im_false\":0,\"a_bite\":-42,\"integer16\":27000,\"integer32\":16777216,\"integer64\":6000000000,\"double_precision\":3.141592653589793,\"some_characters\":\"JSON THIS! \\\"\\u0001\",\"zomg_unicode\":\"ӀⅮΝ Нοⅿоɡгаρℎ Αttαⅽκ�‼\",\"what_who\":0,\"base64\":\"base64\",\"byte_list\":[1,2,3],\"i16_list\":[1,2,3],\"i64_list\":[1,2,3]}", bufToString());
  }

  public void testSanePartsOfCompactProtoTestStruct() throws TException {
    // unset all the maps with container keys
    CompactProtoTestStruct struct = Fixtures.compactProtoTestStruct.deepCopy();
    struct.unsetList_byte_map();
    struct.unsetSet_byte_map();
    struct.unsetMap_byte_map();
    // unset sets and maps that produce inconsistent ordering between JDK7/8
    struct.unsetByte_set();
    struct.unsetI16_set();
    struct.unsetI64_set();
    struct.unsetDouble_set();
    struct.unsetString_set();
    struct.unsetI16_byte_map();
    struct.unsetI32_byte_map();
    struct.unsetI64_byte_map();
    struct.unsetDouble_byte_map();
    struct.unsetString_byte_map();
    struct.write(proto);
    assertEquals("{\"a_byte\":127,\"a_i16\":32000,\"a_i32\":1000000000,\"a_i64\":1099511627775,\"a_double\":5.6789,\"a_string\":\"my string\",\"a_binary\":\"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\",\"true_field\":1,\"false_field\":0,\"empty_struct_field\":{},\"byte_list\":[-127,-1,0,1,127],\"i16_list\":[-1,0,1,32767],\"i32_list\":[-1,0,255,65535,16777215,2147483647],\"i64_list\":[-1,0,255,65535,16777215,4294967295,1099511627775,281474976710655,72057594037927935,9223372036854775807],\"double_list\":[0.1,0.2,0.3],\"string_list\":[\"first\",\"second\",\"third\"],\"boolean_list\":[1,1,1,0,0,0],\"struct_list\":[{},{}],\"i32_set\":[1,2,3],\"boolean_set\":[0,1],\"struct_set\":[{}],\"byte_byte_map\":{\"1\":2},\"boolean_byte_map\":{\"0\":0,\"1\":1},\"byte_i16_map\":{\"1\":1,\"2\":-1,\"3\":32767},\"byte_i32_map\":{\"1\":1,\"2\":-1,\"3\":2147483647},\"byte_i64_map\":{\"1\":1,\"2\":-1,\"3\":9223372036854775807},\"byte_double_map\":{\"1\":0.1,\"2\":-0.1,\"3\":1000000.0},\"byte_string_map\":{\"1\":\"\",\"2\":\"blah\",\"3\":\"loooooooooooooong string\"},\"byte_boolean_map\":{\"1\":1,\"2\":0},\"byte_map_map\":{\"0\":{},\"1\":{\"1\":1},\"2\":{\"1\":1,\"2\":2}},\"byte_set_map\":{\"0\":[],\"1\":[1],\"2\":[1,2]},\"byte_list_map\":{\"0\":[],\"1\":[1],\"2\":[1,2]}}", bufToString());
  }

  public void testThrowsOnCollectionKeys() throws TException {
    try {
      Fixtures.compactProtoTestStruct.write(proto);
      fail("this should throw a CollectionMapKeyException");
    } catch (TSimpleJSONProtocol.CollectionMapKeyException e) {
      //
    }
  }
}
