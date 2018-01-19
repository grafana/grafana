#!/bin/bash

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

# Runs the D ThriftTest client and servers for all combinations of transport,
# protocol, SSL-mode and server type.
# Pass -k to keep going after failed tests.

CUR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

protocols="binary compact json"
# TODO: fix and enable http
# transports="buffered framed raw http"
transports="buffered framed raw"
servers="simple taskpool threaded"
framed_only_servers="nonblocking pooledNonblocking"

# Don't leave any server instances behind when interrupted (e.g. by Ctrl+C)
# or terminated.
trap "kill $(jobs -p) 2>/dev/null" INT TERM

for protocol in $protocols; do
  for ssl in "" " --ssl"; do
    for transport in $transports; do
      for server in $servers $framed_only_servers; do
        case $framed_only_servers in
          *$server*) if [ $transport != "framed" ] || [ $ssl != "" ]; then continue; fi;;
        esac

        args="--transport=$transport --protocol=$protocol$ssl"
        ${CUR}/thrift_test_server $args --server-type=$server > /dev/null &
        server_pid=$!

        # Give the server some time to get up and check if it runs (yes, this
        # is a huge kludge, should add a connect timeout to test client).
        client_rc=-1
        if [ "$server" = "taskpool" ]; then
          sleep 0.5
        else
          sleep 0.02
        fi
        kill -0 $server_pid 2>/dev/null
        if [ $? -eq 0 ]; then
          ${CUR}/thrift_test_client $args --numTests=10 > /dev/null
          client_rc=$?

          # Temporarily redirect stderr to null to avoid job control messages,
          # restore it afterwards.
          exec 3>&2
          exec 2>/dev/null
          kill $server_pid
          exec 3>&2
        fi

        # Get the server exit code (wait should immediately return).
        wait $server_pid
        server_rc=$?

        if [ $client_rc -ne 0 -o $server_rc -eq 1 ]; then
          echo -e "\nTests failed for: $args --server-type=$server"
          failed="true"
          if [ "$1" != "-k" ]; then
            exit 1
          fi
        else
           echo -n "."
        fi
      done
    done
  done
done

echo
if [ -z "$failed" ]; then
  echo "All tests passed."
fi
