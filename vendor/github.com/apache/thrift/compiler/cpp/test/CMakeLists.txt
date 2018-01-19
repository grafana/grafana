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


if(${WITH_PLUGIN})
    include_directories(SYSTEM "${Boost_INCLUDE_DIRS}")

    # Make sure gen-cpp files can be included
    include_directories("${CMAKE_CURRENT_BINARY_DIR}")

    set(plugintest_SOURCES
        plugin/conversion_test.cc
    )
    add_executable(plugintest ${plugintest_SOURCES})
    if(WITH_SHARED_LIB AND NOT MSVC)
        target_link_libraries(plugintest
            thriftc
            ${Boost_LIBRARIES}
        )
    else()
        target_link_libraries(plugintest
            thriftc_static
            thrift_static
            ${Boost_LIBRARIES}
        )
    endif()
    add_test(NAME PluginUnitTest COMMAND plugintest)

    set(thrift-gen-mycpp_SOURCES
        ../src/thrift/generate/t_cpp_generator.cc
        plugin/cpp_plugin.cc
    )
    add_executable(thrift-gen-mycpp ${thrift-gen-mycpp_SOURCES})
    if(WITH_SHARED_LIB AND NOT MSVC)
        target_link_libraries(thrift-gen-mycpp thriftc)
    else()
        target_link_libraries(thrift-gen-mycpp thriftc_static thrift_static)
    endif()

    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        set(BUILDTYPE "Debug")
    else()
        # RelWithDebInfo generates binaries in "Release" directory too
        set(BUILDTYPE "Release")
    endif()

    set_directory_properties(PROPERTIES
        ADDITIONAL_MAKE_CLEAN_FILES gen-cpp
        ADDITIONAL_MAKE_CLEAN_FILES gen-mycpp)

    file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/gen-cpp)
    file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/gen-mycpp)
    add_test(NAME PluginIntegrationTest
             COMMAND ${CMAKE_COMMAND}
                 -DTHRIFT_COMPILER=${THRIFT_COMPILER}
                 -DBINDIR=${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
                 -DBUILDTYPE=${BUILDTYPE}
                 -DCURDIR=${CMAKE_CURRENT_BINARY_DIR}
                 -DSRCDIR=${CMAKE_CURRENT_SOURCE_DIR}
                 -P ${CMAKE_CURRENT_SOURCE_DIR}/cpp_plugin_test.cmake)
endif()
