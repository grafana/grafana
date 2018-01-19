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


# Define the default install paths
set(BIN_INSTALL_DIR "bin" CACHE PATH "The binary install dir (default: bin)")
set(LIB_INSTALL_DIR "lib${LIB_SUFFIX}" CACHE PATH "The library install dir (default: lib${LIB_SUFFIX})")
set(INCLUDE_INSTALL_DIR "include" CACHE PATH "The library install dir (default: include)")
set(CMAKE_INSTALL_DIR "cmake" CACHE PATH "The subdirectory to install cmake config files (default: cmake)")
set(DOC_INSTALL_DIR "share/doc" CACHE PATH "The subdirectory to install documentation files (default: share/doc)")
