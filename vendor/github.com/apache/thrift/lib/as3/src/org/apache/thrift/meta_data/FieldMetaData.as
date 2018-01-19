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

package org.apache.thrift.meta_data {

  import flash.utils.Dictionary;

  /**
   * This class is used to store meta data about thrift fields. Every field in a
   * a struct should have a corresponding instance of this class describing it.
   *
   */
  public class FieldMetaData {
  
    public var fieldName:String;
    public var requirementType:int;
    public var valueMetaData:FieldValueMetaData;
  
    private static var structMap:Dictionary = new Dictionary();
  
    public function FieldMetaData(name:String, req:int, vMetaData:FieldValueMetaData) {
      this.fieldName = name;
      this.requirementType = req;
      this.valueMetaData = vMetaData;
    }
  
    public static function addStructMetaDataMap(sClass:Class, map:Dictionary):void{
      structMap[sClass] = map;
    }

    /**
     * Returns a map with metadata (i.e. instances of FieldMetaData) that
     * describe the fields of the given class.
     *
     * @param sClass The TBase class for which the metadata map is requested
     */
    public static function getStructMetaDataMap(sClass:Class):Dictionary {
      return structMap[sClass];
    }
  }
}
