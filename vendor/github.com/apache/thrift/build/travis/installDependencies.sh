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

SCRIPTPATH=$( cd $(dirname $0) ; pwd -P )

# Mainly aiming Travis CI's Ubuntu machines for now
# see what we need: http://thrift.apache.org/docs/install/ubuntu

# Java dependencies
sudo apt-get install -qq ant openjdk-7-jdk
sudo update-java-alternatives -s java-1.7.0-openjdk-amd64

# Python dependencies
sudo apt-get install -qq python-all python-all-dev python-all-dbg python-setuptools python-support python-twisted python-six python3-six

# Ruby dependencies
sudo apt-get install -qq ruby ruby-dev
sudo gem install bundler rake

# Perl dependencies
sudo apt-get install -qq libbit-vector-perl libclass-accessor-class-perl libio-socket-ssl-perl libnet-ssleay-perl libcrypt-ssleay-perl

# Php dependencies
sudo apt-get install -qq php5 php5-dev php5-cli php-pear re2c

# GlibC dependencies
sudo apt-get install -qq libglib2.0-dev

# Erlang dependencies
sudo apt-get install -qq erlang-base erlang-eunit erlang-dev erlang-tools rebar

# GO dependencies
echo "golang-go golang-go/dashboard boolean false" | debconf-set-selections
sudo apt-get -y install -qq golang golang-go

# Haskell dependencies
sudo add-apt-repository -y ppa:hvr/ghc
sudo apt-get update
sudo apt-get install cabal-install-1.20 ghc-$GHCVER

# Lua dependencies
sudo apt-get install -qq lua5.2 lua5.2-dev

# Node.js dependencies
sudo apt-get install -qq nodejs nodejs-dev npm
sudo update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

# CSharp
sudo apt-get install -qq mono-gmcs mono-devel libmono-system-web2.0-cil
sudo apt-get install -qq mingw32 mingw32-binutils mingw32-runtime nsis
