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

package org.apache.thrift.meta_data;

import org.apache.thrift.TBase;

import java.util.Hashtable;


/**
 * This class is used to store meta data about thrift fields. Every field in a
 * a struct should have a corresponding instance of this class describing it.
 *
 */
public class FieldMetaData  {
  public final String fieldName;
  public final byte requirementType;
  public final FieldValueMetaData valueMetaData;
  private static Hashtable structMap;
  
  static {
    structMap = new Hashtable();
  }
  
  public FieldMetaData(String name, byte req, FieldValueMetaData vMetaData){
    this.fieldName = name;
    this.requirementType = req;
    this.valueMetaData = vMetaData;
  }
  
  public static synchronized void addStructMetaDataMap(Class sClass, Hashtable map){
    structMap.put(sClass, map);
  }

  /**
   * Returns a map with metadata (i.e. instances of FieldMetaData) that
   * describe the fields of the given class.
   *
   * @param sClass The TBase class for which the metadata map is requested
   */
  public static synchronized Hashtable getStructMetaDataMap(Class sClass){
    if (!structMap.containsKey(sClass)){ // Load class if it hasn't been loaded
      try{
        sClass.newInstance();
      } catch (InstantiationException e){
        throw new RuntimeException("InstantiationException for TBase class: " + sClass.getName() + ", message: " + e.getMessage());
      } catch (IllegalAccessException e){
        throw new RuntimeException("IllegalAccessException for TBase class: " + sClass.getName() + ", message: " + e.getMessage());
      }
    }
    return (Hashtable) structMap.get(sClass);
  }
}
