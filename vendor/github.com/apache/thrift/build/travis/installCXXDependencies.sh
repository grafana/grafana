#!/bin/sh

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


# Mainly aiming Travis CI's Ubuntu machines for now
# see what we need: http://thrift.apache.org/docs/install/ubuntu

# General dependencies
sudo apt-add-repository "deb http://archive.ubuntu.com/ubuntu/ trusty main restricted" -y
sudo apt-get update -qq

sudo apt-get install -qq libpango-1.0-0 libqt4-dev qtbase5-dev qtbase5-dev-tools qt5-default libboost-dev libboost-test-dev libboost-program-options-dev libboost-system-dev libboost-filesystem-dev libboost-thread-dev libevent-dev automake libtool flex bison pkg-config g++ libssl-dev make cmake git debhelper bc nsis ninja-build
dpkg -S /usr/include/boost/version.hpp
