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

  public class TProtocolError extends TError {
    
    public static const UNKNOWN:int = 0;
    public static const INVALID_DATA:int = 1;
    public static const NEGATIVE_SIZE:int = 2;
    public static const SIZE_LIMIT:int = 3;
    public static const BAD_VERSION:int = 4;
    public static const NOT_IMPLEMENTED:int = 5;
    public static const DEPTH_LIMIT:int = 6;
  
    public function TProtocolError(error:int = UNKNOWN, message:String = "") {
      super(message, error);
    }
    
  }
}