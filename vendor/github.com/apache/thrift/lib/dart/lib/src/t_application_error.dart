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

class TApplicationErrorType {
  static const int UNKNOWN = 0;
  static const int UNKNOWN_METHOD = 1;
  static const int INVALID_MESSAGE_TYPE = 2;
  static const int WRONG_METHOD_NAME = 3;
  static const int BAD_SEQUENCE_ID = 4;
  static const int MISSING_RESULT = 5;
  static const int INTERNAL_ERROR = 6;
  static const int PROTOCOL_ERROR = 7;
  static const int INVALID_TRANSFORM = 8;
  static const int INVALID_PROTOCOL = 9;
  static const int UNSUPPORTED_CLIENT_TYPE = 10;
}

class TApplicationError extends TError {
  static final TStruct _struct = new TStruct("TApplicationError");
  static const int MESSAGE = 1;
  static final TField _messageField =
      new TField("message", TType.STRING, MESSAGE);
  static const int TYPE = 2;
  static final TField _typeField = new TField("type", TType.I32, TYPE);

  TApplicationError(
      [int type = TApplicationErrorType.UNKNOWN, String message = ""])
      : super(type, message);

  static TApplicationError read(TProtocol iprot) {
    TField field;

    String message = null;
    int type = TApplicationErrorType.UNKNOWN;

    iprot.readStructBegin();
    while (true) {
      field = iprot.readFieldBegin();

      if (field.type == TType.STOP) {
        break;
      }

      switch (field.id) {
        case MESSAGE:
          if (field.type == TType.STRING) {
            message = iprot.readString();
          } else {
            TProtocolUtil.skip(iprot, field.type);
          }
          break;

        case TYPE:
          if (field.type == TType.I32) {
            type = iprot.readI32();
          } else {
            TProtocolUtil.skip(iprot, field.type);
          }
          break;

        default:
          TProtocolUtil.skip(iprot, field.type);
          break;
      }
      iprot.readFieldEnd();
    }
    iprot.readStructEnd();

    return new TApplicationError(type, message);
  }

  write(TProtocol oprot) {
    oprot.writeStructBegin(_struct);

    if (message != null && !message.isEmpty) {
      oprot.writeFieldBegin(_messageField);
      oprot.writeString(message);
      oprot.writeFieldEnd();
    }

    oprot.writeFieldBegin(_typeField);
    oprot.writeI32(type);
    oprot.writeFieldEnd();

    oprot.writeFieldStop();
    oprot.writeStructEnd();
  }
}
