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

import java.io.IOException;

import org.apache.thrift.TException;
import org.apache.thrift.protocol.TJSONProtocol;
import org.apache.thrift.transport.TMemoryBuffer;

public class TestTJSONProtocol extends ProtocolTestBase {
  @Override
  protected TProtocolFactory getFactory() {
    return new TJSONProtocol.Factory();
  }

  @Override
  protected boolean canBeUsedNaked() {
    return false;
  }

  public void testEscapedUnicode() throws TException, IOException {
    String jsonString = "\"hello unicode \\u0e01\\ud834\\udd1e world\"";
    String expectedString = "hello unicode \u0e01\ud834\udd1e world";

    TMemoryBuffer buffer = new TMemoryBuffer(1000);
    TJSONProtocol protocol = new TJSONProtocol(buffer);
    buffer.write(jsonString.getBytes("UTF-8"));

    assertEquals(expectedString, protocol.readString());
  }
}
