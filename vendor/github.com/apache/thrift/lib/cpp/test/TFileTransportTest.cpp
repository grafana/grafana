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
#ifndef _GNU_SOURCE
#define _GNU_SOURCE // needed for getopt_long
#endif

#include <thrift/thrift-config.h>

#ifdef HAVE_SYS_TIME_H
#include <sys/time.h>
#endif
#include <getopt.h>
#include <boost/test/unit_test.hpp>

#include <thrift/transport/TFileTransport.h>

#ifdef __MINGW32__
  #include <io.h>
  #include <unistd.h>
  #include <sys/types.h>
  #include <fcntl.h>
  #include <sys\stat.h>
#endif

using namespace apache::thrift::transport;

/**************************************************************************
 * Global state
 **************************************************************************/

static const char* tmp_dir = "/tmp";

class FsyncLog;
FsyncLog* fsync_log;

/**************************************************************************
 * Helper code
 **************************************************************************/

// Provide BOOST_WARN_LT() and BOOST_WARN_GT(), in case we're compiled
// with an older version of boost
#ifndef BOOST_WARN_LT
#define BOOST_WARN_CMP(a, b, op, check_fn)                                                         \
  check_fn((a)op(b),                                                                               \
           "check " BOOST_STRINGIZE(a) " " BOOST_STRINGIZE(op) " " BOOST_STRINGIZE(                \
               b) " failed: " BOOST_STRINGIZE(a) "="                                               \
           << (a) << " " BOOST_STRINGIZE(b) "=" << (b))

#define BOOST_WARN_LT(a, b) BOOST_WARN_CMP(a, b, <, BOOST_WARN_MESSAGE)
#define BOOST_WARN_GT(a, b) BOOST_WARN_CMP(a, b, >, BOOST_WARN_MESSAGE)
#define BOOST_WARN_LT(a, b) BOOST_WARN_CMP(a, b, <, BOOST_WARN_MESSAGE)
#endif // BOOST_WARN_LT

/**
 * Class to record calls to fsync
 */
class FsyncLog {
public:
  struct FsyncCall {
    struct timeval time;
    int fd;
  };
  typedef std::list<FsyncCall> CallList;

  FsyncLog() {}

  void fsync(int fd) {
    (void)fd;
    FsyncCall call;
    gettimeofday(&call.time, NULL);
    calls_.push_back(call);
  }

  const CallList* getCalls() const { return &calls_; }

private:
  CallList calls_;
};

/**
 * Helper class to clean up temporary files
 */
class TempFile {
public:
  TempFile(const char* directory, const char* prefix) {
  #ifdef __MINGW32__
    size_t path_len = strlen(prefix) + 8;
    path_ = new char[path_len];
    snprintf(path_, path_len, "%sXXXXXX", prefix);
    if (_mktemp_s(path_,path_len) == 0) {
      fd_ = open(path_,O_CREAT | O_RDWR | O_BINARY,S_IREAD | S_IWRITE);
      if (fd_ < 0) {
        throw apache::thrift::TException("_mktemp_s() failed");
      }
    } else {
      throw apache::thrift::TException("_mktemp_s() failed");
    }
  #else
    size_t path_len = strlen(directory) + strlen(prefix) + 8;
    path_ = new char[path_len];
    snprintf(path_, path_len, "%s/%sXXXXXX", directory, prefix);

    fd_ = mkstemp(path_);
    if (fd_ < 0) {
      throw apache::thrift::TException("mkstemp() failed");
    }
  #endif
  }

  ~TempFile() {
    unlink();
    close();
  }

  const char* getPath() const { return path_; }

  int getFD() const { return fd_; }

  void unlink() {
    if (path_) {
      ::unlink(path_);
      delete[] path_;
      path_ = NULL;
    }
  }

  void close() {
    if (fd_ < 0) {
      return;
    }

    ::close(fd_);
    fd_ = -1;
  }

private:
  char* path_;
  int fd_;
};

// Use our own version of fsync() for testing.
// This returns immediately, so timing in test_destructor() isn't affected by
// waiting on the actual filesystem.
extern "C" int fsync(int fd) {
  if (fsync_log) {
    fsync_log->fsync(fd);
  }
  return 0;
}

int time_diff(const struct timeval* t1, const struct timeval* t2) {
  return (t2->tv_usec - t1->tv_usec) + (t2->tv_sec - t1->tv_sec) * 1000000;
}

/**************************************************************************
 * Test cases
 **************************************************************************/

/**
 * Make sure the TFileTransport destructor exits "quickly".
 *
 * Previous versions had a bug causing the writer thread not to exit
 * right away.
 *
 * It's kind of lame that we just check to see how long the destructor takes in
 * wall-clock time.  This could result in false failures on slower systems, or
 * on heavily loaded machines.
 */
BOOST_AUTO_TEST_CASE(test_destructor) {
  TempFile f(tmp_dir, "thrift.TFileTransportTest.");

  unsigned int const NUM_ITERATIONS = 1000;

  unsigned int num_over = 0;
  for (unsigned int n = 0; n < NUM_ITERATIONS; ++n) {
    BOOST_CHECK_EQUAL(0, ftruncate(f.getFD(), 0));

    TFileTransport* transport = new TFileTransport(f.getPath());

    // write something so that the writer thread gets started
    transport->write(reinterpret_cast<const uint8_t*>("foo"), 3);

    // Every other iteration, also call flush(), just in case that potentially
    // has any effect on how the writer thread wakes up.
    if (n & 0x1) {
      transport->flush();
    }

    /*
     * Time the call to the destructor
     */
    struct timeval start;
    struct timeval end;

    gettimeofday(&start, NULL);
    delete transport;
    gettimeofday(&end, NULL);

    int delta = time_diff(&start, &end);

    // If any attempt takes more than 500ms, treat that as a failure.
    // Treat this as a fatal failure, so we'll return now instead of
    // looping over a very slow operation.
    BOOST_WARN_LT(delta, 500000);

    // Normally, it takes less than 100ms on my dev box.
    // However, if the box is heavily loaded, some of the test runs
    // take longer, since we're just waiting for our turn on the CPU.
    if (delta > 100000) {
      ++num_over;
    }
  }

  // Make sure fewer than 10% of the runs took longer than 1000us
  BOOST_WARN(num_over < (NUM_ITERATIONS / 10));
}

/**
 * Make sure setFlushMaxUs() is honored.
 */
void test_flush_max_us_impl(uint32_t flush_us, uint32_t write_us, uint32_t test_us) {
  // TFileTransport only calls fsync() if data has been written,
  // so make sure the write interval is smaller than the flush interval.
  BOOST_WARN(write_us < flush_us);

  TempFile f(tmp_dir, "thrift.TFileTransportTest.");

  // Record calls to fsync()
  FsyncLog log;
  fsync_log = &log;

  TFileTransport* transport = new TFileTransport(f.getPath());
  // Don't flush because of # of bytes written
  transport->setFlushMaxBytes(0xffffffff);
  uint8_t buf[] = "a";
  uint32_t buflen = sizeof(buf);

  // Set the flush interval
  transport->setFlushMaxUs(flush_us);

  // Make one call to write, to start the writer thread now.
  // (If we just let the thread get created during our test loop,
  // the thread creation sometimes takes long enough to make the first
  // fsync interval fail the check.)
  transport->write(buf, buflen);

  // Add one entry to the fsync log, just to mark the start time
  log.fsync(-1);

  // Loop doing write(), sleep(), ...
  uint32_t total_time = 0;
  while (true) {
    transport->write(buf, buflen);
    if (total_time > test_us) {
      break;
    }
    usleep(write_us);
    total_time += write_us;
  }

  delete transport;

  // Stop logging new fsync() calls
  fsync_log = NULL;

  // Examine the fsync() log
  //
  // TFileTransport uses pthread_cond_timedwait(), which only has millisecond
  // resolution.  In my testing, it normally wakes up about 1 millisecond late.
  // However, sometimes it takes a bit longer.  Allow 5ms leeway.
  int max_allowed_delta = flush_us + 5000;

  const FsyncLog::CallList* calls = log.getCalls();
  // We added 1 fsync call above.
  // Make sure TFileTransport called fsync at least once
  BOOST_WARN_GE(calls->size(), static_cast<FsyncLog::CallList::size_type>(1));

  const struct timeval* prev_time = NULL;
  for (FsyncLog::CallList::const_iterator it = calls->begin(); it != calls->end(); ++it) {
    if (prev_time) {
      int delta = time_diff(prev_time, &it->time);
      BOOST_WARN_LT(delta, max_allowed_delta);
    }
    prev_time = &it->time;
  }
}

BOOST_AUTO_TEST_CASE(test_flush_max_us1) {
  // fsync every 10ms, write every 5ms, for 500ms
  test_flush_max_us_impl(10000, 5000, 500000);
}

BOOST_AUTO_TEST_CASE(test_flush_max_us2) {
  // fsync every 50ms, write every 20ms, for 500ms
  test_flush_max_us_impl(50000, 20000, 500000);
}

BOOST_AUTO_TEST_CASE(test_flush_max_us3) {
  // fsync every 400ms, write every 300ms, for 1s
  test_flush_max_us_impl(400000, 300000, 1000000);
}

/**
 * Make sure flush() is fast when there is nothing to do.
 *
 * TFileTransport used to have a bug where flush() would wait for the fsync
 * timeout to expire.
 */
BOOST_AUTO_TEST_CASE(test_noop_flush) {
  TempFile f(tmp_dir, "thrift.TFileTransportTest.");
  TFileTransport transport(f.getPath());

  // Write something to start the writer thread.
  uint8_t buf[] = "a";
  transport.write(buf, 1);

  struct timeval start;
  gettimeofday(&start, NULL);

  for (unsigned int n = 0; n < 10; ++n) {
    transport.flush();

    struct timeval now;
    gettimeofday(&now, NULL);

    // Fail if at any point we've been running for longer than half a second.
    // (With the buggy code, TFileTransport used to take 3 seconds per flush())
    //
    // Use a fatal fail so we break out early, rather than continuing to make
    // many more slow flush() calls.
    int delta = time_diff(&start, &now);
    BOOST_WARN_LT(delta, 2000000);
  }
}

/**************************************************************************
 * General Initialization
 **************************************************************************/

void print_usage(FILE* f, const char* argv0) {
  fprintf(f, "Usage: %s [boost_options] [options]\n", argv0);
  fprintf(f, "Options:\n");
  fprintf(f, "  --tmp-dir=DIR, -t DIR\n");
  fprintf(f, "  --help\n");
}

void parse_args(int argc, char* argv[]) {
  struct option long_opts[]
      = {{"help", false, NULL, 'h'}, {"tmp-dir", true, NULL, 't'}, {NULL, 0, NULL, 0}};

  while (true) {
    optopt = 1;
    int optchar = getopt_long(argc, argv, "ht:", long_opts, NULL);
    if (optchar == -1) {
      break;
    }

    switch (optchar) {
    case 't':
      tmp_dir = optarg;
      break;
    case 'h':
      print_usage(stdout, argv[0]);
      exit(0);
    case '?':
      exit(1);
    default:
      // Only happens if someone adds another option to the optarg string,
      // but doesn't update the switch statement to handle it.
      fprintf(stderr, "unknown option \"-%c\"\n", optchar);
      exit(1);
    }
  }
}

#ifdef BOOST_TEST_DYN_LINK
static int myArgc = 0;
static char **myArgv = NULL;

bool init_unit_test_suite() {
  boost::unit_test::framework::master_test_suite().p_name.value = "TFileTransportTest";

  // Parse arguments
  parse_args(myArgc,myArgv);
  return true;
}

int main( int argc, char* argv[] ) {
  myArgc = argc;
  myArgv = argv;
  return ::boost::unit_test::unit_test_main(&init_unit_test_suite,argc,argv);
}
#else
boost::unit_test::test_suite* init_unit_test_suite(int argc, char* argv[]) {
  boost::unit_test::framework::master_test_suite().p_name.value = "TFileTransportTest";

  // Parse arguments
  parse_args(argc, argv);
  return NULL;
}
#endif
