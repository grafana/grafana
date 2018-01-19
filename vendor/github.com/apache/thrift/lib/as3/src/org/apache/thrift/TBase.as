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

  import org.apache.thrift.protocol.TProtocol;

  /**
   * Generic base interface for generated Thrift objects.
   *
   */
  public interface TBase {
  
    /**
     * Reads the TObject from the given input protocol.
     *
     * @param iprot Input protocol
     */
    function read(iprot:TProtocol):void;
  
    /**
     * Writes the objects out to the protocol
     *
     * @param oprot Output protocol
     */
    function write(oprot:TProtocol):void;
  
    /**
     * Check if a field is currently set or unset.
     *
     * @param fieldId The field's id tag as found in the IDL.
     */
    function isSet(fieldId:int):Boolean;
  
    /**
     * Get a field's value by id. Primitive types will be wrapped in the 
     * appropriate "boxed" types.
     *
     * @param fieldId The field's id tag as found in the IDL.
     */
    function getFieldValue(fieldId:int):*;
  
    /**
     * Set a field's value by id. Primitive types must be "boxed" in the 
     * appropriate object wrapper type.
     *
     * @param fieldId The field's id tag as found in the IDL.
     */
    function setFieldValue(fieldId:int, value:*):void;
  }
}
