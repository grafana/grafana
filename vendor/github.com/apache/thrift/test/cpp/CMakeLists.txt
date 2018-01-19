#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

# Contains the thrift specific LINK_AGAINST_THRIFT_LIBRARY
include(ThriftMacros)

include_directories(SYSTEM "${Boost_INCLUDE_DIRS}")

find_package(OpenSSL REQUIRED)
include_directories(SYSTEM "${OPENSSL_INCLUDE_DIR}")

find_package(Libevent REQUIRED)  # Libevent comes with CMake support from upstream
include_directories(SYSTEM ${LIBEVENT_INCLUDE_DIRS})

#Make sure gen-cpp files can be included
include_directories("${CMAKE_CURRENT_BINARY_DIR}")
include_directories("${CMAKE_CURRENT_BINARY_DIR}/gen-cpp")
include_directories("${PROJECT_SOURCE_DIR}/lib/cpp/src")


set(crosstestgencpp_SOURCES
    gen-cpp/ThriftTest.cpp
    gen-cpp/ThriftTest_types.cpp
    gen-cpp/ThriftTest_constants.cpp
    src/ThriftTest_extras.cpp
)
add_library(crosstestgencpp STATIC ${crosstestgencpp_SOURCES})
LINK_AGAINST_THRIFT_LIBRARY(crosstestgencpp thrift)

set(crossstressgencpp_SOURCES
    gen-cpp/Service.cpp
    #gen-cpp/StressTest_types.cpp #basically empty, so omitting
    gen-cpp/StressTest_constants.cpp
)
add_library(crossstressgencpp STATIC ${crossstressgencpp_SOURCES})
LINK_AGAINST_THRIFT_LIBRARY(crossstressgencpp thrift)

add_executable(TestServer src/TestServer.cpp)
target_link_libraries(TestServer crosstestgencpp ${Boost_LIBRARIES} ${LIBEVENT_LIB})
LINK_AGAINST_THRIFT_LIBRARY(TestServer thrift)
LINK_AGAINST_THRIFT_LIBRARY(TestServer thriftnb)
LINK_AGAINST_THRIFT_LIBRARY(TestServer thriftz)

add_executable(TestClient src/TestClient.cpp)
target_link_libraries(TestClient crosstestgencpp ${Boost_LIBRARIES} ${LIBEVENT_LIB})
LINK_AGAINST_THRIFT_LIBRARY(TestClient thrift)
LINK_AGAINST_THRIFT_LIBRARY(TestClient thriftnb)
LINK_AGAINST_THRIFT_LIBRARY(TestClient thriftz)

add_executable(StressTest src/StressTest.cpp)
target_link_libraries(StressTest crossstressgencpp ${Boost_LIBRARIES} ${LIBEVENT_LIB})
LINK_AGAINST_THRIFT_LIBRARY(StressTest thrift)
LINK_AGAINST_THRIFT_LIBRARY(StressTest thriftnb)
add_test(NAME StressTest COMMAND StressTest)

add_executable(StressTestNonBlocking src/StressTestNonBlocking.cpp)
target_link_libraries(StressTestNonBlocking crossstressgencpp ${Boost_LIBRARIES} ${LIBEVENT_LIB})
LINK_AGAINST_THRIFT_LIBRARY(StressTestNonBlocking thrift)
LINK_AGAINST_THRIFT_LIBRARY(StressTestNonBlocking thriftnb)
LINK_AGAINST_THRIFT_LIBRARY(StressTestNonBlocking thriftz)
add_test(NAME StressTestNonBlocking COMMAND StressTestNonBlocking)

#
# Common thrift code generation rules
#

add_custom_command(OUTPUT gen-cpp/ThriftTest.cpp gen-cpp/ThriftTest_types.cpp gen-cpp/ThriftTest_constants.cpp
    COMMAND ${THRIFT_COMPILER} --gen cpp:templates,cob_style -r ${PROJECT_SOURCE_DIR}/test/ThriftTest.thrift
)

add_custom_command(OUTPUT gen-cpp/StressTest_types.cpp gen-cpp/StressTest_constants.cpp gen-cpp/Service.cpp
    COMMAND ${THRIFT_COMPILER} --gen cpp ${PROJECT_SOURCE_DIR}/test/StressTest.thrift
)
