/// Licensed to the Apache Software Foundation (ASF) under one
/// or more contributor license agreements. See the NOTICE file
/// distributed with this work for additional information
/// regarding copyright ownership. The ASF licenses this file
/// to you under the Apache License, Version 2.0 (the
/// "License"); you may not use this file except in compliance
/// with the License. You may obtain a copy of the License at
///
/// http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
/// KIND, either express or implied. See the License for the
/// specific language governing permissions and limitations
/// under the License.

part of thrift;

class TProtocolUtil {
  // equal to JavaScript Number.MAX_SAFE_INTEGER, 2^53 - 1
  static const int defaultRecursionLimit = 9007199254740991;

  static int maxRecursionLimit = defaultRecursionLimit;

  static skip(TProtocol prot, int type) {
    _skip(prot, type, maxRecursionLimit);
  }

  static _skip(TProtocol prot, int type, int recursionLimit) {
    if (recursionLimit <= 0) {
      throw new TProtocolError(
          TProtocolErrorType.DEPTH_LIMIT, "Depth limit exceeded");
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
          _skip(prot, field.type, recursionLimit - 1);
          prot.readFieldEnd();
        }
        prot.readStructEnd();
        break;

      case TType.MAP:
        TMap map = prot.readMapBegin();
        for (int i = 0; i < map.length; i++) {
          _skip(prot, map.keyType, recursionLimit - 1);
          _skip(prot, map.valueType, recursionLimit - 1);
        }
        prot.readMapEnd();
        break;

      case TType.SET:
        TSet set = prot.readSetBegin();
        for (int i = 0; i < set.length; i++) {
          _skip(prot, set.elementType, recursionLimit - 1);
        }
        prot.readSetEnd();
        break;

      case TType.LIST:
        TList list = prot.readListBegin();
        for (int i = 0; i < list.length; i++) {
          _skip(prot, list.elementType, recursionLimit - 1);
        }
        prot.readListEnd();
        break;

      default:
        break;
    }
  }
}
