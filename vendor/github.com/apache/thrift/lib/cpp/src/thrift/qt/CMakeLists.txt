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

set( thriftcppqt5_SOURCES
    TQIODeviceTransport.cpp
    TQTcpServer.cpp
)
set(CMAKE_AUTOMOC ON)
find_package(Qt5 REQUIRED COMPONENTS Core Network)
ADD_LIBRARY_THRIFT(thriftqt5 ${thriftcppqt5_SOURCES})
TARGET_LINK_LIBRARIES_THRIFT(thriftqt5 Qt5::Core Qt5::Network)
TARGET_LINK_LIBRARIES_THRIFT_AGAINST_THRIFT_LIBRARY(thriftqt5 thrift)
