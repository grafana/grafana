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

include_directories(SYSTEM "${Boost_INCLUDE_DIRS}")

#Make sure gen-cpp files can be included
include_directories("${CMAKE_CURRENT_BINARY_DIR}")
include_directories("${CMAKE_CURRENT_BINARY_DIR}/gen-cpp")
include_directories("${PROJECT_SOURCE_DIR}/lib/cpp/src")

include(ThriftMacros)

set(tutorialgencpp_SOURCES
    gen-cpp/Calculator.cpp
    gen-cpp/SharedService.cpp
    gen-cpp/shared_constants.cpp
    gen-cpp/shared_types.cpp
    gen-cpp/tutorial_constants.cpp
    gen-cpp/tutorial_types.cpp
)
add_library(tutorialgencpp STATIC ${tutorialgencpp_SOURCES})
LINK_AGAINST_THRIFT_LIBRARY(tutorialgencpp thrift)

add_custom_command(OUTPUT gen-cpp/Calculator.cpp gen-cpp/SharedService.cpp gen-cpp/shared_constants.cpp gen-cpp/shared_types.cpp gen-cpp/tutorial_constants.cpp gen-cpp/tutorial_types.cpp
    COMMAND ${THRIFT_COMPILER} --gen cpp -r ${PROJECT_SOURCE_DIR}/tutorial/tutorial.thrift
)

add_executable(TutorialServer CppServer.cpp)
target_link_libraries(TutorialServer tutorialgencpp)
LINK_AGAINST_THRIFT_LIBRARY(TutorialServer thrift)
target_link_libraries(TutorialServer ${ZLIB_LIBRARIES})

add_executable(TutorialClient CppClient.cpp)
target_link_libraries(TutorialClient tutorialgencpp)
LINK_AGAINST_THRIFT_LIBRARY(TutorialClient thrift)
target_link_libraries(TutorialClient ${ZLIB_LIBRARIES})
