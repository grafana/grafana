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

// Make sure we use at least 3.1.3
// Some Linux platforms have waaaay too old packages in their repos
// Pro Tip: Look at http://openfl.com for a good Linux install script
#if( haxe_ver < 3.103)
#error Haxe 3.1.3 or newer required, sorry!
#end

import org.apache.thrift.protocol.TProtocol;

  /**
   * Generic base interface for generated Thrift objects.
   *
   */
interface TBase {

    /**
     * Reads the TObject from the given input protocol.
     *
     * @param iprot Input protocol
     */
    function read(iprot:TProtocol) : Void;

    /**
     * Writes the objects out to the protocol
     *
     * @param oprot Output protocol
     */
    function write(oprot:TProtocol) : Void;

    /**
     * Check if a field is currently set or unset.
     *
     * @param fieldId The field's id tag as found in the IDL.
     */
    function isSet(fieldId : Int) : Bool;

    /**
     * Get a field's value by id. Primitive types will be wrapped in the
     * appropriate "boxed" types.
     *
     * @param fieldId The field's id tag as found in the IDL.
     */
    function getFieldValue(fieldId : Int) : Dynamic;

    /**
     * Set a field's value by id. Primitive types must be "boxed" in the
     * appropriate object wrapper type.
     *
     * @param fieldId The field's id tag as found in the IDL.
     */
    function setFieldValue(fieldId : Int, value : Dynamic) : Void;
}
