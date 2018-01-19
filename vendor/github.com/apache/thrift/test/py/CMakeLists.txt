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

add_test(NAME python_test_generate
    COMMAND ${CMAKE_COMMAND}
            -DTHRIFTCOMPILER=$<TARGET_FILE:thrift-compiler>
            -DMY_PROJECT_DIR=${PROJECT_SOURCE_DIR}
            -DMY_CURRENT_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}
            -DMY_CURRENT_BINARY_DIR=${CMAKE_CURRENT_BINARY_DIR}
    -P ${CMAKE_CURRENT_SOURCE_DIR}/generate.cmake
)

add_test(NAME python_test
    COMMAND ${PYTHON_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/RunClientServer.py --gen-base=${CMAKE_CURRENT_BINARY_DIR}
    DEPENDS python_test_generate
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)

