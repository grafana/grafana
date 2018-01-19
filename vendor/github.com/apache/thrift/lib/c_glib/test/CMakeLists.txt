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


set(TEST_PREFIX "c_glib")

include_directories(SYSTEM ${Boost_INCLUDE_DIRS})

#Make sure gen-cpp and gen-c_glib files can be included
include_directories("${CMAKE_CURRENT_BINARY_DIR}")

# Create the thrift C test library
set(testgenc_SOURCES
    gen-c_glib/t_test_debug_proto_test_types.c
    gen-c_glib/t_test_enum_test_types.c
    gen-c_glib/t_test_enum_test_service.c
    gen-c_glib/t_test_empty_service.c
    gen-c_glib/t_test_inherited.c
    gen-c_glib/t_test_optional_required_test_types.c
    gen-c_glib/t_test_reverse_order_service.c
    gen-c_glib/t_test_second_service.c
    gen-c_glib/t_test_service_for_exception_with_a_map.c
    gen-c_glib/t_test_srv.c
    gen-c_glib/t_test_thrift_test.c
    gen-c_glib/t_test_thrift_test_types.c
    gen-c_glib/t_test_debug_proto_test_types.h
    gen-c_glib/t_test_enum_test_types.h
    gen-c_glib/t_test_enum_test_service.h
    gen-c_glib/t_test_empty_service.h
    gen-c_glib/t_test_inherited.h
    gen-c_glib/t_test_optional_required_test_types.h
    gen-c_glib/t_test_reverse_order_service.h
    gen-c_glib/t_test_second_service.h
    gen-c_glib/t_test_service_for_exception_with_a_map.h
    gen-c_glib/t_test_srv.h
    gen-c_glib/t_test_thrift_test.h
    gen-c_glib/t_test_thrift_test_types.h
)

add_library(testgenc STATIC ${testgenc_SOURCES})
LINK_AGAINST_THRIFT_LIBRARY(testgenc thrift_c_glib)


add_executable(testserialization testserialization.c)
target_link_libraries(testserialization testgenc)
LINK_AGAINST_THRIFT_LIBRARY(testserialization thrift_c_glib)
add_test(NAME testserialization COMMAND testserialization)

add_executable(testapplicationexception testapplicationexception.c)
LINK_AGAINST_THRIFT_LIBRARY(testapplicationexception thrift_c_glib)
add_test(NAME testapplicationexception COMMAND testapplicationexception)

add_executable(testtransportsocket testtransportsocket.c)
LINK_AGAINST_THRIFT_LIBRARY(testtransportsocket thrift_c_glib)
add_test(NAME testtransportsocket COMMAND testtransportsocket)

add_executable(testbinaryprotocol testbinaryprotocol.c)
LINK_AGAINST_THRIFT_LIBRARY(testbinaryprotocol thrift_c_glib)
add_test(NAME testbinaryprotocol COMMAND testbinaryprotocol)

add_executable(testcompactprotocol testcompactprotocol.c)
LINK_AGAINST_THRIFT_LIBRARY(testcompactprotocol thrift_c_glib)
add_test(NAME testcompactprotocol COMMAND testcompactprotocol)

add_executable(testbufferedtransport testbufferedtransport.c)
LINK_AGAINST_THRIFT_LIBRARY(testbufferedtransport thrift_c_glib)
add_test(NAME testbufferedtransport COMMAND testbufferedtransport)

add_executable(testframedtransport testframedtransport.c)
LINK_AGAINST_THRIFT_LIBRARY(testframedtransport thrift_c_glib)
add_test(NAME testframedtransport COMMAND testframedtransport)

add_executable(testfdtransport testfdtransport.c)
LINK_AGAINST_THRIFT_LIBRARY(testfdtransport thrift_c_glib)
add_test(NAME testfdtransport COMMAND testfdtransport)

add_executable(testmemorybuffer testmemorybuffer.c)
LINK_AGAINST_THRIFT_LIBRARY(testmemorybuffer thrift_c_glib)
add_test(NAME testmemorybuffer COMMAND testmemorybuffer)

add_executable(testsimpleserver testsimpleserver.c)
LINK_AGAINST_THRIFT_LIBRARY(testsimpleserver thrift_c_glib)
add_test(NAME testsimpleserver COMMAND testsimpleserver)

add_executable(testdebugproto testdebugproto.c)
target_link_libraries(testdebugproto testgenc)
add_test(NAME testdebugproto COMMAND testdebugproto)

add_executable(testoptionalrequired testoptionalrequired.c)
target_link_libraries(testoptionalrequired testgenc)
add_test(NAME testoptionalrequired COMMAND testoptionalrequired)

include_directories("${PROJECT_SOURCE_DIR}/test/c_glib/src" "${CMAKE_CURRENT_BINARY_DIR}/gen-c_glib")

add_executable(testthrifttest testthrifttest.c
    ${PROJECT_SOURCE_DIR}/test/c_glib/src/thrift_test_handler.c
    ${PROJECT_SOURCE_DIR}/test/c_glib/src/thrift_test_handler.h
    gen-c_glib/t_test_thrift_test_types.h)
target_link_libraries(testthrifttest testgenc)
add_test(NAME testthrifttest COMMAND testthrifttest)


if(BUILD_CPP)

    include_directories("${PROJECT_SOURCE_DIR}/lib/cpp/src")

    # Create the thrift C++ test library
    set(testgenc_cpp_SOURCES
        gen-cpp/ThriftTest.cpp
        gen-cpp/ThriftTest_constants.cpp
        gen-cpp/ThriftTest_types.cpp
        gen-cpp/ThriftTest.h
        gen-cpp/ThriftTest_constants.h
        gen-cpp/ThriftTest_types.h
    )

    add_library(testgenc_cpp STATIC ${testgenc_cpp_SOURCES})
    LINK_AGAINST_THRIFT_LIBRARY(testgenc_cpp thrift)

    #HACK: testthrifttestclient.cpp includes ThriftTest.h without gen-*/ prefixes
    # so we include it here
    include_directories("${CMAKE_CURRENT_BINARY_DIR}/gen-cpp" "${CMAKE_CURRENT_BINARY_DIR}/gen-c_glib")

    add_executable(testthrifttestclient testthrifttestclient.cpp)
    target_link_libraries(testthrifttestclient testgenc testgenc_cpp ${ZLIB_LIBRARIES})
    add_test(NAME testthrifttestclient COMMAND testthrifttestclient)

endif(BUILD_CPP)

#
# Common thrift code generation rules
#

add_custom_command(OUTPUT
    gen-c_glib/t_test_debug_proto_test_types.c
    gen-c_glib/t_test_debug_proto_test_types.h
    gen-c_glib/t_test_empty_service.c
    gen-c_glib/t_test_empty_service.h
    gen-c_glib/t_test_inherited.c
    gen-c_glib/t_test_inherited.h
    gen-c_glib/t_test_reverse_order_service.c
    gen-c_glib/t_test_reverse_order_service.h
    gen-c_glib/t_test_service_for_exception_with_a_map.c
    gen-c_glib/t_test_service_for_exception_with_a_map.h
    gen-c_glib/t_test_srv.c
    gen-c_glib/t_test_srv.h
    COMMAND ${THRIFT_COMPILER} --gen c_glib ${PROJECT_SOURCE_DIR}/test/DebugProtoTest.thrift
)

add_custom_command(OUTPUT
    gen-c_glib/t_test_enum_test_types.c
    gen-c_glib/t_test_enum_test_types.h
    gen-c_glib/t_test_enum_test_service.c
    gen-c_glib/t_test_enum_test_service.h
    COMMAND ${THRIFT_COMPILER} --gen c_glib ${PROJECT_SOURCE_DIR}/test/EnumTest.thrift
)

add_custom_command(OUTPUT
    gen-c_glib/t_test_optional_required_test_types.c
    gen-c_glib/t_test_optional_required_test_types.h
    COMMAND ${THRIFT_COMPILER} --gen c_glib ${PROJECT_SOURCE_DIR}/test/OptionalRequiredTest.thrift
)

add_custom_command(OUTPUT
    gen-c_glib/t_test_second_service.c
    gen-c_glib/t_test_thrift_test.c
    gen-c_glib/t_test_thrift_test_types.c
    gen-c_glib/t_test_second_service.h
    gen-c_glib/t_test_thrift_test.h
    gen-c_glib/t_test_thrift_test_types.h
    COMMAND ${THRIFT_COMPILER} --gen c_glib ${PROJECT_SOURCE_DIR}/test/ThriftTest.thrift
)

add_custom_command(OUTPUT
    gen-cpp/ThriftTest.cpp
    gen-cpp/ThriftTest_constants.cpp
    gen-cpp/ThriftTest_types.cpp
    gen-cpp/ThriftTest.h
    gen-cpp/ThriftTest_constants.h
    gen-cpp/ThriftTest_types.h
    COMMAND ${THRIFT_COMPILER} --gen cpp ${PROJECT_SOURCE_DIR}/test/ThriftTest.thrift
)

# TODO: Add memory checks using ctest_memcheck or similar
