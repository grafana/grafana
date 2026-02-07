#!/bin/sh
go test -c
./ps.test -test.run=none -test.bench=$2 -test.$1profile=$1.profile
