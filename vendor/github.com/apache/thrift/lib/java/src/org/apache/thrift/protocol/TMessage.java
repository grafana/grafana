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

/**
 * Helper class that encapsulates struct metadata.
 *
 */
public final class TMessage {
  public TMessage() {
    this("", TType.STOP, 0);
  }

  public TMessage(String n, byte t, int s) {
    name = n;
    type = t;
    seqid = s;
  }

  public final String name;
  public final byte type;
  public final int seqid;

  @Override
  public String toString() {
    return "<TMessage name:'" + name + "' type: " + type + " seqid:" + seqid + ">";
  }

  @Override
  public int hashCode() {
    final int prime = 31;
    int result = 1;
    result = prime * result + ((name == null) ? 0 : name.hashCode());
    result = prime * result + seqid;
    result = prime * result + type;
    return result;
  }

  @Override
  public boolean equals(Object obj) {
    if (this == obj)
      return true;
    if (obj == null)
      return false;
    if (getClass() != obj.getClass())
      return false;
    TMessage other = (TMessage) obj;
    if (name == null) {
      if (other.name != null)
        return false;
    } else if (!name.equals(other.name))
      return false;
    if (seqid != other.seqid)
      return false;
    if (type != other.type)
      return false;
    return true;
  }
}
