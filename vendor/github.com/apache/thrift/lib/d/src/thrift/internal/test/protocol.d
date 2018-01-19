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
module thrift.internal.test.protocol;

import std.exception;
import thrift.transport.memory;
import thrift.protocol.base;

version (unittest):

void testContainerSizeLimit(Protocol)() if (isTProtocol!Protocol) {
  auto buffer = new TMemoryBuffer;
  auto prot = new Protocol(buffer);

  // Make sure reading fails if a container larger than the size limit is read.
  prot.containerSizeLimit = 3;

  {
    prot.writeListBegin(TList(TType.I32, 4));
    prot.writeI32(0); // Make sure size can be read e.g. for JSON protocol.
    prot.reset();

    auto e = cast(TProtocolException)collectException(prot.readListBegin());
    enforce(e && e.type == TProtocolException.Type.SIZE_LIMIT);
    prot.reset();
    buffer.reset();
  }

  {
    prot.writeMapBegin(TMap(TType.I32, TType.I32, 4));
    prot.writeI32(0); // Make sure size can be read e.g. for JSON protocol.
    prot.reset();

    auto e = cast(TProtocolException)collectException(prot.readMapBegin());
    enforce(e && e.type == TProtocolException.Type.SIZE_LIMIT);
    prot.reset();
    buffer.reset();
  }

  {
    prot.writeSetBegin(TSet(TType.I32, 4));
    prot.writeI32(0); // Make sure size can be read e.g. for JSON protocol.
    prot.reset();

    auto e = cast(TProtocolException)collectException(prot.readSetBegin());
    enforce(e && e.type == TProtocolException.Type.SIZE_LIMIT);
    prot.reset();
    buffer.reset();
  }

  // Make sure reading works if the containers are smaller than the limit or
  // no limit is set.
  foreach (limit; [3, 0, -1]) {
    prot.containerSizeLimit = limit;

    {
      prot.writeListBegin(TList(TType.I32, 2));
      prot.writeI32(0);
      prot.writeI32(1);
      prot.writeListEnd();
      prot.reset();

      auto list = prot.readListBegin();
      enforce(list.elemType == TType.I32);
      enforce(list.size == 2);
      enforce(prot.readI32() == 0);
      enforce(prot.readI32() == 1);
      prot.readListEnd();

      prot.reset();
      buffer.reset();
    }

    {
      prot.writeMapBegin(TMap(TType.I32, TType.I32, 2));
      prot.writeI32(0);
      prot.writeI32(1);
      prot.writeI32(2);
      prot.writeI32(3);
      prot.writeMapEnd();
      prot.reset();

      auto map = prot.readMapBegin();
      enforce(map.keyType == TType.I32);
      enforce(map.valueType == TType.I32);
      enforce(map.size == 2);
      enforce(prot.readI32() == 0);
      enforce(prot.readI32() == 1);
      enforce(prot.readI32() == 2);
      enforce(prot.readI32() == 3);
      prot.readMapEnd();

      prot.reset();
      buffer.reset();
    }

    {
      prot.writeSetBegin(TSet(TType.I32, 2));
      prot.writeI32(0);
      prot.writeI32(1);
      prot.writeSetEnd();
      prot.reset();

      auto set = prot.readSetBegin();
      enforce(set.elemType == TType.I32);
      enforce(set.size == 2);
      enforce(prot.readI32() == 0);
      enforce(prot.readI32() == 1);
      prot.readSetEnd();

      prot.reset();
      buffer.reset();
    }
  }
}

void testStringSizeLimit(Protocol)() if (isTProtocol!Protocol) {
  auto buffer = new TMemoryBuffer;
  auto prot = new Protocol(buffer);

  // Make sure reading fails if a string larger than the size limit is read.
  prot.stringSizeLimit = 3;

  {
    prot.writeString("asdf");
    prot.reset();

    auto e = cast(TProtocolException)collectException(prot.readString());
    enforce(e && e.type == TProtocolException.Type.SIZE_LIMIT);
    prot.reset();
    buffer.reset();
  }

  {
    prot.writeBinary([1, 2, 3, 4]);
    prot.reset();

    auto e = cast(TProtocolException)collectException(prot.readBinary());
    enforce(e && e.type == TProtocolException.Type.SIZE_LIMIT);
    prot.reset();
    buffer.reset();
  }

  // Make sure reading works if the containers are smaller than the limit or
  // no limit is set.
  foreach (limit; [3, 0, -1]) {
    prot.containerSizeLimit = limit;

    {
      prot.writeString("as");
      prot.reset();

      enforce(prot.readString() == "as");
      prot.reset();
      buffer.reset();
    }

    {
      prot.writeBinary([1, 2]);
      prot.reset();

      enforce(prot.readBinary() == [1, 2]);
      prot.reset();
      buffer.reset();
    }
  }
}
