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
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import junit.framework.TestCase;

public class TestTBaseHelper extends TestCase {
  public void testByteArrayComparison() {
    assertTrue(TBaseHelper.compareTo(new byte[]{'a','b'}, new byte[]{'a','c'}) < 0);
  }

  public void testSets() {
    Set<String> a = new HashSet<String>();
    Set<String> b = new HashSet<String>();

    assertTrue(TBaseHelper.compareTo(a, b) == 0);

    a.add("test");

    assertTrue(TBaseHelper.compareTo(a, b) > 0);

    b.add("test");

    assertTrue(TBaseHelper.compareTo(a, b) == 0);

    b.add("aardvark");

    assertTrue(TBaseHelper.compareTo(a, b) < 0);

    a.add("test2");

    assertTrue(TBaseHelper.compareTo(a, b) > 0);
  }

  public void testNestedStructures() {
    Set<List<String>> a = new HashSet<List<String>>();
    Set<List<String>> b = new HashSet<List<String>>();

    a.add(Arrays.asList(new String[] {"a","b"}));
    b.add(Arrays.asList(new String[] {"a","b", "c"}));
    a.add(Arrays.asList(new String[] {"a","b"}));
    b.add(Arrays.asList(new String[] {"a","b", "c"}));

    assertTrue(TBaseHelper.compareTo(a, b) < 0);
  }

  public void testMapsInSets() {
    Set<Map<String, Long>> a = new HashSet<Map<String, Long>>();
    Set<Map<String, Long>> b = new HashSet<Map<String, Long>>();

    assertTrue(TBaseHelper.compareTo(a, b) == 0);

    Map<String, Long> innerA = new HashMap<String, Long>();
    Map<String, Long> innerB = new HashMap<String, Long>();
    a.add(innerA);
    b.add(innerB);

    innerA.put("a", 1l);
    innerB.put("a", 2l);

    assertTrue(TBaseHelper.compareTo(a, b) < 0);
  }

  public void testByteArraysInMaps() {
    Map<byte[], Long> a = new HashMap<byte[], Long>();
    Map<byte[], Long> b = new HashMap<byte[], Long>();

    assertTrue(TBaseHelper.compareTo(a, b) == 0);

    a.put(new byte[]{'a','b'}, 1000L);
    b.put(new byte[]{'a','b'}, 1000L);
    a.put(new byte[]{'a','b', 'd'}, 1000L);
    b.put(new byte[]{'a','b', 'a'}, 1000L);
    assertTrue(TBaseHelper.compareTo(a, b) > 0);
  }

  public void testMapsWithNulls() {
    Map<String, String> a = new HashMap<String, String>();
    Map<String, String> b = new HashMap<String, String>();
    a.put("a", null);
    a.put("b", null);
    b.put("a", null);
    b.put("b", null);

    assertTrue(TBaseHelper.compareTo(a, b) == 0);
  }

  public void testMapKeyComparison() {
    Map<String, String> a = new HashMap<String, String>();
    Map<String, String> b = new HashMap<String, String>();
    a.put("a", "a");
    b.put("b", "a");

    assertTrue(TBaseHelper.compareTo(a, b) < 0);
  }

  public void testMapValueComparison() {
    Map<String, String> a = new HashMap<String, String>();
    Map<String, String> b = new HashMap<String, String>();
    a.put("a", "b");
    b.put("a", "a");

    assertTrue(TBaseHelper.compareTo(a, b) > 0);
  }

  public void testByteArraysInSets() {
    Set<byte[]> a = new HashSet<byte[]>();
    Set<byte[]> b = new HashSet<byte[]>();

    if (TBaseHelper.compareTo(a, b) != 0)
      throw new RuntimeException("Set compare failed:" + a + " vs. " + b);

    a.add(new byte[]{'a','b'});
    b.add(new byte[]{'a','b'});
    a.add(new byte[]{'a','b', 'd'});
    b.add(new byte[]{'a','b', 'a'});
    assertTrue(TBaseHelper.compareTo(a, b) > 0);
  }

  public void testByteBufferToByteArray() throws Exception {
    byte[] b1 = {10,9,8,7,6,5,4,3,2,1,0};
    byte[] b2 = TBaseHelper.byteBufferToByteArray(ByteBuffer.wrap(b1));
    assertEquals("b1 and b2 should be the exact same array (identity) due to fast path", b1, b2);

    byte[] b3 = TBaseHelper.byteBufferToByteArray(ByteBuffer.wrap(b1, 1, 3));
    assertEquals(3, b3.length);
    assertEquals(ByteBuffer.wrap(b1, 1, 3), ByteBuffer.wrap(b3));
  }

  public void testRightSize() throws Exception {
    assertNull(TBaseHelper.rightSize(null));
  }

  public void testByteBufferToString() {
    byte[] array = new byte[]{1, 2, 3};
    ByteBuffer bb = ByteBuffer.wrap(array, 1, 2);
    StringBuilder sb = new StringBuilder();
    TBaseHelper.toString(bb, sb);
    assertEquals("02 03", sb.toString());
    bb = ByteBuffer.wrap(array, 0, array.length);
    bb.position(1);
    bb = bb.slice();
    assertEquals(1, bb.arrayOffset());
    assertEquals(0, bb.position());
    assertEquals(2, bb.limit());
    sb = new StringBuilder();
    TBaseHelper.toString(bb, sb);
    assertEquals("02 03", sb.toString());
  }

  public void testCopyBinaryWithByteBuffer() throws Exception {
    byte[] bytes = new byte[]{0, 1, 2, 3, 4, 5};
    ByteBuffer b = ByteBuffer.wrap(bytes);
    ByteBuffer bCopy = TBaseHelper.copyBinary(b);
    assertEquals(b, bCopy);
    assertEquals(0, b.position());

    b = ByteBuffer.allocateDirect(6);
    b.put(bytes);
    b.position(0);
    bCopy = TBaseHelper.copyBinary(b);
    assertEquals(6, b.remaining());
    assertEquals(0, b.position());
    assertEquals(b, bCopy);

    b.mark();
    b.get();
    bCopy = TBaseHelper.copyBinary(b);
    assertEquals(ByteBuffer.wrap(bytes, 1, 5), bCopy);
    assertEquals(1, b.position());
    b.reset();
    assertEquals(0, b.position());

    assertNull(TBaseHelper.copyBinary((ByteBuffer)null));
  }

  public void testCopyBinaryWithByteArray() throws Exception {
    byte[] bytes = new byte[]{0, 1, 2, 3, 4, 5};
    byte[] copy = TBaseHelper.copyBinary(bytes);
    assertEquals(ByteBuffer.wrap(bytes), ByteBuffer.wrap(copy));
    assertNotSame(bytes, copy);

    assertNull(TBaseHelper.copyBinary((byte[])null));
  }
}
