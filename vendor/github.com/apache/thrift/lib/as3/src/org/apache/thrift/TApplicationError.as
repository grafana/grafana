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

package org.apache.thrift {

  import org.apache.thrift.protocol.TField;
  import org.apache.thrift.protocol.TProtocol;
  import org.apache.thrift.protocol.TProtocolUtil;
  import org.apache.thrift.protocol.TStruct;
  import org.apache.thrift.protocol.TType;

  /**
   * Application level exception
   */
  public class TApplicationError extends TError {

    private static const TAPPLICATION_EXCEPTION_STRUCT:TStruct = new TStruct("TApplicationException");
    private static const MESSAGE_FIELD:TField = new TField("message", TType.STRING, 1);
    private static const TYPE_FIELD:TField = new TField("type", TType.I32, 2);

    public static const UNKNOWN:int = 0;
    public static const UNKNOWN_METHOD:int = 1;
    public static const INVALID_MESSAGE_TYPE:int = 2;
    public static const WRONG_METHOD_NAME:int = 3;
    public static const BAD_SEQUENCE_ID:int = 4;
    public static const MISSING_RESULT:int = 5;
    public static const INTERNAL_ERROR:int = 6;
    public static const PROTOCOL_ERROR:int = 7;
    public static const INVALID_TRANSFORM:int = 8;
    public static const INVALID_PROTOCOL:int = 9;
    public static const UNSUPPORTED_CLIENT_TYPE:int = 10;

    public function TApplicationError(type:int = UNKNOWN, message:String = "") {
      super(message, type);
    }

    public static function read(iprot:TProtocol):TApplicationError {
      var field:TField;
      iprot.readStructBegin();

      var message:String = null;
      var type:int = UNKNOWN;

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
            break;
          case 2:
            if (field.type == TType.I32) {
              type = iprot.readI32();
            }
            else {
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

    public function write(oprot:TProtocol):void {
        oprot.writeStructBegin(TAPPLICATION_EXCEPTION_STRUCT);
        if (message != null) {
          oprot.writeFieldBegin(MESSAGE_FIELD);
          oprot.writeString(message);
          oprot.writeFieldEnd();
        }
        oprot.writeFieldBegin(TYPE_FIELD);
        oprot.writeI32(errorID);
        oprot.writeFieldEnd();
        oprot.writeFieldStop();
        oprot.writeStructEnd();
      }
  }
}
