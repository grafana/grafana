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

#ifdef HAVE_CONFIG_H
#include <config.h>
#endif
#include <iostream>
#define _USE_MATH_DEFINES
#include <math.h>
#include "thrift/transport/TBufferTransports.h"
#include "thrift/protocol/TBinaryProtocol.h"
#include "gen-cpp/DebugProtoTest_types.h"

#ifdef HAVE_SYS_TIME_H
#include <sys/time.h>
#endif

class Timer {
public:
  timeval vStart;

  Timer() { THRIFT_GETTIMEOFDAY(&vStart, 0); }
  void start() { THRIFT_GETTIMEOFDAY(&vStart, 0); }

  double frame() {
    timeval vEnd;
    THRIFT_GETTIMEOFDAY(&vEnd, 0);
    double dstart = vStart.tv_sec + ((double)vStart.tv_usec / 1000000.0);
    double dend = vEnd.tv_sec + ((double)vEnd.tv_usec / 1000000.0);
    return dend - dstart;
  }
};

int main() {
  using namespace std;
  using namespace thrift::test::debug;
  using namespace apache::thrift::transport;
  using namespace apache::thrift::protocol;
  using namespace boost;

  OneOfEach ooe;
  ooe.im_true = true;
  ooe.im_false = false;
  ooe.a_bite = 0x7f;
  ooe.integer16 = 27000;
  ooe.integer32 = 1 << 24;
  ooe.integer64 = (uint64_t)6000 * 1000 * 1000;
  ooe.double_precision = M_PI;
  ooe.some_characters = "JSON THIS! \"\1";
  ooe.zomg_unicode = "\xd7\n\a\t";
  ooe.base64 = "\1\2\3\255";

  int num = 100000;
  boost::shared_ptr<TMemoryBuffer> buf(new TMemoryBuffer(num*1000));

  uint8_t* data = NULL;
  uint32_t datasize = 0;

  {
    buf->resetBuffer();
    TBinaryProtocolT<TMemoryBuffer> prot(buf);
    double elapsed = 0.0;
    Timer timer;

    for (int i = 0; i < num; i++) {
      ooe.write(&prot);
    }
    elapsed = timer.frame();
    cout << "Write big endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  buf->getBuffer(&data, &datasize);

  {
    boost::shared_ptr<TMemoryBuffer> buf2(new TMemoryBuffer(data, datasize));
    TBinaryProtocolT<TMemoryBuffer> prot(buf2);
    OneOfEach ooe2;
    double elapsed = 0.0;
    Timer timer;

    for (int i = 0; i < num; i++) {
      ooe2.read(&prot);
    }
    elapsed = timer.frame();
    cout << " Read big endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  {
    buf->resetBuffer();
    TBinaryProtocolT<TMemoryBuffer, TNetworkLittleEndian> prot(buf);
    double elapsed = 0.0;
    Timer timer;

    for (int i = 0; i < num; i++) {
      ooe.write(&prot);
    }
    elapsed = timer.frame();
    cout << "Write little endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  {
    OneOfEach ooe2;
    boost::shared_ptr<TMemoryBuffer> buf2(new TMemoryBuffer(data, datasize));
    TBinaryProtocolT<TMemoryBuffer, TNetworkLittleEndian> prot(buf2);
    double elapsed = 0.0;
    Timer timer;

    for (int i = 0; i < num; i++) {
      ooe2.read(&prot);
    }
    elapsed = timer.frame();
    cout << " Read little endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  {
    buf->resetBuffer();
    TBinaryProtocolT<TMemoryBuffer> prot(buf);
    double elapsed = 0.0;
    Timer timer;

    for (int i = 0; i < num; i++) {
      ooe.write(&prot);
    }
    elapsed = timer.frame();
    cout << "Write big endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  {
    boost::shared_ptr<TMemoryBuffer> buf2(new TMemoryBuffer(data, datasize));
    TBinaryProtocolT<TMemoryBuffer> prot(buf2);
    OneOfEach ooe2;
    double elapsed = 0.0;
    Timer timer;

    for (int i = 0; i < num; i++) {
      ooe2.read(&prot);
    }
    elapsed = timer.frame();
    cout << " Read big endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }


  data = NULL;
  datasize = 0;
  num = 10000000;

  ListDoublePerf listDoublePerf;
  listDoublePerf.field.reserve(num);
  for (int x = 0; x < num; ++x)
    listDoublePerf.field.push_back(double(x));

  buf.reset(new TMemoryBuffer(num * 100));

  {
    buf->resetBuffer();
    TBinaryProtocolT<TMemoryBuffer> prot(buf);
    double elapsed = 0.0;
    Timer timer;

    listDoublePerf.write(&prot);
    elapsed = timer.frame();
    cout << "Double write big endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  buf->getBuffer(&data, &datasize);

  {
    boost::shared_ptr<TMemoryBuffer> buf2(new TMemoryBuffer(data, datasize));
    TBinaryProtocolT<TMemoryBuffer> prot(buf2);
    ListDoublePerf listDoublePerf2;
    double elapsed = 0.0;
    Timer timer;

    listDoublePerf2.read(&prot);
    elapsed = timer.frame();
    cout << " Double read big endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  {
    buf->resetBuffer();
    TBinaryProtocolT<TMemoryBuffer, TNetworkLittleEndian> prot(buf);
    double elapsed = 0.0;
    Timer timer;

    listDoublePerf.write(&prot);
    elapsed = timer.frame();
    cout << "Double write little endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  {
    ListDoublePerf listDoublePerf2;
    boost::shared_ptr<TMemoryBuffer> buf2(new TMemoryBuffer(data, datasize));
    TBinaryProtocolT<TMemoryBuffer, TNetworkLittleEndian> prot(buf2);
    double elapsed = 0.0;
    Timer timer;

    listDoublePerf2.read(&prot);
    elapsed = timer.frame();
    cout << " Double read little endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  {
    buf->resetBuffer();
    TBinaryProtocolT<TMemoryBuffer> prot(buf);
    double elapsed = 0.0;
    Timer timer;

    listDoublePerf.write(&prot);
    elapsed = timer.frame();
    cout << "Double write big endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }

  {
    boost::shared_ptr<TMemoryBuffer> buf2(new TMemoryBuffer(data, datasize));
    TBinaryProtocolT<TMemoryBuffer> prot(buf2);
    ListDoublePerf listDoublePerf2;
    double elapsed = 0.0;
    Timer timer;

    listDoublePerf2.read(&prot);
    elapsed = timer.frame();
    cout << " Double read big endian: " << num / (1000 * elapsed) << " kHz" << endl;
  }


  return 0;
}
