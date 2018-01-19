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
    
  public class TField {
    
    public var name:String;
    public var type:int;
    public var id:int;
      
    public function TField(n:String = "", t:int = 0, i:int = 0) {
      name = n;
      type = t;
      id = i;
    }
    
    public function toString():String {
      return "<TField name:'" + name + "' type:" + type + " field-id:" + id + ">";
    }
    
    public function equals(otherField:TField):Boolean {
      return type == otherField.type && id == otherField.id;
    }
        
  }
}