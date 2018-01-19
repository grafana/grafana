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
 * Helper class that encapsulates field metadata.
 *
 */
public class TField {
  public TField() {
    this("", TType.STOP, (short)0);
  }

  public TField(String n, byte t, short i) {
    name = n;
    type = t;
    id = i;
  }

  public final String name;
  public final byte   type;
  public final short  id;

  public String toString() {
    return "<TField name:'" + name + "' type:" + type + " field-id:" + id + ">";
  }

  @Override
  public int hashCode() {
    final int prime = 31;
    int result = 1;
    result = prime * result + id;
    result = prime * result + ((name == null) ? 0 : name.hashCode());
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
    TField otherField = (TField) obj;
    return type == otherField.type && id == otherField.id;
  }
}
