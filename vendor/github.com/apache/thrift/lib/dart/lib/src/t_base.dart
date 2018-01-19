/// Licensed to the Apache Software Foundation (ASF) under one
/// or more contributor license agreements. See the NOTICE file
/// distributed with this work for additional information
/// regarding copyright ownership. The ASF licenses this file
/// to you under the Apache License, Version 2.0 (the
/// "License"); you may not use this file except in compliance
/// with the License. You may obtain a copy of the License at
///
/// http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
/// KIND, either express or implied. See the License for the
/// specific language governing permissions and limitations
/// under the License.

part of thrift;

abstract class TBase {
  /// Reads the TObject from the given input protocol.
  void read(TProtocol iprot);

  /// Writes the objects out to the [oprot] protocol.
  void write(TProtocol oprot);

  /// Check if a field is currently set or unset, using the [fieldId].
  bool isSet(int fieldId);

  /// Get a field's value by [fieldId]. Primitive types will be wrapped in the
  /// appropriate "boxed" types.
  getFieldValue(int fieldId);

  /// Set a field's value by [fieldId]. Primitive types must be "boxed" in the
  /// appropriate object wrapper type.
  setFieldValue(int fieldId, Object value);
}
