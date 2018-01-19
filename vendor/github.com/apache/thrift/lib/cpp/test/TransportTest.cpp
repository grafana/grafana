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

#include <thrift/thrift-config.h>

#include <stdlib.h>
#include <time.h>
#ifdef HAVE_SYS_SOCKET_H
#include <sys/socket.h>
#endif
#include <sstream>
#include <fstream>
#include <thrift/cxxfunctional.h>

#include <boost/mpl/list.hpp>
#include <boost/shared_array.hpp>
#include <boost/random.hpp>
#include <boost/type_traits.hpp>
#include <boost/test/unit_test.hpp>
#include <boost/version.hpp>

#include <thrift/transport/TBufferTransports.h>
#include <thrift/transport/TFDTransport.h>
#include <thrift/transport/TFileTransport.h>
#include <thrift/transport/TZlibTransport.h>
#include <thrift/transport/TSocket.h>

#include <thrift/concurrency/FunctionRunner.h>
#if _WIN32
#include <thrift/windows/TWinsockSingleton.h>
#endif

using namespace apache::thrift::transport;

static boost::mt19937 rng;

void initrand(unsigned int seed) {
  rng.seed(seed);
}

class SizeGenerator {
public:
  virtual ~SizeGenerator() {}
  virtual uint32_t nextSize() = 0;
  virtual std::string describe() const = 0;
};

class ConstantSizeGenerator : public SizeGenerator {
public:
  ConstantSizeGenerator(uint32_t value) : value_(value) {}
  uint32_t nextSize() { return value_; }
  std::string describe() const {
    std::ostringstream desc;
    desc << value_;
    return desc.str();
  }

private:
  uint32_t value_;
};

class RandomSizeGenerator : public SizeGenerator {
public:
  RandomSizeGenerator(uint32_t min, uint32_t max)
    : generator_(rng, boost::uniform_int<int>(min, max)) {}

  uint32_t nextSize() { return generator_(); }

  std::string describe() const {
    std::ostringstream desc;
    desc << "rand(" << getMin() << ", " << getMax() << ")";
    return desc.str();
  }

  uint32_t getMin() const { return (generator_.distribution().min)(); }
  uint32_t getMax() const { return (generator_.distribution().max)(); }

private:
  boost::variate_generator<boost::mt19937&, boost::uniform_int<int> > generator_;
};

/**
 * This class exists solely to make the TEST_RW() macro easier to use.
 * - it can be constructed implicitly from an integer
 * - it can contain either a ConstantSizeGenerator or a RandomSizeGenerator
 *   (TEST_RW can't take a SizeGenerator pointer or reference, since it needs
 *   to make a copy of the generator to bind it to the test function.)
 */
class GenericSizeGenerator : public SizeGenerator {
public:
  GenericSizeGenerator(uint32_t value) : generator_(new ConstantSizeGenerator(value)) {}
  GenericSizeGenerator(uint32_t min, uint32_t max)
    : generator_(new RandomSizeGenerator(min, max)) {}

  uint32_t nextSize() { return generator_->nextSize(); }
  std::string describe() const { return generator_->describe(); }

private:
  boost::shared_ptr<SizeGenerator> generator_;
};

/**************************************************************************
 * Classes to set up coupled transports
 **************************************************************************/

/**
 * Helper class to represent a coupled pair of transports.
 *
 * Data written to the out transport can be read from the in transport.
 *
 * This is used as the base class for the various coupled transport
 * implementations.  It shouldn't be instantiated directly.
 */
template <class Transport_>
class CoupledTransports {
public:
  virtual ~CoupledTransports() {}
  typedef Transport_ TransportType;

  CoupledTransports() : in(), out() {}

  boost::shared_ptr<Transport_> in;
  boost::shared_ptr<Transport_> out;

private:
  CoupledTransports(const CoupledTransports&);
  CoupledTransports& operator=(const CoupledTransports&);
};

/**
 * Coupled TMemoryBuffers
 */
class CoupledMemoryBuffers : public CoupledTransports<TMemoryBuffer> {
public:
  CoupledMemoryBuffers() : buf(new TMemoryBuffer) {
    in = buf;
    out = buf;
  }

  boost::shared_ptr<TMemoryBuffer> buf;
};

/**
 * Helper template class for creating coupled transports that wrap
 * another transport.
 */
template <class WrapperTransport_, class InnerCoupledTransports_>
class CoupledWrapperTransportsT : public CoupledTransports<WrapperTransport_> {
public:
  CoupledWrapperTransportsT() {
    if (inner_.in) {
      this->in.reset(new WrapperTransport_(inner_.in));
    }
    if (inner_.out) {
      this->out.reset(new WrapperTransport_(inner_.out));
    }
  }

  InnerCoupledTransports_ inner_;
};

/**
 * Coupled TBufferedTransports.
 */
template <class InnerTransport_>
class CoupledBufferedTransportsT
    : public CoupledWrapperTransportsT<TBufferedTransport, InnerTransport_> {};

typedef CoupledBufferedTransportsT<CoupledMemoryBuffers> CoupledBufferedTransports;

/**
 * Coupled TFramedTransports.
 */
template <class InnerTransport_>
class CoupledFramedTransportsT
    : public CoupledWrapperTransportsT<TFramedTransport, InnerTransport_> {};

typedef CoupledFramedTransportsT<CoupledMemoryBuffers> CoupledFramedTransports;

/**
 * Coupled TZlibTransports.
 */
template <class InnerTransport_>
class CoupledZlibTransportsT : public CoupledWrapperTransportsT<TZlibTransport, InnerTransport_> {};

typedef CoupledZlibTransportsT<CoupledMemoryBuffers> CoupledZlibTransports;

#ifndef _WIN32
// FD transport doesn't make much sense on Windows.
/**
 * Coupled TFDTransports.
 */
class CoupledFDTransports : public CoupledTransports<TFDTransport> {
public:
  CoupledFDTransports() {
    int pipes[2];

    if (pipe(pipes) != 0) {
      return;
    }

    in.reset(new TFDTransport(pipes[0], TFDTransport::CLOSE_ON_DESTROY));
    out.reset(new TFDTransport(pipes[1], TFDTransport::CLOSE_ON_DESTROY));
  }
};
#endif

/**
 * Coupled TSockets
 */
class CoupledSocketTransports : public CoupledTransports<TSocket> {
public:
  CoupledSocketTransports() {
    THRIFT_SOCKET sockets[2] = {0};
    if (THRIFT_SOCKETPAIR(PF_UNIX, SOCK_STREAM, 0, sockets) != 0) {
      return;
    }

    in.reset(new TSocket(sockets[0]));
    out.reset(new TSocket(sockets[1]));
    out->setSendTimeout(100);
  }
};

// These could be made to work on Windows, but I don't care enough to make it happen
#ifndef _WIN32
/**
 * Coupled TFileTransports
 */
class CoupledFileTransports : public CoupledTransports<TFileTransport> {
public:
  CoupledFileTransports() {
#ifndef _WIN32
    const char* tmp_dir = "/tmp";
#define FILENAME_SUFFIX "/thrift.transport_test"
#else
    const char* tmp_dir = getenv("TMP");
#define FILENAME_SUFFIX "\\thrift.transport_test"
#endif

    // Create a temporary file to use
    filename.resize(strlen(tmp_dir) + strlen(FILENAME_SUFFIX));
    THRIFT_SNPRINTF(&filename[0], filename.size(), "%s" FILENAME_SUFFIX, tmp_dir);
#undef FILENAME_SUFFIX

    { std::ofstream dummy_creation(filename.c_str(), std::ofstream::trunc); }

    in.reset(new TFileTransport(filename, true));
    out.reset(new TFileTransport(filename));
  }

  ~CoupledFileTransports() { remove(filename.c_str()); }

  std::string filename;
};
#endif

/**
 * Wrapper around another CoupledTransports implementation that exposes the
 * transports as TTransport pointers.
 *
 * This is used since accessing a transport via a "TTransport*" exercises a
 * different code path than using the base pointer class.  As part of the
 * template code changes, most transport methods are no longer virtual.
 */
template <class CoupledTransports_>
class CoupledTTransports : public CoupledTransports<TTransport> {
public:
  CoupledTTransports() : transports() {
    in = transports.in;
    out = transports.out;
  }

  CoupledTransports_ transports;
};

/**
 * Wrapper around another CoupledTransports implementation that exposes the
 * transports as TBufferBase pointers.
 *
 * This can only be instantiated with a transport type that is a subclass of
 * TBufferBase.
 */
template <class CoupledTransports_>
class CoupledBufferBases : public CoupledTransports<TBufferBase> {
public:
  CoupledBufferBases() : transports() {
    in = transports.in;
    out = transports.out;
  }

  CoupledTransports_ transports;
};

/**************************************************************************
 * Alarm handling code for use in tests that check the transport blocking
 * semantics.
 *
 * If the transport ends up blocking, we don't want to hang forever.  We use
 * SIGALRM to fire schedule signal to wake up and try to write data so the
 * transport will unblock.
 *
 * It isn't really the safest thing in the world to be mucking around with
 * complicated global data structures in a signal handler.  It should probably
 * be okay though, since we know the main thread should always be blocked in a
 * read() request when the signal handler is running.
 **************************************************************************/

struct TriggerInfo {
  TriggerInfo(int seconds, const boost::shared_ptr<TTransport>& transport, uint32_t writeLength)
    : timeoutSeconds(seconds), transport(transport), writeLength(writeLength), next(NULL) {}

  int timeoutSeconds;
  boost::shared_ptr<TTransport> transport;
  uint32_t writeLength;
  TriggerInfo* next;
};

apache::thrift::concurrency::Monitor g_alarm_monitor;
TriggerInfo* g_triggerInfo;
unsigned int g_numTriggersFired;
bool g_teardown = false;

void alarm_handler() {
  TriggerInfo* info = NULL;
  {
    apache::thrift::concurrency::Synchronized s(g_alarm_monitor);
    // The alarm timed out, which almost certainly means we're stuck
    // on a transport that is incorrectly blocked.
    ++g_numTriggersFired;

    // Note: we print messages to stdout instead of stderr, since
    // tools/test/runner only records stdout messages in the failure messages for
    // boost tests.  (boost prints its test info to stdout.)
    printf("Timeout alarm expired; attempting to unblock transport\n");
    if (g_triggerInfo == NULL) {
      printf("  trigger stack is empty!\n");
    }

    // Pop off the first TriggerInfo.
    // If there is another one, schedule an alarm for it.
    info = g_triggerInfo;
    g_triggerInfo = info->next;
  }

  // Write some data to the transport to hopefully unblock it.
  uint8_t* buf = new uint8_t[info->writeLength];
  memset(buf, 'b', info->writeLength);
  boost::scoped_array<uint8_t> array(buf);
  info->transport->write(buf, info->writeLength);
  info->transport->flush();

  delete info;
}

void alarm_handler_wrapper() {
  int64_t timeout = 0; // timeout of 0 means wait forever
  while (true) {
    bool fireHandler = false;
    {
      apache::thrift::concurrency::Synchronized s(g_alarm_monitor);
      if (g_teardown)
        return;
      // calculate timeout
      if (g_triggerInfo == NULL) {
        timeout = 0;
      } else {
        timeout = g_triggerInfo->timeoutSeconds * 1000;
      }

      int waitResult = g_alarm_monitor.waitForTimeRelative(timeout);
      if (waitResult == THRIFT_ETIMEDOUT)
        fireHandler = true;
    }
    if (fireHandler)
      alarm_handler(); // calling outside the lock
  }
}

/**
 * Add a trigger to be scheduled "seconds" seconds after the
 * last currently scheduled trigger.
 *
 * (Note that this is not "seconds" from now.  That might be more logical, but
 * would require slightly more complicated sorting, rather than just appending
 * to the end.)
 */
void add_trigger(unsigned int seconds,
                 const boost::shared_ptr<TTransport>& transport,
                 uint32_t write_len) {
  TriggerInfo* info = new TriggerInfo(seconds, transport, write_len);
  {
    apache::thrift::concurrency::Synchronized s(g_alarm_monitor);
    if (g_triggerInfo == NULL) {
      // This is the first trigger.
      // Set g_triggerInfo, and schedule the alarm
      g_triggerInfo = info;
      g_alarm_monitor.notify();
    } else {
      // Add this trigger to the end of the list
      TriggerInfo* prev = g_triggerInfo;
      while (prev->next) {
        prev = prev->next;
      }
      prev->next = info;
    }
  }
}

void clear_triggers() {
  TriggerInfo* info = NULL;

  {
    apache::thrift::concurrency::Synchronized s(g_alarm_monitor);
    info = g_triggerInfo;
    g_triggerInfo = NULL;
    g_numTriggersFired = 0;
    g_alarm_monitor.notify();
  }

  while (info != NULL) {
    TriggerInfo* next = info->next;
    delete info;
    info = next;
  }
}

void set_trigger(unsigned int seconds,
                 const boost::shared_ptr<TTransport>& transport,
                 uint32_t write_len) {
  clear_triggers();
  add_trigger(seconds, transport, write_len);
}

/**************************************************************************
 * Test functions
 **************************************************************************/

/**
 * Test interleaved write and read calls.
 *
 * Generates a buffer totalSize bytes long, then writes it to the transport,
 * and verifies the written data can be read back correctly.
 *
 * Mode of operation:
 * - call wChunkGenerator to figure out how large of a chunk to write
 *   - call wSizeGenerator to get the size for individual write() calls,
 *     and do this repeatedly until the entire chunk is written.
 * - call rChunkGenerator to figure out how large of a chunk to read
 *   - call rSizeGenerator to get the size for individual read() calls,
 *     and do this repeatedly until the entire chunk is read.
 * - repeat until the full buffer is written and read back,
 *   then compare the data read back against the original buffer
 *
 *
 * - If any of the size generators return 0, this means to use the maximum
 *   possible size.
 *
 * - If maxOutstanding is non-zero, write chunk sizes will be chosen such that
 *   there are never more than maxOutstanding bytes waiting to be read back.
 */
template <class CoupledTransports>
void test_rw(uint32_t totalSize,
             SizeGenerator& wSizeGenerator,
             SizeGenerator& rSizeGenerator,
             SizeGenerator& wChunkGenerator,
             SizeGenerator& rChunkGenerator,
             uint32_t maxOutstanding) {
  CoupledTransports transports;
  BOOST_REQUIRE(transports.in != NULL);
  BOOST_REQUIRE(transports.out != NULL);

  boost::shared_array<uint8_t> wbuf = boost::shared_array<uint8_t>(new uint8_t[totalSize]);
  boost::shared_array<uint8_t> rbuf = boost::shared_array<uint8_t>(new uint8_t[totalSize]);

  // store some data in wbuf
  for (uint32_t n = 0; n < totalSize; ++n) {
    wbuf[n] = (n & 0xff);
  }
  // clear rbuf
  memset(rbuf.get(), 0, totalSize);

  uint32_t total_written = 0;
  uint32_t total_read = 0;
  while (total_read < totalSize) {
    // Determine how large a chunk of data to write
    uint32_t wchunk_size = wChunkGenerator.nextSize();
    if (wchunk_size == 0 || wchunk_size > totalSize - total_written) {
      wchunk_size = totalSize - total_written;
    }

    // Make sure (total_written - total_read) + wchunk_size
    // is less than maxOutstanding
    if (maxOutstanding > 0 && wchunk_size > maxOutstanding - (total_written - total_read)) {
      wchunk_size = maxOutstanding - (total_written - total_read);
    }

    // Write the chunk
    uint32_t chunk_written = 0;
    while (chunk_written < wchunk_size) {
      uint32_t write_size = wSizeGenerator.nextSize();
      if (write_size == 0 || write_size > wchunk_size - chunk_written) {
        write_size = wchunk_size - chunk_written;
      }

      try {
        transports.out->write(wbuf.get() + total_written, write_size);
      } catch (TTransportException& te) {
        if (te.getType() == TTransportException::TIMED_OUT)
          break;
        throw te;
      }
      chunk_written += write_size;
      total_written += write_size;
    }

    // Flush the data, so it will be available in the read transport
    // Don't flush if wchunk_size is 0.  (This should only happen if
    // total_written == totalSize already, and we're only reading now.)
    if (wchunk_size > 0) {
      transports.out->flush();
    }

    // Determine how large a chunk of data to read back
    uint32_t rchunk_size = rChunkGenerator.nextSize();
    if (rchunk_size == 0 || rchunk_size > total_written - total_read) {
      rchunk_size = total_written - total_read;
    }

    // Read the chunk
    uint32_t chunk_read = 0;
    while (chunk_read < rchunk_size) {
      uint32_t read_size = rSizeGenerator.nextSize();
      if (read_size == 0 || read_size > rchunk_size - chunk_read) {
        read_size = rchunk_size - chunk_read;
      }

      int bytes_read = -1;
      try {
        bytes_read = transports.in->read(rbuf.get() + total_read, read_size);
      } catch (TTransportException& e) {
        BOOST_FAIL("read(pos=" << total_read << ", size=" << read_size << ") threw exception \""
                               << e.what() << "\"; written so far: " << total_written << " / "
                               << totalSize << " bytes");
      }

      BOOST_REQUIRE_MESSAGE(bytes_read > 0,
                            "read(pos=" << total_read << ", size=" << read_size << ") returned "
                                        << bytes_read << "; written so far: " << total_written
                                        << " / " << totalSize << " bytes");
      chunk_read += bytes_read;
      total_read += bytes_read;
    }
  }

  // make sure the data read back is identical to the data written
  BOOST_CHECK_EQUAL(memcmp(rbuf.get(), wbuf.get(), totalSize), 0);
}

template <class CoupledTransports>
void test_read_part_available() {
  CoupledTransports transports;
  BOOST_REQUIRE(transports.in != NULL);
  BOOST_REQUIRE(transports.out != NULL);

  uint8_t write_buf[16];
  uint8_t read_buf[16];
  memset(write_buf, 'a', sizeof(write_buf));

  // Attemping to read 10 bytes when only 9 are available should return 9
  // immediately.
  transports.out->write(write_buf, 9);
  transports.out->flush();
  set_trigger(3, transports.out, 1);
  uint32_t bytes_read = transports.in->read(read_buf, 10);
  BOOST_CHECK_EQUAL(g_numTriggersFired, (unsigned int)0);
  BOOST_CHECK_EQUAL(bytes_read, (uint32_t)9);

  clear_triggers();
}

template <class CoupledTransports>
void test_read_part_available_in_chunks() {
  CoupledTransports transports;
  BOOST_REQUIRE(transports.in != NULL);
  BOOST_REQUIRE(transports.out != NULL);

  uint8_t write_buf[16];
  uint8_t read_buf[16];
  memset(write_buf, 'a', sizeof(write_buf));

  // Write 10 bytes (in a single frame, for transports that use framing)
  transports.out->write(write_buf, 10);
  transports.out->flush();

  // Read 1 byte, to force the transport to read the frame
  uint32_t bytes_read = transports.in->read(read_buf, 1);
  BOOST_CHECK_EQUAL(bytes_read, 1u);

  // Read more than what is remaining and verify the transport does not block
  set_trigger(3, transports.out, 1);
  bytes_read = transports.in->read(read_buf, 10);
  BOOST_CHECK_EQUAL(g_numTriggersFired, 0u);
  BOOST_CHECK_EQUAL(bytes_read, 9u);

  clear_triggers();
}

template <class CoupledTransports>
void test_read_partial_midframe() {
  CoupledTransports transports;
  BOOST_REQUIRE(transports.in != NULL);
  BOOST_REQUIRE(transports.out != NULL);

  uint8_t write_buf[16];
  uint8_t read_buf[16];
  memset(write_buf, 'a', sizeof(write_buf));

  // Attempt to read 10 bytes, when only 9 are available, but after we have
  // already read part of the data that is available.  This exercises a
  // different code path for several of the transports.
  //
  // For transports that add their own framing (e.g., TFramedTransport and
  // TFileTransport), the two flush calls break up the data in to a 10 byte
  // frame and a 3 byte frame.  The first read then puts us partway through the
  // first frame, and then we attempt to read past the end of that frame, and
  // through the next frame, too.
  //
  // For buffered transports that perform read-ahead (e.g.,
  // TBufferedTransport), the read-ahead will most likely see all 13 bytes
  // written on the first read.  The next read will then attempt to read past
  // the end of the read-ahead buffer.
  //
  // Flush 10 bytes, then 3 bytes.  This creates 2 separate frames for
  // transports that track framing internally.
  transports.out->write(write_buf, 10);
  transports.out->flush();
  transports.out->write(write_buf, 3);
  transports.out->flush();

  // Now read 4 bytes, so that we are partway through the written data.
  uint32_t bytes_read = transports.in->read(read_buf, 4);
  BOOST_CHECK_EQUAL(bytes_read, (uint32_t)4);

  // Now attempt to read 10 bytes.  Only 9 more are available.
  //
  // We should be able to get all 9 bytes, but it might take multiple read
  // calls, since it is valid for read() to return fewer bytes than requested.
  // (Most transports do immediately return 9 bytes, but the framing transports
  // tend to only return to the end of the current frame, which is 6 bytes in
  // this case.)
  uint32_t total_read = 0;
  while (total_read < 9) {
    set_trigger(3, transports.out, 1);
    bytes_read = transports.in->read(read_buf, 10);
    BOOST_REQUIRE_EQUAL(g_numTriggersFired, (unsigned int)0);
    BOOST_REQUIRE_GT(bytes_read, (uint32_t)0);
    total_read += bytes_read;
    BOOST_REQUIRE_LE(total_read, (uint32_t)9);
  }

  BOOST_CHECK_EQUAL(total_read, (uint32_t)9);

  clear_triggers();
}

template <class CoupledTransports>
void test_borrow_part_available() {
  CoupledTransports transports;
  BOOST_REQUIRE(transports.in != NULL);
  BOOST_REQUIRE(transports.out != NULL);

  uint8_t write_buf[16];
  uint8_t read_buf[16];
  memset(write_buf, 'a', sizeof(write_buf));

  // Attemping to borrow 10 bytes when only 9 are available should return NULL
  // immediately.
  transports.out->write(write_buf, 9);
  transports.out->flush();
  set_trigger(3, transports.out, 1);
  uint32_t borrow_len = 10;
  const uint8_t* borrowed_buf = transports.in->borrow(read_buf, &borrow_len);
  BOOST_CHECK_EQUAL(g_numTriggersFired, (unsigned int)0);
  BOOST_CHECK(borrowed_buf == NULL);

  clear_triggers();
}

template <class CoupledTransports>
void test_read_none_available() {
  CoupledTransports transports;
  BOOST_REQUIRE(transports.in != NULL);
  BOOST_REQUIRE(transports.out != NULL);

  uint8_t write_buf[16];
  uint8_t read_buf[16];
  memset(write_buf, 'a', sizeof(write_buf));

  // Attempting to read when no data is available should either block until
  // some data is available, or fail immediately.  (e.g., TSocket blocks,
  // TMemoryBuffer just fails.)
  //
  // If the transport blocks, it should succeed once some data is available,
  // even if less than the amount requested becomes available.
  set_trigger(1, transports.out, 2);
  add_trigger(1, transports.out, 8);
  uint32_t bytes_read = transports.in->read(read_buf, 10);
  if (bytes_read == 0) {
    BOOST_CHECK_EQUAL(g_numTriggersFired, (unsigned int)0);
    clear_triggers();
  } else {
    BOOST_CHECK_EQUAL(g_numTriggersFired, (unsigned int)1);
    BOOST_CHECK_EQUAL(bytes_read, (uint32_t)2);
  }

  clear_triggers();
}

template <class CoupledTransports>
void test_borrow_none_available() {
  CoupledTransports transports;
  BOOST_REQUIRE(transports.in != NULL);
  BOOST_REQUIRE(transports.out != NULL);

  uint8_t write_buf[16];
  memset(write_buf, 'a', sizeof(write_buf));

  // Attempting to borrow when no data is available should fail immediately
  set_trigger(1, transports.out, 10);
  uint32_t borrow_len = 10;
  const uint8_t* borrowed_buf = transports.in->borrow(NULL, &borrow_len);
  BOOST_CHECK(borrowed_buf == NULL);
  BOOST_CHECK_EQUAL(g_numTriggersFired, (unsigned int)0);

  clear_triggers();
}

/**************************************************************************
 * Test case generation
 *
 * Pretty ugly and annoying.  This would be much easier if we the unit test
 * framework didn't force each test to be a separate function.
 * - Writing a completely separate function definition for each of these would
 *   result in a lot of repetitive boilerplate code.
 * - Combining many tests into a single function makes it more difficult to
 *   tell precisely which tests failed.  It also means you can't get a progress
 *   update after each test, and the tests are already fairly slow.
 * - Similar registration could be achieved with BOOST_TEST_CASE_TEMPLATE,
 *   but it requires a lot of awkward MPL code, and results in useless test
 *   case names.  (The names are generated from std::type_info::name(), which
 *   is compiler-dependent.  gcc returns mangled names.)
 **************************************************************************/

#define ADD_TEST_RW(CoupledTransports, totalSize, ...)                                             \
  addTestRW<CoupledTransports>(BOOST_STRINGIZE(CoupledTransports), totalSize, ##__VA_ARGS__);

#define TEST_RW(CoupledTransports, totalSize, ...)                                                 \
  do {                                                                                             \
    /* Add the test as specified, to test the non-virtual function calls */                        \
    ADD_TEST_RW(CoupledTransports, totalSize, ##__VA_ARGS__);                                      \
    /*                                                                                             \
     * Also test using the transport as a TTransport*, to test                                     \
     * the read_virt()/write_virt() calls                                                          \
     */                                                                                            \
    ADD_TEST_RW(CoupledTTransports<CoupledTransports>, totalSize, ##__VA_ARGS__);                  \
    /* Test wrapping the transport with TBufferedTransport */                                      \
    ADD_TEST_RW(CoupledBufferedTransportsT<CoupledTransports>, totalSize, ##__VA_ARGS__);          \
    /* Test wrapping the transport with TFramedTransports */                                       \
    ADD_TEST_RW(CoupledFramedTransportsT<CoupledTransports>, totalSize, ##__VA_ARGS__);            \
    /* Test wrapping the transport with TZlibTransport */                                          \
    ADD_TEST_RW(CoupledZlibTransportsT<CoupledTransports>, totalSize, ##__VA_ARGS__);              \
  } while (0)

#define ADD_TEST_BLOCKING(CoupledTransports)                                                       \
  addTestBlocking<CoupledTransports>(BOOST_STRINGIZE(CoupledTransports));

#define TEST_BLOCKING_BEHAVIOR(CoupledTransports)                                                  \
  ADD_TEST_BLOCKING(CoupledTransports);                                                            \
  ADD_TEST_BLOCKING(CoupledTTransports<CoupledTransports>);                                        \
  ADD_TEST_BLOCKING(CoupledBufferedTransportsT<CoupledTransports>);                                \
  ADD_TEST_BLOCKING(CoupledFramedTransportsT<CoupledTransports>);                                  \
  ADD_TEST_BLOCKING(CoupledZlibTransportsT<CoupledTransports>);

class TransportTestGen {
public:
  TransportTestGen(boost::unit_test::test_suite* suite, float sizeMultiplier)
    : suite_(suite), sizeMultiplier_(sizeMultiplier) {}

  void generate() {
    GenericSizeGenerator rand4k(1, 4096);

    /*
     * We do the basically the same set of tests for each transport type,
     * although we tweak the parameters in some places.
     */

    // TMemoryBuffer tests
    TEST_RW(CoupledMemoryBuffers, 1024 * 1024, 0, 0);
    TEST_RW(CoupledMemoryBuffers, 1024 * 256, rand4k, rand4k);
    TEST_RW(CoupledMemoryBuffers, 1024 * 256, 167, 163);
    TEST_RW(CoupledMemoryBuffers, 1024 * 16, 1, 1);

    TEST_RW(CoupledMemoryBuffers, 1024 * 256, 0, 0, rand4k, rand4k);
    TEST_RW(CoupledMemoryBuffers, 1024 * 256, rand4k, rand4k, rand4k, rand4k);
    TEST_RW(CoupledMemoryBuffers, 1024 * 256, 167, 163, rand4k, rand4k);
    TEST_RW(CoupledMemoryBuffers, 1024 * 16, 1, 1, rand4k, rand4k);

    TEST_BLOCKING_BEHAVIOR(CoupledMemoryBuffers);

#ifndef _WIN32
    // TFDTransport tests
    // Since CoupledFDTransports tests with a pipe, writes will block
    // if there is too much outstanding unread data in the pipe.
    uint32_t fd_max_outstanding = 4096;
    TEST_RW(CoupledFDTransports, 1024 * 1024, 0, 0, 0, 0, fd_max_outstanding);
    TEST_RW(CoupledFDTransports, 1024 * 256, rand4k, rand4k, 0, 0, fd_max_outstanding);
    TEST_RW(CoupledFDTransports, 1024 * 256, 167, 163, 0, 0, fd_max_outstanding);
    TEST_RW(CoupledFDTransports, 1024 * 16, 1, 1, 0, 0, fd_max_outstanding);

    TEST_RW(CoupledFDTransports, 1024 * 256, 0, 0, rand4k, rand4k, fd_max_outstanding);
    TEST_RW(CoupledFDTransports, 1024 * 256, rand4k, rand4k, rand4k, rand4k, fd_max_outstanding);
    TEST_RW(CoupledFDTransports, 1024 * 256, 167, 163, rand4k, rand4k, fd_max_outstanding);
    TEST_RW(CoupledFDTransports, 1024 * 16, 1, 1, rand4k, rand4k, fd_max_outstanding);

    TEST_BLOCKING_BEHAVIOR(CoupledFDTransports);
#endif //_WIN32

    // TSocket tests
    uint32_t socket_max_outstanding = 4096;
    TEST_RW(CoupledSocketTransports, 1024 * 1024, 0, 0, 0, 0, socket_max_outstanding);
    TEST_RW(CoupledSocketTransports, 1024 * 256, rand4k, rand4k, 0, 0, socket_max_outstanding);
    TEST_RW(CoupledSocketTransports, 1024 * 256, 167, 163, 0, 0, socket_max_outstanding);
    // Doh.  Apparently writing to a socket has some additional overhead for
    // each send() call.  If we have more than ~400 outstanding 1-byte write
    // requests, additional send() calls start blocking.
    TEST_RW(CoupledSocketTransports, 1024 * 16, 1, 1, 0, 0, socket_max_outstanding);
    TEST_RW(CoupledSocketTransports, 1024 * 256, 0, 0, rand4k, rand4k, socket_max_outstanding);
    TEST_RW(CoupledSocketTransports,
            1024 * 256,
            rand4k,
            rand4k,
            rand4k,
            rand4k,
            socket_max_outstanding);
    TEST_RW(CoupledSocketTransports, 1024 * 256, 167, 163, rand4k, rand4k, socket_max_outstanding);
    TEST_RW(CoupledSocketTransports, 1024 * 16, 1, 1, rand4k, rand4k, socket_max_outstanding);

    TEST_BLOCKING_BEHAVIOR(CoupledSocketTransports);

// These could be made to work on Windows, but I don't care enough to make it happen
#ifndef _WIN32
    // TFileTransport tests
    // We use smaller buffer sizes here, since TFileTransport is fairly slow.
    //
    // TFileTransport can't write more than 16MB at once
    uint32_t max_write_at_once = 1024 * 1024 * 16 - 4;
    TEST_RW(CoupledFileTransports, 1024 * 1024, max_write_at_once, 0);
    TEST_RW(CoupledFileTransports, 1024 * 128, rand4k, rand4k);
    TEST_RW(CoupledFileTransports, 1024 * 128, 167, 163);
    TEST_RW(CoupledFileTransports, 1024 * 2, 1, 1);

    TEST_RW(CoupledFileTransports, 1024 * 64, 0, 0, rand4k, rand4k);
    TEST_RW(CoupledFileTransports, 1024 * 64, rand4k, rand4k, rand4k, rand4k);
    TEST_RW(CoupledFileTransports, 1024 * 64, 167, 163, rand4k, rand4k);
    TEST_RW(CoupledFileTransports, 1024 * 2, 1, 1, rand4k, rand4k);

    TEST_BLOCKING_BEHAVIOR(CoupledFileTransports);
#endif

    // Add some tests that access TBufferedTransport and TFramedTransport
    // via TTransport pointers and TBufferBase pointers.
    ADD_TEST_RW(CoupledTTransports<CoupledBufferedTransports>,
                1024 * 1024,
                rand4k,
                rand4k,
                rand4k,
                rand4k);
    ADD_TEST_RW(CoupledBufferBases<CoupledBufferedTransports>,
                1024 * 1024,
                rand4k,
                rand4k,
                rand4k,
                rand4k);
    ADD_TEST_RW(CoupledTTransports<CoupledFramedTransports>,
                1024 * 1024,
                rand4k,
                rand4k,
                rand4k,
                rand4k);
    ADD_TEST_RW(CoupledBufferBases<CoupledFramedTransports>,
                1024 * 1024,
                rand4k,
                rand4k,
                rand4k,
                rand4k);

    // Test using TZlibTransport via a TTransport pointer
    ADD_TEST_RW(CoupledTTransports<CoupledZlibTransports>,
                1024 * 1024,
                rand4k,
                rand4k,
                rand4k,
                rand4k);
  }

#if (BOOST_VERSION >= 105900)
#define MAKE_TEST_CASE(_FUNC, _NAME) boost::unit_test::make_test_case(_FUNC, _NAME, __FILE__, __LINE__)
#else
#define MAKE_TEST_CASE(_FUNC, _NAME) boost::unit_test::make_test_case(_FUNC, _NAME)
#endif

private:
  template <class CoupledTransports>
  void addTestRW(const char* transport_name,
                 uint32_t totalSize,
                 GenericSizeGenerator wSizeGen,
                 GenericSizeGenerator rSizeGen,
                 GenericSizeGenerator wChunkSizeGen = 0,
                 GenericSizeGenerator rChunkSizeGen = 0,
                 uint32_t maxOutstanding = 0,
                 uint32_t expectedFailures = 0) {
    // adjust totalSize by the specified sizeMultiplier_ first
    totalSize = static_cast<uint32_t>(totalSize * sizeMultiplier_);

    std::ostringstream name;
    name << transport_name << "::test_rw(" << totalSize << ", " << wSizeGen.describe() << ", "
         << rSizeGen.describe() << ", " << wChunkSizeGen.describe() << ", "
         << rChunkSizeGen.describe() << ", " << maxOutstanding << ")";

#if (BOOST_VERSION >= 105900)
    boost::function<void ()> test_func
#else
    boost::unit_test::callback0<> test_func
#endif
        = apache::thrift::stdcxx::bind(test_rw<CoupledTransports>,
                                       totalSize,
                                       wSizeGen,
                                       rSizeGen,
                                       wChunkSizeGen,
                                       rChunkSizeGen,
                                       maxOutstanding);
    suite_->add(MAKE_TEST_CASE(test_func, name.str()), expectedFailures);
  }

  template <class CoupledTransports>
  void addTestBlocking(const char* transportName, uint32_t expectedFailures = 0) {
    char name[1024];

    THRIFT_SNPRINTF(name, sizeof(name), "%s::test_read_part_available()", transportName);
    suite_->add(MAKE_TEST_CASE(test_read_part_available<CoupledTransports>, name), expectedFailures);

    THRIFT_SNPRINTF(name, sizeof(name), "%s::test_read_part_available_in_chunks()", transportName);
    suite_->add(MAKE_TEST_CASE(test_read_part_available_in_chunks<CoupledTransports>, name), expectedFailures);

    THRIFT_SNPRINTF(name, sizeof(name), "%s::test_read_partial_midframe()", transportName);
    suite_->add(MAKE_TEST_CASE(test_read_partial_midframe<CoupledTransports>, name), expectedFailures);

    THRIFT_SNPRINTF(name, sizeof(name), "%s::test_read_none_available()", transportName);
    suite_->add(MAKE_TEST_CASE(test_read_none_available<CoupledTransports>, name), expectedFailures);

    THRIFT_SNPRINTF(name, sizeof(name), "%s::test_borrow_part_available()", transportName);
    suite_->add(MAKE_TEST_CASE(test_borrow_part_available<CoupledTransports>, name), expectedFailures);

    THRIFT_SNPRINTF(name, sizeof(name), "%s::test_borrow_none_available()", transportName);
    suite_->add(MAKE_TEST_CASE(test_borrow_none_available<CoupledTransports>, name), expectedFailures);
  }

  boost::unit_test::test_suite* suite_;
  // sizeMultiplier_ is configurable via the command line, and allows the
  // user to adjust between smaller buffers that can be tested quickly,
  // or larger buffers that more thoroughly exercise the code, but take
  // longer.
  float sizeMultiplier_;
};

/**************************************************************************
 * General Initialization
 **************************************************************************/

struct global_fixture {
  boost::shared_ptr<apache::thrift::concurrency::Thread> alarmThread_;
  global_fixture() {
#if _WIN32
    apache::thrift::transport::TWinsockSingleton::create();
#endif

    apache::thrift::concurrency::PlatformThreadFactory factory;
    factory.setDetached(false);

    alarmThread_ = factory.newThread(
        apache::thrift::concurrency::FunctionRunner::create(alarm_handler_wrapper));
    alarmThread_->start();
  }
  ~global_fixture() {
    {
      apache::thrift::concurrency::Synchronized s(g_alarm_monitor);
      g_teardown = true;
      g_alarm_monitor.notify();
    }
    alarmThread_->join();
  }
};

#if (BOOST_VERSION >= 105900)
BOOST_GLOBAL_FIXTURE(global_fixture);
#else
BOOST_GLOBAL_FIXTURE(global_fixture)
#endif

#ifdef BOOST_TEST_DYN_LINK
bool init_unit_test_suite() {
  struct timeval tv;
  THRIFT_GETTIMEOFDAY(&tv, NULL);
  int seed = tv.tv_sec ^ tv.tv_usec;

  initrand(seed);

  boost::unit_test::test_suite* suite = &boost::unit_test::framework::master_test_suite();
  suite->p_name.value = "TransportTest";
  TransportTestGen transport_test_generator(suite, 1);
  transport_test_generator.generate();
  return true;
}

int main( int argc, char* argv[] ) {
  return ::boost::unit_test::unit_test_main(&init_unit_test_suite,argc,argv);
}
#else
boost::unit_test::test_suite* init_unit_test_suite(int argc, char* argv[]) {
  THRIFT_UNUSED_VARIABLE(argc);
  THRIFT_UNUSED_VARIABLE(argv);
  struct timeval tv;
  THRIFT_GETTIMEOFDAY(&tv, NULL);
  int seed = tv.tv_sec ^ tv.tv_usec;

  initrand(seed);

  boost::unit_test::test_suite* suite = &boost::unit_test::framework::master_test_suite();
  suite->p_name.value = "TransportTest";
  TransportTestGen transport_test_generator(suite, 1);
  transport_test_generator.generate();
  return NULL;
}
#endif
