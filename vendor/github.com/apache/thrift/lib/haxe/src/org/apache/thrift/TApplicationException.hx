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

import org.apache.thrift.protocol.TField;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TProtocolUtil;
import org.apache.thrift.protocol.TStruct;
import org.apache.thrift.protocol.TType;

  /**
   * Application level exception
   */
class TApplicationException extends TException {

    private static var TAPPLICATION_EXCEPTION_STRUCT = { new TStruct("TApplicationException"); };
    private static var MESSAGE_FIELD = { new TField("message", TType.STRING, 1); };
    private static var TYPE_FIELD = { new TField("type", TType.I32, 2); };

    // WARNING: These are subject to be extended in the future, so we can't use enums
    // with Haxe 3.1.3 because of https://github.com/HaxeFoundation/haxe/issues/3649
    public static inline var UNKNOWN : Int = 0;
    public static inline var UNKNOWN_METHOD : Int = 1;
    public static inline var INVALID_MESSAGE_TYPE : Int = 2;
    public static inline var WRONG_METHOD_NAME : Int = 3;
    public static inline var BAD_SEQUENCE_ID : Int = 4;
    public static inline var MISSING_RESULT : Int = 5;
    public static inline var INTERNAL_ERROR : Int = 6;
    public static inline var PROTOCOL_ERROR : Int = 7;
    public static inline var INVALID_TRANSFORM : Int = 8;
    public static inline var INVALID_PROTOCOL : Int = 9;
    public static inline var UNSUPPORTED_CLIENT_TYPE : Int = 10;

    public function new(type : Int = UNKNOWN, message : String = "") {
      super(message, type);
    }

    public static function read(iprot:TProtocol) : TApplicationException {
      var field:TField;
      iprot.readStructBegin();

      var message : String = null;
      var type : Int = UNKNOWN;

      while (true) {
        field = iprot.readFieldBegin();
        if (field.type == TType.STOP) {
          break;
        }
        switch (field.id) {
          case 1:
            if (field.type == TType.STRING) {
              message = iprot.readString();
            }
            else {
              TProtocolUtil.skip(iprot, field.type);
            }
          case 2:
            if (field.type == TType.I32) {
              type = iprot.readI32();
            }
            else {
              TProtocolUtil.skip(iprot, field.type);
            }
          default:
            TProtocolUtil.skip(iprot, field.type);
        }
        iprot.readFieldEnd();
      }
      iprot.readStructEnd();
      return new TApplicationException(type, message);
    }

    public function write(oprot:TProtocol) : Void {
        oprot.writeStructBegin(TAPPLICATION_EXCEPTION_STRUCT);
        if (errorMsg != null) {
          oprot.writeFieldBegin(MESSAGE_FIELD);
          oprot.writeString(errorMsg);
          oprot.writeFieldEnd();
        }
        oprot.writeFieldBegin(TYPE_FIELD);
        oprot.writeI32(errorID);
        oprot.writeFieldEnd();
        oprot.writeFieldStop();
        oprot.writeStructEnd();
      }
}
