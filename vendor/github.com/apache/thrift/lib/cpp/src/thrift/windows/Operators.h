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

#ifndef _THRIFT_WINDOWS_OPERATORS_H_
#define _THRIFT_WINDOWS_OPERATORS_H_

#if defined(_MSC_VER) && (_MSC_VER > 1200)
#pragma once
#endif // _MSC_VER

namespace apache {
namespace thrift {

class TEnumIterator;

inline bool operator==(const TEnumIterator&, const TEnumIterator&) {
  // Not entirely sure what the test should be here. It is only to enable
  // iterator debugging and is not used in release mode.
  return true;
}
}
} // apache::thrift

#endif // _THRIFT_WINDOWS_OPERATORS_H_
