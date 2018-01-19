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
import thrift.test.GuessProtocolStruct;

public class TestTProtocolUtil extends TestCase {

  public void testGuessProtocolFactory_JSON() throws Exception {

    byte[] data = "{foo}".getBytes();
    TProtocolFactory factory = TProtocolUtil.guessProtocolFactory(data, new TCompactProtocol.Factory());
    assertTrue(factory instanceof TJSONProtocol.Factory);

    // Make sure data serialized with TCompact and which starts with '{'
    // is not mistakenly guessed as serialized with JSON.

    GuessProtocolStruct s = new GuessProtocolStruct();
    s.putToMap_field("}","}");
    byte[] ser = new TSerializer(new TCompactProtocol.Factory()).serialize(s);
    factory = TProtocolUtil.guessProtocolFactory(ser, new TCompactProtocol.Factory());
    assertFalse(factory instanceof TJSONProtocol.Factory);
  }

  public void testGuessProtocolFactory_Binary() throws Exception {
    // Check that a last byte != 0 is correctly reported as Binary

    byte[] buf = new byte[1];
    for (int i = 1; i < 256; i++) {
      buf[0] = (byte) i;
      TProtocolFactory factory = TProtocolUtil.guessProtocolFactory(buf, new TCompactProtocol.Factory());
      assertTrue(factory instanceof TBinaryProtocol.Factory);
    }

    // Check that a second byte set to 0 is reported as Binary
    buf = new byte[2];
    TProtocolFactory factory = TProtocolUtil.guessProtocolFactory(buf, new TCompactProtocol.Factory());
    assertTrue(factory instanceof TBinaryProtocol.Factory);
  }

  public void testGuessProtocolFactory_Compact() throws Exception {
    // Check that a first byte > 0x10 is reported as Compact
    byte[] buf = new byte[3];
    buf[0] = 0x11; 
    TProtocolFactory factory = TProtocolUtil.guessProtocolFactory(buf, new TBinaryProtocol.Factory());
    assertTrue(factory instanceof TCompactProtocol.Factory);

    // Check that second byte >= 0x80 is reported as Compact
    buf[0] = 0;
    for (int i = 0x80; i < 0x100; i++) {
      buf[1] = (byte) i;
      factory = TProtocolUtil.guessProtocolFactory(buf, new TBinaryProtocol.Factory());
      assertTrue(factory instanceof TCompactProtocol.Factory);
    }
  }

  public void testGuessProtocolFactory_Undecided() throws Exception {
    byte[] buf = new byte[3];
    buf[1] = 0x7e;
    TProtocolFactory factory = TProtocolUtil.guessProtocolFactory(buf, new TSimpleJSONProtocol.Factory());
    assertTrue(factory instanceof TSimpleJSONProtocol.Factory);
  }
}
