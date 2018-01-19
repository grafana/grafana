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
  
  public class TType {
    
    public static const STOP:int   = 0;
    public static const VOID:int   = 1;
    public static const BOOL:int   = 2;
    public static const BYTE:int   = 3;
    public static const DOUBLE:int = 4;
    public static const I16:int    = 6;
    public static const I32:int    = 8;
    public static const I64:int    = 10;
    public static const STRING:int = 11;
    public static const STRUCT:int = 12;
    public static const MAP:int    = 13;
    public static const SET:int    = 14;
    public static const LIST:int   = 15;

  }
}