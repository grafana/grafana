#! /bin/sh

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

if [ -n "${1}" ]; then
  COVER=${1};
fi

DIR="$( cd "$( dirname "$0" )" && pwd )"

ISTANBUL="$DIR/../../../node_modules/istanbul/lib/cli.js"
RUNBROWSER="$DIR/../../../node_modules/run-browser/bin/cli.js"

REPORT_PREFIX="${DIR}/../coverage/report"

COUNT=0

export NODE_PATH="${DIR}:${DIR}/../lib:${NODE_PATH}"

testServer()
{
  echo "   Testing $1 Client/Server with protocol $2 and transport $3 $4";
  RET=0
  if [ -n "${COVER}" ]; then
    ${ISTANBUL} cover ${DIR}/server.js --dir ${REPORT_PREFIX}${COUNT} --handle-sigint -- --type $1 -p $2 -t $3 $4 &
    COUNT=$((COUNT+1))
  else
    node ${DIR}/server.js --type $1 -p $2 -t $3 $4 &
  fi
  SERVERPID=$!
  sleep 1
  if [ -n "${COVER}" ]; then
    ${ISTANBUL} cover ${DIR}/client.js --dir ${REPORT_PREFIX}${COUNT} -- --type $1 -p $2 -t $3 $4 || RET=1
    COUNT=$((COUNT+1))
  else
    node ${DIR}/client.js --type $1 -p $2 -t $3 $4 || RET=1
  fi
  kill -2 $SERVERPID || RET=1
  return $RET
}

testBrowser()
{
  echo "   Testing browser client with http server with json protocol and buffered transport";
  RET=0
  node ${DIR}/server.js --type http -p json -t buffered &
  SERVERPID=$!
  sleep 1
  ${RUNBROWSER} ${DIR}/browser_client.js --phantom || RET=1
  kill -2 $SERVERPID || RET=1
  return $RET
}

TESTOK=0

#generating thrift code

${DIR}/../../../compiler/cpp/thrift -o ${DIR} --gen js:node ${DIR}/../../../test/ThriftTest.thrift
${DIR}/../../../compiler/cpp/thrift -o ${DIR} --gen js:node ${DIR}/../../../test/JsDeepConstructorTest.thrift

#unit tests

node ${DIR}/binary.test.js || TESTOK=1
node ${DIR}/deep-constructor.test.js || TESTOK=1

#integration tests

for type in tcp multiplex websocket http
do

  for protocol in compact binary json
  do

    for transport in buffered framed
    do
      testServer $type $protocol $transport || TESTOK=1
      testServer $type $protocol $transport --ssl || TESTOK=1
      testServer $type $protocol $transport --promise || TESTOK=1
    done
  done
done

# XHR only until phantomjs 2 is released.
testBrowser

if [ -n "${COVER}" ]; then
  ${ISTANBUL} report --dir "${DIR}/../coverage" --include "${DIR}/../coverage/report*/coverage.json" lcov cobertura html
  rm -r ${DIR}/../coverage/report*/*
  rmdir ${DIR}/../coverage/report*
fi

exit $TESTOK
