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
#  - None

FROM buildpack-deps:jessie-scm
MAINTAINER Apache Thrift <dev@thrift.apache.org>

ENV DEBIAN_FRONTEND noninteractive

# Add apt sources
# Dart
RUN curl https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    curl https://storage.googleapis.com/download.dartlang.org/linux/debian/dart_stable.list > /etc/apt/sources.list.d/dart_stable.list && \
    sed -i /etc/apt/sources.list.d/dart_stable.list -e 's/https:/http:/g'

RUN apt-get update && apt-get install -y --no-install-recommends \
`# General dependencies` \
      bison \
      build-essential \
      clang \
      cmake \
      debhelper \
      flex \
      pkg-config

RUN apt-get update && apt-get install -y --no-install-recommends \
`# C++ dependencies` \
      libboost-dev \
      libboost-filesystem-dev \
      libboost-program-options-dev \
      libboost-system-dev \
      libboost-test-dev \
      libboost-thread-dev \
      libevent-dev \
      libssl-dev \
      qt5-default \
      qtbase5-dev \
      qtbase5-dev-tools

RUN apt-get update && apt-get install -y --no-install-recommends \
`# Java dependencies` \
      ant \
      ant-optional \
      openjdk-7-jdk \
      maven

RUN apt-get update && apt-get install -y --no-install-recommends \
`# Python dependencies` \
      python-all \
      python-all-dbg \
      python-all-dev \
      python-pip \
      python-setuptools \
      python-twisted \
      python-zope.interface \
      python3-all \
      python3-all-dbg \
      python3-all-dev \
      python3-setuptools \
      python3-pip

RUN echo 'deb http://deb.debian.org/debian jessie-backports main' >> /etc/apt/sources.list \
      && apt-get update && apt-get install -y --no-install-recommends \
`# Ruby dependencies` \
      ruby \
      ruby-bundler \
      ruby-dev \
`# Perl dependencies` \
      libbit-vector-perl \
      libclass-accessor-class-perl \
      libcrypt-ssleay-perl \
      libio-socket-ssl-perl \
      libnet-ssleay-perl

RUN apt-get update && apt-get install -y --no-install-recommends \
`# Php dependencies` \
      php5 \
      php5-dev \
      php5-cli \
      php-pear \
      re2c \
      phpunit \
`# GlibC dependencies` \
      libglib2.0-dev

RUN apt-get update && apt-get install -y --no-install-recommends \
`# Erlang dependencies` \
      erlang-base \
      erlang-eunit \
      erlang-dev \
      erlang-tools \
      rebar

RUN apt-get update && apt-get install -y --no-install-recommends \
`# Haskell dependencies` \
      ghc \
      cabal-install \
`# Haxe dependencies` \
      neko \
      neko-dev \
      libneko0

RUN apt-get update && apt-get install -y --no-install-recommends \
`# Node.js dependencies` \
      nodejs \
      nodejs-dev \
      nodejs-legacy \
      npm

RUN apt-get update && apt-get install -y --no-install-recommends \
`# CSharp dependencies` \
      libmono-system-web2.0-cil \
      mono-devel

RUN apt-get update && apt-get install -y --no-install-recommends \
`# D dependencies` \
      xdg-utils \
`# Dart dependencies` \
      dart \
`# Lua dependencies` \
      lua5.2 \
      lua5.2-dev \
`# MinGW dependencies` \
      mingw32 \
      mingw32-binutils \
`#      mingw32-runtime` \
      nsis \
`# Clean up` \
    && rm -rf /var/cache/apt/* && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/* && \
    rm -rf /var/tmp/*

# Ruby
RUN gem install bundler --no-ri --no-rdoc

# Python optional dependencies
RUN pip2 install -U ipaddress backports.ssl_match_hostname tornado
RUN pip3 install -U backports.ssl_match_hostname tornado

# Go
RUN curl -sSL https://storage.googleapis.com/golang/go1.4.3.linux-amd64.tar.gz | tar -C /usr/local/ -xz
ENV PATH /usr/local/go/bin:$PATH

# Haxe
RUN mkdir -p /usr/lib/haxe && \
    curl http://haxe.org/website-content/downloads/3.2.0/downloads/haxe-3.2.0-linux64.tar.gz | \
    tar -C /usr/lib/haxe --strip-components=1 -xz && \
    ln -s /usr/lib/haxe/haxe /usr/bin/haxe && \
    ln -s /usr/lib/haxe/haxelib /usr/bin/haxelib && \
    mkdir -p /usr/lib/haxe/lib  && \
    chmod -R 777 /usr/lib/haxe/lib && \
    haxelib setup /usr/lib/haxe/lib && \
    haxelib install hxcpp

# D
RUN curl -sSL http://downloads.dlang.org/releases/2.x/2.070.0/dmd_2.070.0-0_amd64.deb -o /tmp/dmd_2.070.0-0_amd64.deb && \
    dpkg -i /tmp/dmd_2.070.0-0_amd64.deb && \
    rm /tmp/dmd_2.070.0-0_amd64.deb && \
    curl -sSL https://github.com/D-Programming-Deimos/openssl/archive/master.tar.gz| tar xz && \
    curl -sSL https://github.com/D-Programming-Deimos/libevent/archive/master.tar.gz| tar xz && \
    mkdir -p /usr/include/dmd/druntime/import/deimos /usr/include/dmd/druntime/import/C && \
    mv libevent-master/deimos/* openssl-master/deimos/* /usr/include/dmd/druntime/import/deimos/ && \
    mv libevent-master/C/* openssl-master/C/* /usr/include/dmd/druntime/import/C/ && \
    rm -rf libevent-master openssl-master && \
    echo 'gcc -Wl,--no-as-needed $*' > /usr/local/bin/gcc-dmd && \
    chmod 755 /usr/local/bin/gcc-dmd && \
    echo 'CC=/usr/local/bin/gcc-dmd' >> /etc/dmd.conf

# Dart
ENV PATH /usr/lib/dart/bin:$PATH

# Force utf8 locale to successfully build Haskell tf-random
ENV LC_ALL C.UTF-8

ENV THRIFT_ROOT /thrift
RUN mkdir -p $THRIFT_ROOT/src
COPY Dockerfile $THRIFT_ROOT/
WORKDIR $THRIFT_ROOT/src
