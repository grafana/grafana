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
 */

#include <algorithm>
#include <boost/test/auto_unit_test.hpp>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/transport/TShortReadTransport.h>

using std::string;
using boost::shared_ptr;
using apache::thrift::transport::TMemoryBuffer;
using apache::thrift::transport::TBufferedTransport;
using apache::thrift::transport::TFramedTransport;
using apache::thrift::transport::test::TShortReadTransport;

// Shamelessly copied from ZlibTransport.  TODO: refactor.
unsigned int dist[][5000] = {
 { 1<<15 },

 {
  5,13,9,1,8,9,11,13,18,48,24,13,21,13,5,11,35,2,4,20,17,72,27,14,15,4,7,26,
  12,1,14,9,2,16,29,41,7,24,4,27,14,4,1,4,25,3,6,34,10,8,50,2,14,13,55,29,3,
  43,53,49,14,4,10,32,27,48,1,3,1,11,5,17,16,51,17,30,15,11,9,2,2,11,52,12,2,
  13,94,1,19,1,38,2,8,43,8,33,7,30,8,17,22,2,15,14,12,34,2,12,6,37,29,74,3,
  165,16,11,17,5,14,3,10,7,37,11,24,7,1,3,12,37,8,9,34,17,12,8,21,13,37,1,4,
  30,14,78,4,15,2,40,37,17,12,36,82,14,4,1,4,7,17,11,16,88,77,2,3,15,3,34,11,
  5,79,22,34,8,4,4,40,22,24,28,9,13,3,34,27,9,16,39,16,39,13,2,4,3,41,26,10,4,
  33,4,7,12,5,6,3,10,30,8,21,16,58,19,9,0,47,7,13,11,19,15,7,53,57,2,13,28,22,
  3,16,9,25,33,12,40,7,12,64,7,14,24,44,9,2,14,11,2,58,1,26,30,11,9,5,24,7,9,
  94,2,10,21,5,5,4,5,6,179,9,18,2,7,13,31,41,17,4,36,3,21,6,26,8,15,18,44,27,
  11,9,25,7,0,14,2,12,20,23,13,2,163,9,5,15,65,2,14,6,8,98,11,15,14,34,2,3,10,
  22,9,92,7,10,32,67,13,3,4,35,8,2,1,5,0,26,381,7,27,8,2,16,93,4,19,5,8,25,9,
  31,14,4,21,5,3,9,22,56,4,18,3,11,18,6,4,3,40,12,16,110,8,35,14,1,18,40,9,12,
  14,3,11,7,57,13,18,116,53,19,22,7,16,11,5,8,21,16,1,75,21,20,1,28,2,6,1,7,
  19,38,5,6,9,9,4,1,7,55,36,62,5,4,4,24,15,1,12,35,48,20,5,17,1,5,26,15,4,54,
  13,5,5,15,5,19,32,29,31,7,6,40,7,80,11,18,8,128,48,6,12,84,13,4,7,2,13,9,16,
  17,3,254,1,4,181,8,44,7,6,24,27,9,23,14,34,16,22,25,10,3,3,4,4,12,2,12,6,7,
  13,58,13,6,11,19,53,11,66,18,19,10,4,13,2,5,49,58,1,67,7,21,64,14,11,14,8,3,
  26,33,91,31,20,7,9,42,39,4,3,55,11,10,0,7,4,75,8,12,0,27,3,8,9,0,12,12,23,
  28,23,20,4,13,30,2,22,20,19,30,6,22,2,6,4,24,7,19,55,86,5,33,2,161,6,7,1,62,
  13,3,72,12,12,9,7,12,10,5,10,29,1,5,22,13,13,5,2,12,3,7,14,18,2,3,46,21,17,
  15,19,3,27,5,16,45,31,10,8,17,18,18,3,7,24,6,55,9,3,6,12,10,12,8,91,9,4,4,4,
  27,29,16,5,7,22,43,28,11,14,8,11,28,109,55,71,40,3,8,22,26,15,44,3,25,29,5,
  3,32,17,12,3,29,27,25,15,11,8,40,39,38,17,3,9,11,2,32,11,6,20,48,75,27,3,7,
  54,12,95,12,7,24,23,2,13,8,15,16,5,12,4,17,7,19,88,2,6,13,115,45,12,21,2,86,
  74,9,7,5,16,32,16,2,21,18,6,34,5,18,260,7,12,16,44,19,92,31,7,8,2,9,0,0,15,
  8,38,4,8,20,18,2,83,3,3,4,9,5,3,10,3,5,29,15,7,11,8,48,17,23,2,17,4,11,22,
  21,64,8,8,4,19,95,0,17,28,9,11,20,71,5,11,18,12,13,45,49,4,1,33,32,23,13,5,
  52,2,2,16,3,4,7,12,2,1,12,6,24,1,22,155,21,3,45,4,12,44,26,5,40,36,9,9,8,20,
  35,31,3,2,32,50,10,8,37,2,75,35,22,15,192,8,11,23,1,4,29,6,8,8,5,12,18,32,4,
  7,12,2,0,0,9,5,48,11,35,3,1,123,6,29,8,11,8,23,51,16,6,63,12,2,5,4,14,2,15,
  7,14,3,2,7,17,32,8,8,10,1,23,62,2,49,6,49,47,23,3,20,7,11,39,10,24,6,15,5,5,
  11,8,16,36,8,13,20,3,10,44,7,52,7,10,36,6,15,10,5,11,4,14,19,17,10,12,3,6,
  23,4,13,94,70,7,36,7,38,7,28,8,4,15,3,19,4,33,39,21,109,4,80,6,40,4,432,4,4,
  7,8,3,31,8,28,37,34,10,2,21,5,22,0,7,36,14,12,6,24,1,21,5,9,2,29,20,54,113,
  13,31,39,27,6,0,27,4,5,2,43,7,8,57,8,62,7,9,12,22,90,30,6,19,7,10,20,6,5,58,
  32,30,41,4,10,25,13,3,8,7,10,2,9,6,151,44,16,12,16,20,8,3,18,11,17,4,10,45,
  15,8,56,38,52,25,40,14,4,17,15,8,2,19,7,8,26,30,2,3,180,8,26,17,38,35,5,16,
  28,5,15,56,13,14,18,9,15,83,27,3,9,4,11,8,27,27,44,10,12,8,3,48,14,7,9,4,4,
  8,4,5,9,122,8,14,12,19,17,21,4,29,63,21,17,10,12,18,47,10,10,53,4,18,16,4,8,
  118,9,5,12,9,11,9,3,12,32,3,23,2,15,3,3,30,3,17,235,15,22,9,299,14,17,1,5,
  16,8,3,7,3,13,2,7,6,4,8,66,2,13,6,15,16,47,3,36,5,7,10,24,1,9,9,8,13,16,26,
  12,7,24,21,18,49,23,39,10,41,4,13,4,27,11,12,12,19,4,147,8,10,9,40,21,2,83,
  10,5,6,11,25,9,50,57,40,12,12,21,1,3,24,23,9,3,9,13,2,3,12,57,8,11,13,15,26,
  15,10,47,36,4,25,1,5,8,5,4,0,12,49,5,19,4,6,16,14,6,10,69,10,33,29,7,8,61,
  12,4,0,3,7,6,3,16,29,27,38,4,21,0,24,3,2,1,19,16,22,2,8,138,11,7,7,3,12,22,
  3,16,5,7,3,53,9,10,32,14,5,7,3,6,22,9,59,26,8,7,58,5,16,11,55,7,4,11,146,91,
  8,13,18,14,6,8,8,31,26,22,6,11,30,11,30,15,18,31,3,48,17,7,6,4,9,2,25,3,35,
  13,13,7,8,4,31,10,8,10,4,3,45,10,23,2,7,259,17,21,13,14,3,26,3,8,27,4,18,9,
  66,7,12,5,8,17,4,23,55,41,51,2,32,26,66,4,21,14,12,65,16,22,17,5,14,2,29,24,
  7,3,36,2,43,53,86,5,28,4,58,13,49,121,6,2,73,2,1,47,4,2,27,10,35,28,27,10,
  17,10,56,7,10,14,28,20,24,40,7,4,7,3,10,11,32,6,6,3,15,11,54,573,2,3,6,2,3,
  14,64,4,16,12,16,42,10,26,4,6,11,69,18,27,2,2,17,22,9,13,22,11,6,1,15,49,3,
  14,1
 },

 {
  11,11,11,15,47,1,3,1,23,5,8,18,3,23,15,21,1,7,19,10,26,1,17,11,31,21,41,18,
  34,4,9,58,19,3,3,36,5,18,13,3,14,4,9,10,4,19,56,15,3,5,3,11,27,9,4,10,13,4,
  11,6,9,2,18,3,10,19,11,4,53,4,2,2,3,4,58,16,3,0,5,30,2,11,93,10,2,14,10,6,2,
  115,2,25,16,22,38,101,4,18,13,2,145,51,45,15,14,15,13,20,7,24,5,13,14,30,40,
  10,4,107,12,24,14,39,12,6,13,20,7,7,11,5,18,18,45,22,6,39,3,2,1,51,9,11,4,
  13,9,38,44,8,11,9,15,19,9,23,17,17,17,13,9,9,1,10,4,18,6,2,9,5,27,32,72,8,
  37,9,4,10,30,17,20,15,17,66,10,4,73,35,37,6,4,16,117,45,13,4,75,5,24,65,10,
  4,9,4,13,46,5,26,29,10,4,4,52,3,13,18,63,6,14,9,24,277,9,88,2,48,27,123,14,
  61,7,5,10,8,7,90,3,10,3,3,48,17,13,10,18,33,2,19,36,6,21,1,16,12,5,6,2,16,
  15,29,88,28,2,15,6,11,4,6,11,3,3,4,18,9,53,5,4,3,33,8,9,8,6,7,36,9,62,14,2,
  1,10,1,16,7,32,7,23,20,11,10,23,2,1,0,9,16,40,2,81,5,22,8,5,4,37,51,37,10,
  19,57,11,2,92,31,6,39,10,13,16,8,20,6,9,3,10,18,25,23,12,30,6,2,26,7,64,18,
  6,30,12,13,27,7,10,5,3,33,24,99,4,23,4,1,27,7,27,49,8,20,16,3,4,13,9,22,67,
  28,3,10,16,3,2,10,4,8,1,8,19,3,85,6,21,1,9,16,2,30,10,33,12,4,9,3,1,60,38,6,
  24,32,3,14,3,40,8,34,115,5,9,27,5,96,3,40,6,15,5,8,22,112,5,5,25,17,58,2,7,
  36,21,52,1,3,95,12,21,4,11,8,59,24,5,21,4,9,15,8,7,21,3,26,5,11,6,7,17,65,
  14,11,10,2,17,5,12,22,4,4,2,21,8,112,3,34,63,35,2,25,1,2,15,65,23,0,3,5,15,
  26,27,9,5,48,11,15,4,9,5,33,20,15,1,18,19,11,24,40,10,21,74,6,6,32,30,40,5,
  4,7,44,10,25,46,16,12,5,40,7,18,5,18,9,12,8,4,25,5,6,36,4,43,8,9,12,35,17,4,
  8,9,11,27,5,10,17,40,8,12,4,18,9,18,12,20,25,39,42,1,24,13,22,15,7,112,35,3,
  7,17,33,2,5,5,19,8,4,12,24,14,13,2,1,13,6,5,19,11,7,57,0,19,6,117,48,14,8,
  10,51,17,12,14,2,5,8,9,15,4,48,53,13,22,4,25,12,11,19,45,5,2,6,54,22,9,15,9,
  13,2,7,11,29,82,16,46,4,26,14,26,40,22,4,26,6,18,13,4,4,20,3,3,7,12,17,8,9,
  23,6,20,7,25,23,19,5,15,6,23,15,11,19,11,3,17,59,8,18,41,4,54,23,44,75,13,
  20,6,11,2,3,1,13,10,3,7,12,3,4,7,8,30,6,6,7,3,32,9,5,28,6,114,42,13,36,27,
  59,6,93,13,74,8,69,140,3,1,17,48,105,6,11,5,15,1,10,10,14,8,53,0,8,24,60,2,
  6,35,2,12,32,47,16,17,75,2,5,4,37,28,10,5,9,57,4,59,5,12,13,7,90,5,11,5,24,
  22,13,30,1,2,10,9,6,19,3,18,47,2,5,7,9,35,15,3,6,1,21,14,14,18,14,9,12,8,73,
  6,19,3,32,9,14,17,17,5,55,23,6,16,28,3,11,48,4,6,6,6,12,16,30,10,30,27,51,
  18,29,2,3,15,1,76,0,16,33,4,27,3,62,4,10,2,4,8,15,9,41,26,22,2,4,20,4,49,0,
  8,1,57,13,12,39,3,63,10,19,34,35,2,7,8,29,72,4,10,0,77,8,6,7,9,15,21,9,4,1,
  20,23,1,9,18,9,15,36,4,7,6,15,5,7,7,40,2,9,22,2,3,20,4,12,34,13,6,18,15,1,
  38,20,12,7,16,3,19,85,12,16,18,16,2,17,1,13,8,6,12,15,97,17,12,9,3,21,15,12,
  23,44,81,26,30,2,5,17,6,6,0,22,42,19,6,19,41,14,36,7,3,56,7,9,3,2,6,9,69,3,
  15,4,30,28,29,7,9,15,17,17,6,1,6,153,9,33,5,12,14,16,28,3,8,7,14,12,4,6,36,
  9,24,13,13,4,2,9,15,19,9,53,7,13,4,150,17,9,2,6,12,7,3,5,58,19,58,28,8,14,3,
  20,3,0,32,56,7,5,4,27,1,68,4,29,13,5,58,2,9,65,41,27,16,15,12,14,2,10,9,24,
  3,2,9,2,2,3,14,32,10,22,3,13,11,4,6,39,17,0,10,5,5,10,35,16,19,14,1,8,63,19,
  14,8,56,10,2,12,6,12,6,7,16,2,9,9,12,20,73,25,13,21,17,24,5,32,8,12,25,8,14,
  16,5,23,3,7,6,3,11,24,6,30,4,21,13,28,4,6,29,15,5,17,6,26,8,15,8,3,7,7,50,
  11,30,6,2,28,56,16,24,25,23,24,89,31,31,12,7,22,4,10,17,3,3,8,11,13,5,3,27,
  1,12,1,14,8,10,29,2,5,2,2,20,10,0,31,10,21,1,48,3,5,43,4,5,18,13,5,18,25,34,
  18,3,5,22,16,3,4,20,3,9,3,25,6,6,44,21,3,12,7,5,42,3,2,14,4,36,5,3,45,51,15,
  9,11,28,9,7,6,6,12,26,5,14,10,11,42,55,13,21,4,28,6,7,23,27,11,1,41,36,0,32,
  15,26,2,3,23,32,11,2,15,7,29,26,144,33,20,12,7,21,10,7,11,65,46,10,13,20,32,
  4,4,5,19,2,19,15,49,41,1,75,10,11,25,1,2,45,11,8,27,18,10,60,28,29,12,30,19,
  16,4,24,11,19,27,17,49,18,7,40,13,19,22,8,55,12,11,3,6,5,11,8,10,22,5,9,9,
  25,7,17,7,64,1,24,2,12,17,44,4,12,27,21,11,10,7,47,5,9,13,12,38,27,21,7,29,
  7,1,17,3,3,5,48,62,10,3,11,17,15,15,6,3,8,10,8,18,19,13,3,9,7,6,44,9,10,4,
  43,8,6,6,14,20,38,24,2,4,5,5,7,5,9,39,8,44,40,9,19,7,3,15,25,2,37,18,15,9,5,
  8,32,10,5,18,4,7,46,20,17,23,4,11,16,18,31,11,3,11,1,14,1,25,4,27,13,13,39,
  14,6,6,35,6,16,13,11,122,21,15,20,24,10,5,152,15,39,5,20,16,9,14,7,53,6,3,8,
  19,63,32,6,2,3,20,1,19,5,13,42,15,4,6,68,31,46,11,38,10,24,5,5,8,9,12,3,35,
  46,26,16,2,8,4,74,16,44,4,5,1,16,4,14,23,16,69,15,42,31,14,7,7,6,97,14,40,1,
  8,7,34,9,39,19,13,15,10,21,18,10,5,15,38,7,5,12,7,20,15,4,11,6,14,5,17,7,39,
  35,36,18,20,26,22,4,2,36,21,64,0,5,9,10,6,4,1,7,3,1,3,3,4,10,20,90,2,22,48,
  16,23,2,33,40,1,21,21,17,20,8,8,12,4,83,14,48,4,21,3,9,27,5,11,40,15,9,3,16,
  17,9,11,4,24,31,17,3,4,2,11,1,8,4,8,6,41,17,4,13,3,7,17,8,27,5,13,6,10,7,13,
  12,18,13,60,18,3,8,1,12,125,2,7,16,2,11,2,4,7,26,5,9,14,14,16,8,14,7,14,6,9,
  13,9,6,4,26,35,49,36,55,3,9,6,40,26,23,31,19,41,2,10,31,6,54,5,69,16,7,8,16,
  1,5,7,4,22,7,7,5,4,48,11,13,3,98,4,11,19,4,2,14,7,34,7,10,3,2,12,7,6,2,5,118
 },
};

uint8_t data[1<<15];
string data_str;
void init_data() {
  static bool initted = false;
  if (initted) return;
  initted = true;

  // Repeatability.  Kind of.
  std::srand(42);
  for (size_t i = 0; i < (sizeof(data)/sizeof(data[0])); ++i) {
    data[i] = (uint8_t)rand();
  }

  data_str.assign((char*)data, sizeof(data));
}


BOOST_AUTO_TEST_SUITE( TBufferBaseTest )

BOOST_AUTO_TEST_CASE( test_MemoryBuffer_Write_GetBuffer ) {
  init_data();

  for (int d1 = 0; d1 < 3; d1++) {
    TMemoryBuffer buffer(16);
    int offset = 0;
    int index = 0;

    while (offset < 1<<15) {
      buffer.write(&data[offset], dist[d1][index]);
      offset += dist[d1][index];
      index++;
    }

    string output = buffer.getBufferAsString();
    BOOST_CHECK_EQUAL(data_str, output);
  }
}

BOOST_AUTO_TEST_CASE( test_MemoryBuffer_Write_Read ) {
  init_data();

  for (int d1 = 0; d1 < 3; d1++) {
    for (int d2 = 0; d2 < 3; d2++) {
      TMemoryBuffer buffer(16);
      uint8_t data_out[1<<15];
      int offset;
      int index;

      offset = 0;
      index = 0;
      while (offset < 1<<15) {
        buffer.write(&data[offset], dist[d1][index]);
        offset += dist[d1][index];
        index++;
      }

      offset = 0;
      index = 0;
      while (offset < 1<<15) {
        unsigned int got = buffer.read(&data_out[offset], dist[d2][index]);
        BOOST_CHECK_EQUAL(got, dist[d2][index]);
        offset += dist[d2][index];
        index++;
      }

      BOOST_CHECK(!memcmp(data, data_out, sizeof(data)));
    }
  }
}

BOOST_AUTO_TEST_CASE( test_MemoryBuffer_Write_ReadString ) {
  init_data();

  for (int d1 = 0; d1 < 3; d1++) {
    for (int d2 = 0; d2 < 3; d2++) {
      TMemoryBuffer buffer(16);
      string output;
      int offset;
      int index;

      offset = 0;
      index = 0;
      while (offset < 1<<15) {
        buffer.write(&data[offset], dist[d1][index]);
        offset += dist[d1][index];
        index++;
      }

      offset = 0;
      index = 0;
      while (offset < 1<<15) {
        unsigned int got = buffer.readAppendToString(output, dist[d2][index]);
        BOOST_CHECK_EQUAL(got, dist[d2][index]);
        offset += dist[d2][index];
        index++;
      }

      BOOST_CHECK_EQUAL(output, data_str);
    }
  }
}

BOOST_AUTO_TEST_CASE( test_MemoryBuffer_Write_Read_Multi1 ) {
  init_data();

  // Do shorter writes and reads so we don't align to power-of-two boundaries.

  for (int d1 = 0; d1 < 3; d1++) {
    for (int d2 = 0; d2 < 3; d2++) {
      TMemoryBuffer buffer(16);
      uint8_t data_out[1<<15];
      int offset;
      int index;

      for (int iter = 0; iter < 6; iter++) {
        offset = 0;
        index = 0;
        while (offset < (1<<15)-42) {
          buffer.write(&data[offset], dist[d1][index]);
          offset += dist[d1][index];
          index++;
        }

        offset = 0;
        index = 0;
        while (offset < (1<<15)-42) {
          buffer.read(&data_out[offset], dist[d2][index]);
          offset += dist[d2][index];
          index++;
        }

        BOOST_CHECK(!memcmp(data, data_out, (1<<15)-42));

        // Pull out the extra data.
        buffer.read(data_out, 42);
      }
    }
  }
}

BOOST_AUTO_TEST_CASE( test_MemoryBuffer_Write_Read_Multi2 ) {
  init_data();

  // Do shorter writes and reads so we don't align to power-of-two boundaries.
  // Pull the buffer out of the loop so its state gets worked harder.
  TMemoryBuffer buffer(16);

  for (int d1 = 0; d1 < 3; d1++) {
    for (int d2 = 0; d2 < 3; d2++) {
      uint8_t data_out[1<<15];
      int offset;
      int index;

      for (int iter = 0; iter < 6; iter++) {
        offset = 0;
        index = 0;
        while (offset < (1<<15)-42) {
          buffer.write(&data[offset], dist[d1][index]);
          offset += dist[d1][index];
          index++;
        }

        offset = 0;
        index = 0;
        while (offset < (1<<15)-42) {
          buffer.read(&data_out[offset], dist[d2][index]);
          offset += dist[d2][index];
          index++;
        }

        BOOST_CHECK(!memcmp(data, data_out, (1<<15)-42));

        // Pull out the extra data.
        buffer.read(data_out, 42);
      }
    }
  }
}

BOOST_AUTO_TEST_CASE( test_MemoryBuffer_Write_Read_Incomplete ) {
  init_data();

  // Do shorter writes and reads so we don't align to power-of-two boundaries.
  // Pull the buffer out of the loop so its state gets worked harder.

  for (int d1 = 0; d1 < 3; d1++) {
    for (int d2 = 0; d2 < 3; d2++) {
      TMemoryBuffer buffer(16);
      uint8_t data_out[1<<13];

      int write_offset = 0;
      int write_index = 0;
      unsigned int to_write = (1<<14)-42;
      while (to_write > 0) {
        int write_amt = (std::min)(dist[d1][write_index], to_write);
        buffer.write(&data[write_offset], write_amt);
        write_offset += write_amt;
        write_index++;
        to_write -= write_amt;
      }

      int read_offset = 0;
      int read_index = 0;
      unsigned int to_read = (1<<13)-42;
      while (to_read > 0) {
        int read_amt = (std::min)(dist[d2][read_index], to_read);
        int got = buffer.read(&data_out[read_offset], read_amt);
        BOOST_CHECK_EQUAL(got, read_amt);
        read_offset += read_amt;
        read_index++;
        to_read -= read_amt;
      }

      BOOST_CHECK(!memcmp(data, data_out, (1<<13)-42));

      int second_offset = write_offset;
      int second_index = write_index-1;
      unsigned int to_second = (1<<14)+42;
      while (to_second > 0) {
        int second_amt = (std::min)(dist[d1][second_index], to_second);
        //printf("%d\n", second_amt);
        buffer.write(&data[second_offset], second_amt);
        second_offset += second_amt;
        second_index++;
        to_second -= second_amt;
      }

      string output = buffer.getBufferAsString();
      BOOST_CHECK_EQUAL(data_str.substr((1<<13)-42), output);
    }
  }
}

BOOST_AUTO_TEST_CASE( test_BufferedTransport_Write ) {
  init_data();

  int sizes[] = {
    12, 15, 16, 17, 20,
    501, 512, 523,
    2000, 2048, 2096,
    1<<14, 1<<17,
  };

  for (size_t i = 0; i < sizeof (sizes) / sizeof (sizes[0]); i++) {
    int size = sizes[i];
    for (int d1 = 0; d1 < 3; d1++) {
      shared_ptr<TMemoryBuffer> buffer(new TMemoryBuffer(16));
      TBufferedTransport trans(buffer, size);

      int offset = 0;
      int index = 0;
      while (offset < 1<<15) {
        trans.write(&data[offset], dist[d1][index]);
        offset += dist[d1][index];
        index++;
      }
      trans.flush();

      string output = buffer->getBufferAsString();
      BOOST_CHECK_EQUAL(data_str, output);
    }
  }
}

BOOST_AUTO_TEST_CASE( test_BufferedTransport_Read_Full ) {
  init_data();

  int sizes[] = {
    12, 15, 16, 17, 20,
    501, 512, 523,
    2000, 2048, 2096,
    1<<14, 1<<17,
  };

  for (size_t i = 0; i < sizeof (sizes) / sizeof (sizes[0]); i++) {
    int size = sizes[i];
    for (int d1 = 0; d1 < 3; d1++) {
      shared_ptr<TMemoryBuffer> buffer(new TMemoryBuffer(data, sizeof(data)));
      TBufferedTransport trans(buffer, size);
      uint8_t data_out[1<<15];

      int offset = 0;
      int index = 0;
      while (offset < 1<<15) {
        // Note: this doesn't work with "read" because TBufferedTransport
        // doesn't try loop over reads, so we get short reads.  We don't
        // check the return value, so that messes us up.
        trans.readAll(&data_out[offset], dist[d1][index]);
        offset += dist[d1][index];
        index++;
      }

      BOOST_CHECK(!memcmp(data, data_out, sizeof(data)));
    }
  }
}

BOOST_AUTO_TEST_CASE( test_BufferedTransport_Read_Short ) {
  init_data();

  int sizes[] = {
    12, 15, 16, 17, 20,
    501, 512, 523,
    2000, 2048, 2096,
    1<<14, 1<<17,
  };

  for (size_t i = 0; i < sizeof (sizes) / sizeof (sizes[0]); i++) {
    int size = sizes[i];
    for (int d1 = 0; d1 < 3; d1++) {
      shared_ptr<TMemoryBuffer> buffer(new TMemoryBuffer(data, sizeof(data)));
      shared_ptr<TShortReadTransport> tshort(new TShortReadTransport(buffer, 0.125));
      TBufferedTransport trans(buffer, size);
      uint8_t data_out[1<<15];

      int offset = 0;
      int index = 0;
      while (offset < 1<<15) {
        // Note: this doesn't work with "read" because TBufferedTransport
        // doesn't try loop over reads, so we get short reads.  We don't
        // check the return value, so that messes us up.
        trans.readAll(&data_out[offset], dist[d1][index]);
        offset += dist[d1][index];
        index++;
      }

      BOOST_CHECK(!memcmp(data, data_out, sizeof(data)));
    }
  }
}

BOOST_AUTO_TEST_CASE( test_FramedTransport_Write ) {
  init_data();

  int sizes[] = {
    12, 15, 16, 17, 20,
    501, 512, 523,
    2000, 2048, 2096,
    1<<14, 1<<17,
  };

  for (size_t i = 0; i < sizeof (sizes) / sizeof (sizes[0]); i++) {
    int size = sizes[i];
    for (int d1 = 0; d1 < 3; d1++) {
      shared_ptr<TMemoryBuffer> buffer(new TMemoryBuffer(16));
      TFramedTransport trans(buffer, size);

      int offset = 0;
      int index = 0;
      while (offset < 1<<15) {
        trans.write(&data[offset], dist[d1][index]);
        offset += dist[d1][index];
        index++;
      }
      trans.flush();

      int32_t frame_size = -1;
      buffer->read(reinterpret_cast<uint8_t*>(&frame_size), sizeof(frame_size));
      frame_size = (int32_t)ntohl((uint32_t)frame_size);
      BOOST_CHECK_EQUAL(frame_size, 1<<15);
      BOOST_CHECK_EQUAL(data_str.size(), (unsigned int)frame_size);
      string output = buffer->getBufferAsString();
      BOOST_CHECK_EQUAL(data_str, output);
    }
  }
}

BOOST_AUTO_TEST_CASE( test_FramedTransport_Read ) {
  init_data();

  for (int d1 = 0; d1 < 3; d1++) {
    uint8_t data_out[1<<15];
    shared_ptr<TMemoryBuffer> buffer(new TMemoryBuffer());
    TFramedTransport trans(buffer);
    int32_t length = sizeof(data);
    length = (int32_t)htonl((uint32_t)length);
    buffer->write(reinterpret_cast<uint8_t*>(&length), sizeof(length));
    buffer->write(data, sizeof(data));

    int offset = 0;
    int index = 0;
    while (offset < 1<<15) {
      // This should work with read because we have one huge frame.
      trans.read(&data_out[offset], dist[d1][index]);
      offset += dist[d1][index];
      index++;
    }

    BOOST_CHECK(!memcmp(data, data_out, sizeof(data)));
  }
}

BOOST_AUTO_TEST_CASE( test_FramedTransport_Write_Read ) {
  init_data();

  int sizes[] = {
    12, 15, 16, 17, 20,
    501, 512, 523,
    2000, 2048, 2096,
    1<<14, 1<<17,
  };

  int probs[] = { 1, 2, 4, 8, 16, 32, };

  for (size_t i = 0; i < sizeof (sizes) / sizeof (sizes[0]); i++) {
    int size = sizes[i];
    for (size_t j = 0; j < sizeof (probs) / sizeof (probs[0]); j++) {
      int prob = probs[j];
      for (int d1 = 0; d1 < 3; d1++) {
        shared_ptr<TMemoryBuffer> buffer(new TMemoryBuffer(16));
        TFramedTransport trans(buffer, size);
        uint8_t data_out[1<<15];
        std::vector<int> flush_sizes;

        int write_offset = 0;
        int write_index = 0;
        int flush_size = 0;
        while (write_offset < 1<<15) {
          trans.write(&data[write_offset], dist[d1][write_index]);
          write_offset += dist[d1][write_index];
          flush_size += dist[d1][write_index];
          write_index++;
          if (flush_size > 0 && rand()%prob == 0) {
            flush_sizes.push_back(flush_size);
            flush_size = 0;
            trans.flush();
          }
        }
        if (flush_size != 0) {
          flush_sizes.push_back(flush_size);
          flush_size = 0;
          trans.flush();
        }

        int read_offset = 0;
        int read_index = 0;

        for (unsigned int k = 0; k < flush_sizes.size(); k++) {
          int fsize = flush_sizes[k];
          // We are exploiting an implementation detail of TFramedTransport.
          // The read buffer starts empty and it will never do more than one
          // readFrame per read, so we should always get exactly one frame.
          int got = trans.read(&data_out[read_offset], 1<<15);
          BOOST_CHECK_EQUAL(got, fsize);
          read_offset += got;
          read_index++;
        }

        BOOST_CHECK_EQUAL((unsigned int)read_offset, sizeof(data));
        BOOST_CHECK(!memcmp(data, data_out, sizeof(data)));
      }
    }
  }
}

BOOST_AUTO_TEST_CASE( test_FramedTransport_Empty_Flush ) {
  init_data();

  string output1("\x00\x00\x00\x01""a", 5);
  string output2("\x00\x00\x00\x01""a\x00\x00\x00\x02""bc", 11);

  shared_ptr<TMemoryBuffer> buffer(new TMemoryBuffer());
  TFramedTransport trans(buffer);

  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), "");
  trans.flush();
  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), "");
  trans.flush();
  trans.flush();
  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), "");
  trans.write((const uint8_t*)"a", 1);
  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), "");
  trans.flush();
  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), output1);
  trans.flush();
  trans.flush();
  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), output1);
  trans.write((const uint8_t*)"bc", 2);
  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), output1);
  trans.flush();
  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), output2);
  trans.flush();
  trans.flush();
  BOOST_CHECK_EQUAL(buffer->getBufferAsString(), output2);
}

BOOST_AUTO_TEST_SUITE_END()

