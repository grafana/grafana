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

import junit.framework.TestCase;

import thrift.test.Opt4;
import thrift.test.Opt30;
import thrift.test.Opt64;
import thrift.test.Opt80;

// Exercises the isSet methods using structs from from ManyOptionals.thrift
public class TestOptionals extends TestCase {
  public void testEncodingUtils() throws Exception {
    assertEquals((short)0x8, EncodingUtils.setBit((short)0, 3, true));
    assertEquals((short)0, EncodingUtils.setBit((short)0x8, 3, false));
    assertEquals(true, EncodingUtils.testBit((short)0x8, 3));
    assertEquals(false, EncodingUtils.testBit((short)0x8, 4));

    assertEquals((short)Short.MIN_VALUE, EncodingUtils.setBit((short)0, 15, true));
    assertEquals((short)0, EncodingUtils.setBit((short)Short.MIN_VALUE, 15, false));
    assertEquals(true, EncodingUtils.testBit(Short.MIN_VALUE, 15));
    assertEquals(false, EncodingUtils.testBit(Short.MIN_VALUE, 14));
  }

  public void testOpt4() throws Exception {
    Opt4 x = new Opt4();
    assertEquals(false, x.isSetDef1());
    x.setDef1(3);
    assertEquals(true, x.isSetDef1());
    assertEquals(false, x.isSetDef2());

    Opt4 copy = new Opt4(x);
    assertEquals(true, copy.isSetDef1());
    copy.unsetDef1();
    assertEquals(false, copy.isSetDef1());
    assertEquals(true, x.isSetDef1());
  }

  public void testOpt30() throws Exception {
    Opt30 x = new Opt30();
    assertEquals(false, x.isSetDef1());
    x.setDef1(3);
    assertEquals(true, x.isSetDef1());
    assertEquals(false, x.isSetDef2());
  }

  public void testOpt64() throws Exception {
    Opt64 x = new Opt64();
    assertEquals(false, x.isSetDef1());
    x.setDef1(3);
    assertEquals(true, x.isSetDef1());
    assertEquals(false, x.isSetDef2());
    x.setDef64(22);
    assertEquals(true, x.isSetDef64());
    assertEquals(false, x.isSetDef63());
  }

  public void testOpt80() throws Exception {
    Opt80 x = new Opt80();
    assertEquals(false, x.isSetDef1());
    x.setDef1(3);
    assertEquals(true, x.isSetDef1());
    assertEquals(false, x.isSetDef2());

    Opt80 copy = new Opt80(x);
    copy.unsetDef1();
    assertEquals(false, copy.isSetDef1());
    assertEquals(true, x.isSetDef1());
  }
}
