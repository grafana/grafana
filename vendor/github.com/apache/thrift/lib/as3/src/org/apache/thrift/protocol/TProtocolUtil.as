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

package org.apache.thrift.protocol {

  import org.apache.thrift.TError;

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
    private static var maxSkipDepth:int = int.MAX_VALUE;

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
    public function setMaxSkipDepth(depth:int):void {
      maxSkipDepth = depth;
    }

    /**
     * Skips over the next data element from the provided input TProtocol object.
     *
     * @param prot  the protocol object to read from
     * @param type  the next value will be intepreted as this TType value.
     */
    public static function skip(prot:TProtocol, type:int):void {
      skipMaxDepth(prot, type, maxSkipDepth);
    }

     /**
     * Skips over the next data element from the provided input TProtocol object.
     *
     * @param prot  the protocol object to read from
     * @param type  the next value will be intepreted as this TType value.
     * @param maxDepth  this function will only skip complex objects to this
     *   recursive depth, to prevent Java stack overflow.
     */
    public static function skipMaxDepth(prot:TProtocol, type:int, maxDepth:int):void {
      if (maxDepth <= 0) {
        throw new TError("Maximum skip depth exceeded");
      }
      switch (type) {
        case TType.BOOL: {
          prot.readBool();
          break;
        }
        case TType.BYTE: {
          prot.readByte();
          break;
        }
        case TType.I16: {
          prot.readI16();
          break;
        }
        case TType.I32: {
          prot.readI32();
          break;
        }
        /*
        case TType.I64: {
          prot.readI64();
          break;
        }
        */
        case TType.DOUBLE: {
          prot.readDouble();
          break;
        }
        case TType.STRING: {
          prot.readBinary();
          break;
        }
        case TType.STRUCT: {
          prot.readStructBegin();
          while (true) {
            var field:TField = prot.readFieldBegin();
            if (field.type == TType.STOP) {
              break;
            }
            skipMaxDepth(prot, field.type, maxDepth - 1);
            prot.readFieldEnd();
          }
          prot.readStructEnd();
          break;
        }
        case TType.MAP: {
          var map:TMap = prot.readMapBegin();
          for (var i:int = 0; i < map.size; i++) {
            skipMaxDepth(prot, map.keyType, maxDepth - 1);
            skipMaxDepth(prot, map.valueType, maxDepth - 1);
          }
          prot.readMapEnd();
          break;
        }
        case TType.SET: {
          var set:TSet = prot.readSetBegin();
          for (var j:int = 0; j < set.size; j++) {
            skipMaxDepth(prot, set.elemType, maxDepth - 1);
          }
          prot.readSetEnd();
          break;
        }
        case TType.LIST: {
          var list:TList = prot.readListBegin();
          for (var k:int = 0; k < list.size; k++) {
            skipMaxDepth(prot, list.elemType, maxDepth - 1);
          }
          prot.readListEnd();
          break;
        }
        default:
          break;
      }
    }
  }
}
