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

package org.apache.thrift.test;

import java.nio.ByteBuffer;
import java.util.LinkedList;

import thrift.test.OneOfEachBeans;

public class JavaBeansTest {
  public static void main(String[] args) throws Exception {
    // Test isSet methods
    OneOfEachBeans ooe = new OneOfEachBeans();

    // Nothing should be set
    if (ooe.is_set_a_bite())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_base64())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_byte_list())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_double_precision())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_i16_list())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_i64_list())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_boolean_field())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_integer16())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_integer32())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_integer64())
      throw new RuntimeException("isSet method error: unset field returned as set!");
    if (ooe.is_set_some_characters())
      throw new RuntimeException("isSet method error: unset field returned as set!");

    for (int i = 1; i < 12; i++){
      if (ooe.isSet(ooe.fieldForId(i)))
        throw new RuntimeException("isSet method error: unset field " + i + " returned as set!");
    }

    // Everything is set
    ooe.set_a_bite((byte) 1);
    ooe.set_base64(ByteBuffer.wrap("bytes".getBytes()));
    ooe.set_byte_list(new LinkedList<Byte>());
    ooe.set_double_precision(1);
    ooe.set_i16_list(new LinkedList<Short>());
    ooe.set_i64_list(new LinkedList<Long>());
    ooe.set_boolean_field(true);
    ooe.set_integer16((short) 1);
    ooe.set_integer32(1);
    ooe.set_integer64(1);
    ooe.set_some_characters("string");

    if (!ooe.is_set_a_bite())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_base64())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_byte_list())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_double_precision())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_i16_list())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_i64_list())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_boolean_field())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_integer16())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_integer32())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_integer64())
      throw new RuntimeException("isSet method error: set field returned as unset!");
    if (!ooe.is_set_some_characters())
      throw new RuntimeException("isSet method error: set field returned as unset!");

    for (int i = 1; i < 12; i++){
      if (!ooe.isSet(ooe.fieldForId(i)))
        throw new RuntimeException("isSet method error: set field " + i + " returned as unset!");
    }

    // Should throw exception when field doesn't exist
    boolean exceptionThrown = false;
    try{
      if (ooe.isSet(ooe.fieldForId(100)));
    } catch (IllegalArgumentException e){
      exceptionThrown = true;
    }
    if (!exceptionThrown)
      throw new RuntimeException("isSet method error: non-existent field provided as agument but no exception thrown!");
  }
}
