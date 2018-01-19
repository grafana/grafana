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

class TMessage {

    public var name : String;
    public var type : Int;
    public var seqid : Int;

    public function new(n : String = "", t : Int = 0, s : Int = 0) {
      name = n;
      type = t;
      seqid = s;
    }

    public function toString() : String {
      return "<TMessage name:'" + name + "' type: " + type + " seqid:" + seqid + ">";
    }

    public function equals(other:TMessage) : Bool {
      return name == other.name && type == other.type && seqid == other.seqid;
    }
}
