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

set(hs_test_gen
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ConstantsDemo_Consts.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ConstantsDemo_Types.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/DebugProtoTest_Consts.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/DebugProtoTest_Types.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/EmptyService_Client.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/EmptyService.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/EmptyService_Iface.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Include_Consts.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Include_Types.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Inherited_Client.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Inherited.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Inherited_Iface.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ReverseOrderService_Client.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ReverseOrderService.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ReverseOrderService_Iface.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/SecondService_Client.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/SecondService.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/SecondService_Iface.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ServiceForExceptionWithAMap_Client.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ServiceForExceptionWithAMap.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ServiceForExceptionWithAMap_Iface.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Srv_Client.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Srv.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Srv_Iface.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ThriftTest_Client.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ThriftTest_Consts.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ThriftTest.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ThriftTest_Iface.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/ThriftTest_Types.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Yowza_Client.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Yowza.hs
    ${CMAKE_CURRENT_BINARY_DIR}/gen-hs/Yowza_Iface.hs
)

set(hs_crosstest_apps
    ${CMAKE_CURRENT_BINARY_DIR}/TestServer
    ${CMAKE_CURRENT_BINARY_DIR}/TestClient
)
set(hs_crosstest_args
    -igen-hs
    -odir=${CMAKE_CURRENT_BINARY_DIR}
    -hidir=${CMAKE_CURRENT_BINARY_DIR}
)

if (CMAKE_BUILD_TYPE STREQUAL "Debug")
  set(hs_optimize -O0)
else()
  set(hs_optimize -O1)
endif()

add_custom_command(
    OUTPUT ${hs_crosstest_apps}
    COMMAND ${GHC} ${hs_optimize} ${hs_crosstest_args} ${CMAKE_CURRENT_SOURCE_DIR}/TestServer.hs -o TestServer
    COMMAND ${GHC} ${hs_optimize} ${hs_crosstest_args} ${CMAKE_CURRENT_SOURCE_DIR}/TestClient.hs -o TestClient
    DEPENDS ${hs_test_gen} haskell_library TestServer.hs TestClient.hs
)
add_custom_target(haskell_crosstest ALL
    COMMENT "Building Haskell cross test executables"
    DEPENDS ${hs_crosstest_apps}
)

set(hs_test_sources
    ConstantsDemo_Main.hs
    DebugProtoTest_Main.hs
    Include_Main.hs
    ThriftTest_Main.hs
)
set(hs_test_args
    -Wall
    -XScopedTypeVariables
    -i${PROJECT_SOURCE_DIR}/lib/hs/src
    -i${CMAKE_CURRENT_BINARY_DIR}/gen-hs
)
add_custom_target(haskell_tests ALL DEPENDS ${hs_test_gen})
foreach(SRC ${hs_test_sources})
    get_filename_component(BASE ${SRC} NAME_WE)
    add_test(NAME HaskellTests-${BASE}
        COMMAND ${RUN_HASKELL} ${hs_test_args} ${SRC}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
endforeach()

set(hs_test_gen_sources
    ${PROJECT_SOURCE_DIR}/test/ConstantsDemo.thrift
    ${PROJECT_SOURCE_DIR}/test/DebugProtoTest.thrift
    ${PROJECT_SOURCE_DIR}/test/ThriftTest.thrift
    ${PROJECT_SOURCE_DIR}/test/Include.thrift
)
add_custom_command(OUTPUT ${hs_test_gen}
    COMMAND ${THRIFT_COMPILER} --gen hs ${PROJECT_SOURCE_DIR}/test/ConstantsDemo.thrift
    COMMAND ${THRIFT_COMPILER} --gen hs ${PROJECT_SOURCE_DIR}/test/DebugProtoTest.thrift
    COMMAND ${THRIFT_COMPILER} --gen hs ${PROJECT_SOURCE_DIR}/test/ThriftTest.thrift
    COMMAND ${THRIFT_COMPILER} --gen hs ${PROJECT_SOURCE_DIR}/test/Include.thrift
    DEPENDS ${hs_test_gen_sources}
)
