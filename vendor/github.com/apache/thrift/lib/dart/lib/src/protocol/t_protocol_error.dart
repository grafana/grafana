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

class TProtocolErrorType {
  static const int UNKNOWN = 0;
  static const int INVALID_DATA = 1;
  static const int NEGATIVE_SIZE = 2;
  static const int SIZE_LIMIT = 3;
  static const int BAD_VERSION = 4;
  static const int NOT_IMPLEMENTED = 5;
  static const int DEPTH_LIMIT = 6;
}

class TProtocolError extends TError {
  TProtocolError([int type = TProtocolErrorType.UNKNOWN, String message = ""])
      : super(type, message);
}
