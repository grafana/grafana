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

file(GLOB java_sources src/**/*.java)

if(ANDROID)
    set(android_sources
        android/build.gradle
        android/settings.gradle
        android/src/main/AndroidManifest.xml
    )
    set(THRIFT_AAR outputs/aar/thrift-debug.aar outputs/aar/thrift-release.aar)
    add_custom_command(
        OUTPUT ${THRIFT_AAR}
        COMMAND ${GRADLE_EXECUTABLE} -p"${CMAKE_CURRENT_SOURCE_DIR}/android" -PbuildDir="${CMAKE_CURRENT_BINARY_DIR}" assemble
        DEPENDS ${java_sources} ${android_sources})
    add_custom_target(thrift_aar ALL DEPENDS ${THRIFT_AAR})

else(ANDROID)

    if(IS_ABSOLUTE "${LIB_INSTALL_DIR}")
        set(JAVA_INSTALL_DIR "${LIB_INSTALL_DIR}/java")
    else()
        set(JAVA_INSTALL_DIR "${CMAKE_INSTALL_PREFIX}/${LIB_INSTALL_DIR}/java")
    endif()

    if(IS_ABSOLUTE "${DOC_INSTALL_DIR}")
        set(JAVA_DOC_INSTALL_DIR "${DOC_INSTALL_DIR}/java")
    else()
        set(JAVA_DOC_INSTALL_DIR "${CMAKE_INSTALL_PREFIX}/${DOC_INSTALL_DIR}/java")
    endif()

    file(GLOB_RECURSE ThriftJava_SOURCES ${CMAKE_CURRENT_SOURCE_DIR}/src/*.java)
    set(ThriftJava_ARTIFACTS
        libthrift-${thrift_VERSION}.jar
        libthrift-${thrift_VERSION}.pom
    )
    add_custom_command(
        OUTPUT ${ThriftJava_ARTIFACTS}
        COMMAND ${Ant_EXECUTABLE} ${ANT_FLAGS} -Dbuild.dir="${CMAKE_CURRENT_BINARY_DIR}" -f build.xml
        MAIN_DEPENDENCY ${CMAKE_CURRENT_SOURCE_DIR}/build.xml
        DEPENDS ${ThriftJava_SOURCES}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )

    add_custom_target(ThriftJava ALL
        COMMENT "Building Java library using Ant"
        DEPENDS ${ThriftJava_ARTIFACTS}
    )

    # Hook the ant install task into CMake install
    install(CODE "execute_process(
        COMMAND ${Ant_EXECUTABLE} ${ANT_FLAGS} install
        -Dbuild.dir=\"${CMAKE_CURRENT_BINARY_DIR}\"
        -Dinstall.path=\"${JAVA_INSTALL_DIR}\" -Dinstall.javadoc.path=\"${JAVA_DOC_INSTALL_DIR}\" -f build.xml
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )")

    if(BUILD_TESTING)
        add_test(NAME JavaTest
                 COMMAND ${Ant_EXECUTABLE} ${ANT_FLAGS} -Dbuild.dir="${CMAKE_CURRENT_BINARY_DIR}" -Dthrift.compiler="${THRIFT_COMPILER}" -f build.xml test
                 WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
    endif()
endif(ANDROID)
