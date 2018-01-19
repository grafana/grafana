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

#include <boost/type_traits/is_same.hpp>
#include <boost/static_assert.hpp>

#include "gen-cpp/TypedefTest_types.h"

BOOST_STATIC_ASSERT((boost::is_same<int32_t, thrift::test::MyInt32>::value));
BOOST_STATIC_ASSERT((boost::is_same<std::string, thrift::test::MyString>::value));
BOOST_STATIC_ASSERT(
    (boost::is_same<thrift::test::TypedefTestStruct, thrift::test::MyStruct>::value));
