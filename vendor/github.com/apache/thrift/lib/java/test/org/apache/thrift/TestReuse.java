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

import java.util.HashSet;

import junit.framework.TestCase;

import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TType;

import thrift.test.Reuse;

// Tests reusing objects for deserialization.
//
public class TestReuse extends TestStruct {

  public void testReuseObject() throws Exception {
    TSerializer   binarySerializer   = new   TSerializer(new TBinaryProtocol.Factory());
    TDeserializer binaryDeserializer = new TDeserializer(new TBinaryProtocol.Factory());

    Reuse ru1 = new Reuse();
    HashSet<String> hs1 = new HashSet<String>();
    byte[] serBytes;    
    String st1 = new String("string1");
    String st2 = new String("string2");

    ru1.setVal1(11);
    ru1.setVal2(hs1);
    ru1.addToVal2(st1);
    
    serBytes = binarySerializer.serialize(ru1);

    // update hash set after serialization
    hs1.add(st2);

    binaryDeserializer.deserialize(ru1, serBytes);
   
    assertTrue( ru1.getVal2() == hs1 );
    assertTrue( hs1.size() == 2 );
  }

}
