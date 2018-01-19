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
package org.apache.thrift.transport;

import java.nio.ByteBuffer;

import junit.framework.TestCase;

public class TestAutoExpandingBufferWriteTransport extends TestCase {

  public void testIt() throws Exception {
    AutoExpandingBufferWriteTransport t = new AutoExpandingBufferWriteTransport(1, 1.5);
    assertEquals(1, t.getBuf().array().length);
    byte[] b1 = new byte[]{1,2,3};
    t.write(b1);
    assertEquals(3, t.getPos());
    assertTrue(t.getBuf().array().length >= 3);
    assertEquals(ByteBuffer.wrap(b1), ByteBuffer.wrap(t.getBuf().array(), 0, 3));

    t.reset();
    assertTrue(t.getBuf().array().length >= 3);
    assertEquals(0, t.getPos());
    byte[] b2 = new byte[]{4,5};
    t.write(b2);
    assertEquals(2, t.getPos());
    assertEquals(ByteBuffer.wrap(b2), ByteBuffer.wrap(t.getBuf().array(), 0, 2));
  }
}
