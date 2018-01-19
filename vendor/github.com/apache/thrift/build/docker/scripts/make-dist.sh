#!/bin/sh
set -ev

./bootstrap.sh
./configure $*
make dist
tar xvf thrift-*.tar.gz
cd thrift-*
./build/docker/scripts/cmake.sh
