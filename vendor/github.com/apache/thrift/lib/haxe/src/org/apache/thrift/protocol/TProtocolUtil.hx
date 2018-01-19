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

import org.apache.thrift.*;

  /**
   * Utility class with static methods for interacting with protocol data
   * streams.
   *
   */
class TProtocolUtil {

    /**
     * Skips over the next data element from the provided input TProtocol object.
     *
     * @param prot  the protocol object to read from
     * @param type  the next value will be intepreted as this TType value.
     */
    public static function skip(prot:TProtocol, type : Int) : Void {
        prot.IncrementRecursionDepth();
        try
        {
            switch (type) {
                case TType.BOOL:
                    prot.readBool();

                case TType.BYTE:
                    prot.readByte();

                case TType.I16:
                    prot.readI16();

                case TType.I32:
                    prot.readI32();

                case TType.I64:
                    prot.readI64();

                case TType.DOUBLE:
                    prot.readDouble();

                case TType.STRING:
                    prot.readBinary();

                case TType.STRUCT:
                    prot.readStructBegin();
                    while (true) {
                        var field:TField = prot.readFieldBegin();
                        if (field.type == TType.STOP) {
                          break;
                        }
                        skip(prot, field.type);
                        prot.readFieldEnd();
                    }
                    prot.readStructEnd();

                case TType.MAP:
                    var map:TMap = prot.readMapBegin();
                    for (i in 0 ... map.size) {
                        skip(prot, map.keyType);
                        skip(prot, map.valueType);
                    }
                    prot.readMapEnd();

                case TType.SET:
                    var set:TSet = prot.readSetBegin();
                    for (j in 0 ... set.size) {
                        skip(prot, set.elemType);
                    }
                    prot.readSetEnd();

                case TType.LIST:
                    var list:TList = prot.readListBegin();
                    for (k in 0 ... list.size) {
                        skip(prot, list.elemType);
                    }
                    prot.readListEnd();

                default:
                    trace("Unknown field type ",type," in skipMaxDepth()");
            }

            prot.DecrementRecursionDepth();
        }
        catch(e:Dynamic)
        {
            prot.DecrementRecursionDepth();
            throw e;
        }
    }

}
