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

#ifndef _FACEBOOK_THRIFT_SERVER_TCLIENTINFO_H_
#define _FACEBOOK_THRIFT_SERVER_TCLIENTINFO_H_ 1

// for inet_ntop --
#include <arpa/inet.h>
#include <thrift/server/TServer.h>
#include <thrift/transport/TSocket.h>
#include <thrift/concurrency/Mutex.h>

namespace apache { namespace thrift { namespace server {

using namespace apache::thrift;
using namespace apache::thrift::transport;
using namespace apache::thrift::concurrency;
using boost::shared_ptr;
using std::string;
using std::vector;

/**
 * StableVector -- a minimal vector class where growth is automatic and
 * vector elements never move as the vector grows.  Allocates new space
 * as needed, but does not copy old values.
 *
 * A level vector stores a list of storage vectors containing the actual
 * elements.  Levels are added as needed, doubling in size each time.
 * Locking is only done when a level is added.  Access is amortized
 * constant time.
 */
template <typename T>
class StableVector {
  /// The initial allocation as an exponent of 2
  static const uint32_t kInitialSizePowOf2 = 10;
  /// The initial allocation size
  static const uint32_t kInitialVectorSize = 1 << kInitialSizePowOf2;
  /// This bound is guaranteed not to be exceeded on 64-bit archs
  static const int kMaxLevels = 64;

  /// Values are kept in one or more of these
  typedef vector<T> Vect;
  /// One or more value vectors are kept in one of these
  typedef vector<Vect*> LevelVector;

  Mutex mutex_;
  /// current size
  size_t size_;
  _Atomic_word vectLvl_;
  LevelVector vects_;

 public:
  /**
   * Constructor -- initialize the level vector and allocate the
   * initial storage vector
   */
  StableVector()
    : size_(0) 
    , vectLvl_(0) {
    vects_.reserve(kMaxLevels);
    Vect* storageVector(new Vect(1 << kInitialSizePowOf2));
    vects_.push_back(storageVector);
  }

 private:
  /**
   * make sure the requested number of storage levels have been allocated.
   */
  void expand(uint32_t level) {
    // we need the guard to insure that we only allocate once.
    Guard g(mutex_);
    while (level > vectLvl_) {
      Vect* levelVect(new Vect(1 << (vectLvl_ + kInitialSizePowOf2)));
      vects_.push_back(levelVect);
      // we need to make sure this is done after levelVect is inserted
      // (what we want is effectively a memory barrier here).
      __gnu_cxx::__atomic_add(&vectLvl_, 1);
    }
  }

  /**
   * Given an index, determine which level and element of that level is
   * required.  Grows if needed.
   */
  void which(uint32_t n, uint32_t* vno, uint32_t* idx) {
    if (n >= size_) {
      size_ = n + 1;
    }
    if (n < kInitialVectorSize) {
      *idx = n;
      *vno = 0;
    } else {
      uint32_t upper = n >> kInitialSizePowOf2;
      *vno = CHAR_BIT*sizeof(upper) - __builtin_clz(upper);
      *idx = n - (1 << (*vno + kInitialSizePowOf2 - 1));
      if (*vno > vectLvl_) {
        expand(*vno);
      }
    }
  }

 public:
  /**
   * Given an index, return a reference to that element, perhaps after
   * allocating additional space.
   *
   * @param n a positive integer
   */
  T& operator[](uint32_t n) {
    uint32_t vno;
    uint32_t idx;
    which(n, &vno, &idx);
    return (*vects_[vno])[idx];
  }

  /**
   * Return the present size of the vector.
   */
  size_t size() const { return size_; }
};


/**
 * This class embodies the representation of a single connection during
 * processing.  We'll keep one of these per file descriptor in TClientInfo.
 */
class TClientInfoConnection {
 public:
  const static int kNameLen = 32;

 private:
  typedef union IPAddrUnion {
    sockaddr_in ipv4;
    sockaddr_in6 ipv6;
  };

  char call_[kNameLen];            ///< The name of the thrift call
  IPAddrUnion addr_;               ///< The client's IP address
  timespec time_;                  ///< Time processing started
  uint64_t ncalls_;                ///< # of calls processed

 public:
  /**
   * Constructor; insure that no client address or thrift call name is
   * represented.
   */
  TClientInfoConnection();

  /**
   * A connection has been made; record its address.  Since this is the
   * first we'll know of a connection we start the timer here as well.
   */
  void recordAddr(const sockaddr* addr);

  /**
   * Mark the address as empty/unknown.
   */
  void eraseAddr();

  /**
   * Return a string representing the present address, or NULL if none.
   * Copies the string into the buffer provided.
   */
  const char* getAddr(char* buf, int len) const;

  /**
   * A call has been made on this connection; record its name.  Since this is
   * called for every thrift call processed, we also do our call count here.
   */ 
  void recordCall(const char* name);

  /**
   * Invoked when processing has ended to clear the call name.
   */
  void eraseCall();

  /**
   * Return as string the thrift call either currently being processed or
   * most recently processed if the connection is still open for additional
   * calls.  Returns NULL if a call hasn't been made yet or processing
   * has ended.
   */
  const char* getCall() const;

  /**
   * Get the timespec for the start of this connection (specifically, when
   * recordAddr() was first called).
   */
  void getTime(timespec* time) const;

  /**
   * Return the number of calls made on this connection.
   */
  uint64_t getNCalls() const;

 private:
  void initTime();
};


/**
 * Store for info about a server's clients -- specifically, the client's IP
 * address and the call it is executing.  This information is indexed by
 * socket file descriptor and in the present implementation is updated
 * asynchronously, so it may only approximate reality.
 */
class TClientInfo {
 private:
  StableVector<TClientInfoConnection> info_;

 public:
  /**
   * Return the info object for a given file descriptor.  If "grow" is true
   * extend the info vector if required (such as for a file descriptor not seen
   * before).  If "grow" is false and the info vector isn't large enough,
   * or if "fd" is negative, return NULL.
   */
  TClientInfoConnection* getConnection(int fd, bool grow);

  size_t size() const;
};

/**
 * This derivation of TServerEventHandler encapsulates the main status vector
 * and provides context to the server's processing loop via overrides.
 * Together with TClientInfoCallHandler (derived from TProcessorEventHandler) 
 * it integrates client info collection into the server.
 */
class TClientInfoServerHandler : public TServerEventHandler {
 private:
  TClientInfo clientInfo_;

 public:
  /**
   * One of these is constructed for each open connection/descriptor and links
   * to both the status vector (clientInfo_) and that descriptor's entry
   * within it.
   */
  struct Connect {
    TClientInfo* clientInfo_;
    TClientInfoConnection* callInfo_;

    explicit Connect(TClientInfo* clientInfo)
      : clientInfo_(clientInfo)
      , callInfo_(NULL) {
    }
  };

  /**
   * Generate processor context; we don't know what descriptor we belong to
   * yet -- we'll get hooked up in contextProcess(). 
   */
  void* createContext(boost::shared_ptr<TProtocol> input,
                      boost::shared_ptr<TProtocol> output);

  /**
   * Mark our slot as unused and delete the context created in createContext().
   */
  void deleteContext(void* processorContext,
                     boost::shared_ptr<TProtocol> input,
                     boost::shared_ptr<TProtocol> output);
  
  /**
   * Called in the processing loop just before the server invokes the
   * processor itself, on the first call we establish which descriptor
   * we correspond to and set it to that socket's peer IP address.  This
   * also has the side effect of initializing call counting and connection
   * timing.  We won't know which call we're handling until the handler
   * first gets called in TClientInfoCallHandler::getContext().
   */
  void processContext(void* processorContext,
                      shared_ptr<TTransport> transport);

  /**
   * Get status report for server in the form of a vector of strings.
   * Each active client appears as one string in the format:
   *
   *     FD IPADDR CALLNAME DURATION NCALLS
   *
   * where "FD" is the file descriptor for the client's socket, "IPADDR"
   * is the IP address (as reported by accept()), "CALLNAME" is the
   * current or most recent Thrift function name, "DURATION" is the
   * duration of the connection, while NCALLS is the number of Thrift
   * calls made since the connection was made.  A single space separates
   * fields.
   */
  void getStatsStrings(vector<string>& result);
};

/**
 * This class derives from TProcessorEventHandler to gain access to the
 * function name for the current Thrift call.  We need two versions of
 * this -- TClientInfoCallStatsHandler is the other -- since in the latter
 * case we pass through to TFunctionStatHandler to perform Thrift call
 * stats.
 */
class TClientInfoCallHandler : public TProcessorEventHandler {
 public:
  virtual void* getContext(const char* fn_name, void* serverContext);
};

} } } // namespace apache::thrift::server

#endif // !_FACEBOOK_THRIFT_SERVER_TCLIENTINFO_H_
