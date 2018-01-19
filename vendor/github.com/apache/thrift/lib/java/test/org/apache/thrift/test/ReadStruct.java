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

import java.io.BufferedInputStream;
import java.io.FileInputStream;

import org.apache.thrift.Fixtures;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TProtocolFactory;
import org.apache.thrift.transport.TIOStreamTransport;
import org.apache.thrift.transport.TTransport;

import thrift.test.CompactProtoTestStruct;

public class ReadStruct {
  public static void main(String[] args) throws Exception {
    if (args.length != 2) {
      System.out.println("usage: java -cp build/classes org.apache.thrift.test.ReadStruct filename proto_factory_class");
      System.out.println("Read in an instance of CompactProtocolTestStruct from 'file', making sure that it is equivalent to Fixtures.compactProtoTestStruct. Use a protocol from 'proto_factory_class'.");
    }

    TTransport trans = new TIOStreamTransport(new BufferedInputStream(new FileInputStream(args[0])));

    TProtocolFactory factory = (TProtocolFactory)Class.forName(args[1]).newInstance();

    TProtocol proto = factory.getProtocol(trans);

    CompactProtoTestStruct cpts = new CompactProtoTestStruct();

    for (CompactProtoTestStruct._Fields fid : CompactProtoTestStruct.metaDataMap.keySet()) {
      cpts.setFieldValue(fid, null);
    }

    cpts.read(proto);

    if (cpts.equals(Fixtures.compactProtoTestStruct)) {
      System.out.println("Object verified successfully!");
    } else {
      System.out.println("Object failed verification!");
      System.out.println("Expected: " + Fixtures.compactProtoTestStruct + " but got " + cpts);
    }
  }

}
