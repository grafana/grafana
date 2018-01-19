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

# Apache Thrift Docker build environment for Centos 6
#
# This file is intended for testing old packages that are not available for
# latest Ubuntu LTS/Debian/CentOS. Currently, it is only used for Python 2.6.
#

FROM centos:6
MAINTAINER Apache Thrift <dev@thrift.apache.org>

RUN yum install -y epel-release && \
    yum install -y \
      autoconf \
      bison \
      bison-devel \
      clang \
      flex \
      gcc \
      gcc-c++ \
      git \
      libtool \
      m4 \
      make \
      perl \
      tar \
      python-devel \
      python-setuptools \
      python-twisted-web \
      python-pip \
    && yum clean all

# optional dependencies
RUN pip install ipaddress backports.ssl_match_hostname tornado

# CMake
RUN curl -sSL https://cmake.org/files/v3.4/cmake-3.4.1.tar.gz | tar -xz && \
    cd cmake-3.4.1 && ./bootstrap && make -j4 && make install && \
    cd .. && rm -rf cmake-3.4.1

ENV THRIFT_ROOT /thrift
RUN mkdir -p $THRIFT_ROOT/src
COPY Dockerfile $THRIFT_ROOT/
WORKDIR $THRIFT_ROOT/src
