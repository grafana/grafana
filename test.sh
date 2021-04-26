#!/bin/bash

loki_log_request() {
  local date=$1
  local cluster=$2
  local server=$3
  local type=$4
  local log="{\"streams\": [{ \"stream\": { \"level\": \"info\", \"cluster\":\"$cluster\", \"server\": \"$server\", \"type\": \"type\" }, \"values\": [ [ \"${date}000000000\", \"${cluster}:${server} - ${type} request\" ] ] }]}"
  curl -v -H "Content-Type: application/json" -XPOST -s "http://localhost:3100/loki/api/v1/push" --data-raw "${log}"
}

loki_log_error() {
  local date=$1
  local cluster=$2
  local server=$3
  local log="{\"streams\": [{ \"stream\": { \"level\": \"error\", \"cluster\":\"$cluster\", \"server\": \"$server\" }, \"values\": [ [ \"${date}000000000\", \"${cluster}:${server} - Fatal error!\" ] ] }]}"
  curl -v -H "Content-Type: application/json" -XPOST -s "http://localhost:3100/loki/api/v1/push" --data-raw "${log}"
}

loki_log_server() {
  local date=$1
  local logType=$2
  local cluster=$3
  local server=$4

  if [ $logType = "ERROR" ]
  then
    loki_log_error $date $cluster $server
  else
    loki_log_request $date $cluster $server $logType
  fi

}

loki_log() {
  local date=$(date -v$1S +%s)
  local server1=$2
  local server2=$3
  local server3=$4
  local server4=$5

  loki_log_server $date $server1 "west" "001"
  loki_log_server $date $server2 "west" "002"
  loki_log_server $date $server3 "east" "001"
  loki_log_server $date $server4 "east" "002"
}

graphite_cpu() {
  local date=$(date -v$1S +%s)
  local west1=$2
  local west2=$3
  local east1=$4
  local east2=$5

  echo "servers.west.001.cpu ${west1} ${date}" | nc localhost 2103
  echo "servers.west.002.cpu ${west2} ${date}" | nc localhost 2103
  echo "servers.east.001.cpu ${east1} ${date}" | nc localhost 2103
  echo "servers.east.002.cpu ${east2} ${date}" | nc localhost 2103

  echo "serverstats;cluster=west;server=001 ${west1} ${date}" | nc localhost 2103
  echo "serverstats;cluster=west;server=002 ${west2} ${date}" | nc localhost 2103
  echo "serverstats;cluster=east;server=001 ${east1} ${date}" | nc localhost 2103
  echo "serverstats;cluster=east;server=002 ${east2} ${date}" | nc localhost 2103
}

normal() {
  local relSeconds=$1
  loki_log $1 "POST" "GET" "GET" "POST"
  loki_log $1 "GET" "POST" "GET" "POST"


  local s1=$((30 + $RANDOM % 20))
  local s2=$((30 + $RANDOM % 20))
  local s3=$((30 + $RANDOM % 20))
  local s4=$((30 + $RANDOM % 20))
  graphite_cpu $relSeconds $s1 $s2 $s3 $s4
}

error() {
  local relSeconds=$1
  loki_log $1 "POST" "ERROR" "GET" "POST"
  loki_log $1 "GET" "ERROR" "GET" "POST"

  local s1=$((90 + $RANDOM % 5))
  local s2=$((10 + $RANDOM % 10))
  local s3=$((30 + $RANDOM % 20))
  local s4=$((30 + $RANDOM % 20))
  graphite_cpu $relSeconds $s1 $s2 $s3 $s4
}


for (( x = -300; x <= -180; x += 10)); do normal $x;done
for (( x = -170; x <= -60; x += 10)); do error $x;done
for (( x = -50; x <= 0; x += 10)); do normal $x;done

