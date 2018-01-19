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

set(CMAKE_AUTOMOC ON)
find_package(Qt5 REQUIRED COMPONENTS Test Network)
set(TQTcpServerTest_Qt5_SOURCES
    TQTcpServerTest.cpp
)
add_executable(TQTcpServerTest_Qt5 ${TQTcpServerTest_Qt5_SOURCES})
target_link_libraries(TQTcpServerTest_Qt5 testgencpp_cob)
LINK_AGAINST_THRIFT_LIBRARY(TQTcpServerTest_Qt5 thriftqt5)
LINK_AGAINST_THRIFT_LIBRARY(TQTcpServerTest_Qt5 thrift)
target_link_libraries(TQTcpServerTest_Qt5 Qt5::Test Qt5::Network)

add_test(NAME TQTcpServerTest_Qt5 COMMAND TQTcpServerTest_Qt5)

