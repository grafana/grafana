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

class TType {
  static const int STOP = 0;
  static const int VOID = 1;
  static const int BOOL = 2;
  static const int BYTE = 3;
  static const int DOUBLE = 4;
  static const int I16 = 6;
  static const int I32 = 8;
  static const int I64 = 10;
  static const int STRING = 11;
  static const int STRUCT = 12;
  static const int MAP = 13;
  static const int SET = 14;
  static const int LIST = 15;
}
