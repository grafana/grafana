/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

#include "gen-cpp/Recursive_types.h"
#include <thrift/transport/TBufferTransports.h>
#include <thrift/protocol/TBinaryProtocol.h>

#define BOOST_TEST_MODULE RecursiveTest
#include <boost/test/unit_test.hpp>

using apache::thrift::transport::TMemoryBuffer;
using apache::thrift::protocol::TBinaryProtocol;
using boost::shared_ptr;

BOOST_AUTO_TEST_CASE(test_recursive_1) {
  shared_ptr<TMemoryBuffer> buf(new TMemoryBuffer());
  shared_ptr<TBinaryProtocol> prot(new TBinaryProtocol(buf));
  
  RecTree tree;
  RecTree child;
  tree.children.push_back(child);

  tree.write(prot.get());

  RecTree result;
  result.read(prot.get());
  BOOST_CHECK(tree == result);
}

BOOST_AUTO_TEST_CASE(test_recursive_2) {
  shared_ptr<TMemoryBuffer> buf(new TMemoryBuffer());
  shared_ptr<TBinaryProtocol> prot(new TBinaryProtocol(buf));
  
  RecList l;
  boost::shared_ptr<RecList> l2(new RecList);
  l.nextitem = l2;

  l.write(prot.get());

  RecList resultlist;
  resultlist.read(prot.get());
  BOOST_CHECK(resultlist.nextitem != NULL);
  BOOST_CHECK(resultlist.nextitem->nextitem == NULL);
}

BOOST_AUTO_TEST_CASE(test_recursive_3) {
  shared_ptr<TMemoryBuffer> buf(new TMemoryBuffer());
  shared_ptr<TBinaryProtocol> prot(new TBinaryProtocol(buf));

  CoRec c;
  boost::shared_ptr<CoRec2> r(new CoRec2);
  c.other = r;

  c.write(prot.get());

  c.read(prot.get());
  BOOST_CHECK(c.other != NULL);
  BOOST_CHECK(c.other->other.other == NULL);
}

BOOST_AUTO_TEST_CASE(test_recursive_4) {
  shared_ptr<TMemoryBuffer> buf(new TMemoryBuffer());
  shared_ptr<TBinaryProtocol> prot(new TBinaryProtocol(buf));

  boost::shared_ptr<RecList> depthLimit(new RecList);
  depthLimit->nextitem = depthLimit;
  BOOST_CHECK_THROW(depthLimit->write(prot.get()),
    apache::thrift::protocol::TProtocolException);

  depthLimit->nextitem.reset();
}
