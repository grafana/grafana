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

import org.apache.thrift.TException;

/**
 * Utility class with static methods for interacting with protocol data
 * streams.
 *
 */
public class TProtocolUtil {

  /**
   * The maximum recursive depth the skip() function will traverse before
   * throwing a TException.
   */
  private static int maxSkipDepth = Integer.MAX_VALUE;

  /**
   * Specifies the maximum recursive depth that the skip function will
   * traverse before throwing a TException.  This is a global setting, so
   * any call to skip in this JVM will enforce this value.
   *
   * @param depth  the maximum recursive depth.  A value of 2 would allow
   *    the skip function to skip a structure or collection with basic children,
   *    but it would not permit skipping a struct that had a field containing
   *    a child struct.  A value of 1 would only allow skipping of simple
   *    types and empty structs/collections.
   */
  public static void setMaxSkipDepth(int depth) {
    maxSkipDepth = depth;
  }

  /**
   * Skips over the next data element from the provided input TProtocol object.
   *
   * @param prot  the protocol object to read from
   * @param type  the next value will be interpreted as this TType value.
   */
  public static void skip(TProtocol prot, byte type)
    throws TException {
    skip(prot, type, maxSkipDepth);
  }

  /**
   * Skips over the next data element from the provided input TProtocol object.
   *
   * @param prot  the protocol object to read from
   * @param type  the next value will be interpreted as this TType value.
   * @param maxDepth  this function will only skip complex objects to this
   *   recursive depth, to prevent Java stack overflow.
   */
  public static void skip(TProtocol prot, byte type, int maxDepth)
  throws TException {
    if (maxDepth <= 0) {
      throw new TException("Maximum skip depth exceeded");
    }
    switch (type) {
      case TType.BOOL:
        prot.readBool();
        break;

      case TType.BYTE:
        prot.readByte();
        break;

      case TType.I16:
        prot.readI16();
        break;

      case TType.I32:
        prot.readI32();
        break;

      case TType.I64:
        prot.readI64();
        break;

      case TType.DOUBLE:
        prot.readDouble();
        break;

      case TType.STRING:
        prot.readBinary();
        break;

      case TType.STRUCT:
        prot.readStructBegin();
        while (true) {
          TField field = prot.readFieldBegin();
          if (field.type == TType.STOP) {
            break;
          }
          skip(prot, field.type, maxDepth - 1);
          prot.readFieldEnd();
        }
        prot.readStructEnd();
        break;

      case TType.MAP:
        TMap map = prot.readMapBegin();
        for (int i = 0; i < map.size; i++) {
          skip(prot, map.keyType, maxDepth - 1);
          skip(prot, map.valueType, maxDepth - 1);
        }
        prot.readMapEnd();
        break;

      case TType.SET:
        TSet set = prot.readSetBegin();
        for (int i = 0; i < set.size; i++) {
          skip(prot, set.elemType, maxDepth - 1);
        }
        prot.readSetEnd();
        break;

      case TType.LIST:
        TList list = prot.readListBegin();
        for (int i = 0; i < list.size; i++) {
          skip(prot, list.elemType, maxDepth - 1);
        }
        prot.readListEnd();
        break;

      default:
        break;
    }
  }

  /**
   * Attempt to determine the protocol used to serialize some data.
   *
   * The guess is based on known specificities of supported protocols.
   * In some cases, no guess can be done, in that case we return the
   * fallback TProtocolFactory.
   * To be certain to correctly detect the protocol, the first encoded
   * field should have a field id &lt; 256
   *
   * @param data The serialized data to guess the protocol for.
   * @param fallback The TProtocol to return if no guess can be made.
   * @return a Class implementing TProtocolFactory which can be used to create a deserializer.
   */
  public static TProtocolFactory guessProtocolFactory(byte[] data, TProtocolFactory fallback) {
    //
    // If the first and last bytes are opening/closing curly braces we guess the protocol as
    // being TJSONProtocol.
    // It could not be a TCompactBinary encoding for a field of type 0xb (Map)
    // with delta id 7 as the last byte for TCompactBinary is always 0.
    //

    if ('{' == data[0] && '}' == data[data.length - 1]) {
      return new TJSONProtocol.Factory();
    }

    //
    // If the last byte is not 0, then it cannot be TCompactProtocol, it must be
    // TBinaryProtocol.
    //

    if (data[data.length - 1] != 0) {
      return new TBinaryProtocol.Factory();
    }

    //
    // A first byte of value > 16 indicates TCompactProtocol was used, and the first byte
    // encodes a delta field id (id <= 15) and a field type.
    //

    if (data[0] > 0x10) {
      return new TCompactProtocol.Factory();
    }

    //
    // If the second byte is 0 then it is a field id < 256 encoded by TBinaryProtocol.
    // It cannot possibly be TCompactProtocol since a value of 0 would imply a field id
    // of 0 as the zig zag varint encoding would end.
    //

    if (data.length > 1 && 0 == data[1]) {
      return new TBinaryProtocol.Factory();
    }

    //
    // If bit 7 of the first byte of the field id is set then we have two choices:
    // 1. A field id > 63 was encoded with TCompactProtocol.
    // 2. A field id > 0x7fff (32767) was encoded with TBinaryProtocol and the last byte of the
    //    serialized data is 0.
    // Option 2 is impossible since field ids are short and thus limited to 32767.
    //

    if (data.length > 1 && (data[1] & 0x80) != 0) {
      return new TCompactProtocol.Factory();
    }

    //
    // The remaining case is either a field id <= 63 encoded as TCompactProtocol,
    // one >= 256 encoded with TBinaryProtocol with a last byte at 0, or an empty structure.
    // As we cannot really decide, we return the fallback protocol.
    //
    return fallback;
  }
}
