#!/bin/sh

BENCHMARKS=`grep "func Benchmark" *_test.go  | sed 's/.*func //' | sed s/\(.*{//`

for BENCHMARK in $BENCHMARKS
do
	go test -v -run=xxx -bench=^$BENCHMARK$ -benchtime=10s -tags 'forestdb leveldb'  | grep -v ok | grep -v PASS
done
