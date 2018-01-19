# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Apache Thrift Docker build environment for Centos
#
# Known missing client libraries:
#  - D
#  - Haxe
#  - Lua
#

FROM centos:7
MAINTAINER Apache Thrift <dev@thrift.apache.org>

RUN yum install -y epel-release

# General dependencies
RUN yum install -y \
      tar \
      m4 \
      perl \
      clang \
      gcc \
      gcc-c++ \
      git \
      libtool \
      autoconf \
      make \
      bison \
      bison-devel \
      flex

# C++ dependencies
RUN yum install -y \
      boost-devel-static \
      zlib-devel \
      openssl-devel \
      libevent-devel

# Java Dependencies
RUN yum install -y \
      ant \
      junit \
      ant-junit \
      java-1.7.0-openjdk-devel

# Python Dependencies
RUN yum install -y \
      python-devel \
      python-pip \
      python-setuptools \
      python-six \
      python-twisted-web && \
    pip install -U backports.ssl_match_hostname ipaddress tornado

# Ruby Dependencies
RUN yum install -y \
      ruby \
      ruby-devel \
      rubygems && \
    gem install bundler rake

# Perl Dependencies
RUN yum install -y \
      perl-Bit-Vector \
      perl-Class-Accessor \
      perl-ExtUtils-MakeMaker \
      perl-Test-Simple \
      perl-IO-Socket-SSL \
      perl-Net-SSLeay \
      perl-Crypt-SSLeay

# PHP Dependencies
RUN yum install -y \
      php \
      php-devel \
      php-pear \
      re2c \
      php-phpunit-PHPUnit \
      bzip2

# GLibC Dependencies
RUN yum install -y glib2-devel

# Erlang Dependencies
RUN curl -sSL http://packages.erlang-solutions.com/rpm/centos/erlang_solutions.repo -o /etc/yum.repos.d/erlang_solutions.repo && \
    yum install -y \
      erlang-kernel \
      erlang-erts \
      erlang-stdlib \
      erlang-eunit \
      erlang-rebar \
      erlang-tools

# Go Dependencies
RUN curl -sSL https://storage.googleapis.com/golang/go1.4.3.linux-amd64.tar.gz | tar -C /usr/local/ -xz
ENV PATH /usr/local/go/bin:$PATH

# Haskell Dependencies
RUN yum -y install haskell-platform

# Node.js Dependencies
RUN yum install -y \
      nodejs \
      nodejs-devel \
      npm

# C# Dependencies
RUN yum install -y \
      mono-core \
      mono-devel \
      mono-web-devel \
      mono-extras \

# MinGW Dependencies
RUN yum install -y \
      mingw32-binutils \
      mingw32-crt \
      mingw32-nsis

# CMake
RUN curl -sSL https://cmake.org/files/v3.4/cmake-3.4.0.tar.gz | tar -xz && \
    cd cmake-3.4.0 && ./bootstrap && make -j4 && make install && \
    cd .. && rm -rf cmake-3.4.0

# Clean up
RUN rm -rf /tmp/* && \
    yum clean all

ENV THRIFT_ROOT /thrift
RUN mkdir -p $THRIFT_ROOT/src
COPY Dockerfile $THRIFT_ROOT/
WORKDIR $THRIFT_ROOT/src
