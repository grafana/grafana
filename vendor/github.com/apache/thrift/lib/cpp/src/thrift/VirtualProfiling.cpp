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

#include <thrift/Thrift.h>

// Do nothing if virtual call profiling is not enabled
#if T_GLOBAL_DEBUG_VIRTUAL > 1

// TODO: This code only works with g++ (since we rely on the fact
// that all std::type_info instances referring to a particular type
// always return the exact same pointer value from name().)
#ifndef __GNUG__
#error "Thrift virtual function profiling currently only works with gcc"
#endif // !__GNUG__

// TODO: We also require glibc for the backtrace() and backtrace_symbols()
// functions.
#ifndef __GLIBC__
#error "Thrift virtual function profiling currently requires glibc"
#endif // !__GLIBC__

#include <thrift/concurrency/Mutex.h>

#include <ext/hash_map>
#include <execinfo.h>
#include <stdio.h>

namespace apache {
namespace thrift {

using ::apache::thrift::concurrency::Mutex;
using ::apache::thrift::concurrency::Guard;

static const unsigned int MAX_STACK_DEPTH = 15;

/**
 * A stack trace
 */
class Backtrace {
public:
  Backtrace(int skip = 0);
  Backtrace(Backtrace const& bt);

  void operator=(Backtrace const& bt) {
    numCallers_ = bt.numCallers_;
    if (numCallers_ >= 0) {
      memcpy(callers_, bt.callers_, numCallers_ * sizeof(void*));
    }
  }

  bool operator==(Backtrace const& bt) const { return (cmp(bt) == 0); }

  size_t hash() const {
    intptr_t ret = 0;
    for (int n = 0; n < numCallers_; ++n) {
      ret ^= reinterpret_cast<intptr_t>(callers_[n]);
    }
    return static_cast<size_t>(ret);
  }

  int cmp(Backtrace const& bt) const {
    int depth_diff = (numCallers_ - bt.numCallers_);
    if (depth_diff != 0) {
      return depth_diff;
    }

    for (int n = 0; n < numCallers_; ++n) {
      int diff = reinterpret_cast<intptr_t>(callers_[n])
                 - reinterpret_cast<intptr_t>(bt.callers_[n]);
      if (diff != 0) {
        return diff;
      }
    }

    return 0;
  }

  void print(FILE* f, int indent = 0, int start = 0) const {
    char** strings = backtrace_symbols(callers_, numCallers_);
    if (strings) {
      start += skip_;
      if (start < 0) {
        start = 0;
      }
      for (int n = start; n < numCallers_; ++n) {
        fprintf(f, "%*s#%-2d %s\n", indent, "", n, strings[n]);
      }
      free(strings);
    } else {
      fprintf(f, "%*s<failed to determine symbols>\n", indent, "");
    }
  }

  int getDepth() const { return numCallers_ - skip_; }

  void* getFrame(int index) const {
    int adjusted_index = index + skip_;
    if (adjusted_index < 0 || adjusted_index >= numCallers_) {
      return NULL;
    }
    return callers_[adjusted_index];
  }

private:
  void* callers_[MAX_STACK_DEPTH];
  int numCallers_;
  int skip_;
};

// Define the constructors non-inline, so they consistently add a single
// frame to the stack trace, regardless of whether optimization is enabled
Backtrace::Backtrace(int skip)
  : skip_(skip + 1) // ignore the constructor itself
{
  numCallers_ = backtrace(callers_, MAX_STACK_DEPTH);
  if (skip_ > numCallers_) {
    skip_ = numCallers_;
  }
}

Backtrace::Backtrace(Backtrace const& bt) : numCallers_(bt.numCallers_), skip_(bt.skip_) {
  if (numCallers_ >= 0) {
    memcpy(callers_, bt.callers_, numCallers_ * sizeof(void*));
  }
}

/**
 * A backtrace, plus one or two type names
 */
class Key {
public:
  class Hash {
  public:
    size_t operator()(Key const& k) const { return k.hash(); }
  };

  Key(const Backtrace* bt, const std::type_info& type_info)
    : backtrace_(bt), typeName1_(type_info.name()), typeName2_(NULL) {}

  Key(const Backtrace* bt, const std::type_info& type_info1, const std::type_info& type_info2)
    : backtrace_(bt), typeName1_(type_info1.name()), typeName2_(type_info2.name()) {}

  Key(const Key& k)
    : backtrace_(k.backtrace_), typeName1_(k.typeName1_), typeName2_(k.typeName2_) {}

  void operator=(const Key& k) {
    backtrace_ = k.backtrace_;
    typeName1_ = k.typeName1_;
    typeName2_ = k.typeName2_;
  }

  const Backtrace* getBacktrace() const { return backtrace_; }

  const char* getTypeName() const { return typeName1_; }

  const char* getTypeName2() const { return typeName2_; }

  void makePersistent() {
    // Copy the Backtrace object
    backtrace_ = new Backtrace(*backtrace_);

    // NOTE: We don't copy the type name.
    // The GNU libstdc++ implementation of type_info::name() returns a value
    // that will be valid for the lifetime of the program.  (Although the C++
    // standard doesn't guarantee this will be true on all implementations.)
  }

  /**
   * Clean up memory allocated by makePersistent()
   *
   * Should only be invoked if makePersistent() has previously been called.
   * The Key should no longer be used after cleanup() is called.
   */
  void cleanup() {
    delete backtrace_;
    backtrace_ = NULL;
  }

  int cmp(const Key& k) const {
    int ret = backtrace_->cmp(*k.backtrace_);
    if (ret != 0) {
      return ret;
    }

    // NOTE: We compare just the name pointers.
    // With GNU libstdc++, every type_info object for the same type points to
    // exactly the same name string.  (Although this isn't guaranteed by the
    // C++ standard.)
    ret = k.typeName1_ - typeName1_;
    if (ret != 0) {
      return ret;
    }
    return k.typeName2_ - typeName2_;
  }

  bool operator==(const Key& k) const { return cmp(k) == 0; }

  size_t hash() const {
    // NOTE: As above, we just use the name pointer value.
    // Works with GNU libstdc++, but not guaranteed to be correct on all
    // implementations.
    return backtrace_->hash() ^ reinterpret_cast<size_t>(typeName1_)
           ^ reinterpret_cast<size_t>(typeName2_);
  }

private:
  const Backtrace* backtrace_;
  const char* typeName1_;
  const char* typeName2_;
};

/**
 * A functor that determines which of two BacktraceMap entries
 * has a higher count.
 */
class CountGreater {
public:
  bool operator()(std::pair<Key, size_t> bt1, std::pair<Key, size_t> bt2) const {
    return bt1.second > bt2.second;
  }
};

typedef __gnu_cxx::hash_map<Key, size_t, Key::Hash> BacktraceMap;

/**
 * A map describing how many times T_VIRTUAL_CALL() has been invoked.
 */
BacktraceMap virtual_calls;
Mutex virtual_calls_mutex;

/**
 * A map describing how many times T_GENERIC_PROTOCOL() has been invoked.
 */
BacktraceMap generic_calls;
Mutex generic_calls_mutex;

void _record_backtrace(BacktraceMap* map, const Mutex& mutex, Key* k) {
  Guard guard(mutex);

  BacktraceMap::iterator it = map->find(*k);
  if (it == map->end()) {
    k->makePersistent();
    map->insert(std::make_pair(*k, 1));
  } else {
    // increment the count
    // NOTE: we could assert if it->second is 0 afterwards, since that would
    // mean we've wrapped.
    ++(it->second);
  }
}

/**
 * Record an unnecessary virtual function call.
 *
 * This method is invoked by the T_VIRTUAL_CALL() macro.
 */
void profile_virtual_call(const std::type_info& type) {
  int const skip = 1; // ignore this frame
  Backtrace bt(skip);
  Key k(&bt, type);
  _record_backtrace(&virtual_calls, virtual_calls_mutex, &k);
}

/**
 * Record a call to a template processor with a protocol that is not the one
 * specified in the template parameter.
 *
 * This method is invoked by the T_GENERIC_PROTOCOL() macro.
 */
void profile_generic_protocol(const std::type_info& template_type,
                              const std::type_info& prot_type) {
  int const skip = 1; // ignore this frame
  Backtrace bt(skip);
  Key k(&bt, template_type, prot_type);
  _record_backtrace(&generic_calls, generic_calls_mutex, &k);
}

/**
 * Print the recorded profiling information to the specified file.
 */
void profile_print_info(FILE* f) {
  typedef std::vector<std::pair<Key, size_t> > BacktraceVector;

  CountGreater is_greater;

  // Grab both locks for the duration of the print operation,
  // to ensure the output is a consistent snapshot of a single point in time
  Guard generic_calls_guard(generic_calls_mutex);
  Guard virtual_calls_guard(virtual_calls_mutex);

  // print the info from generic_calls, sorted by frequency
  //
  // We print the generic_calls info ahead of virtual_calls, since it is more
  // useful in some cases.  All T_GENERIC_PROTOCOL calls can be eliminated
  // from most programs.  Not all T_VIRTUAL_CALLs will be eliminated by
  // converting to templates.
  BacktraceVector gp_sorted(generic_calls.begin(), generic_calls.end());
  std::sort(gp_sorted.begin(), gp_sorted.end(), is_greater);

  for (BacktraceVector::const_iterator it = gp_sorted.begin(); it != gp_sorted.end(); ++it) {
    Key const& key = it->first;
    size_t const count = it->second;
    fprintf(f,
            "T_GENERIC_PROTOCOL: %zu calls to %s with a %s:\n",
            count,
            key.getTypeName(),
            key.getTypeName2());
    key.getBacktrace()->print(f, 2);
    fprintf(f, "\n");
  }

  // print the info from virtual_calls, sorted by frequency
  BacktraceVector vc_sorted(virtual_calls.begin(), virtual_calls.end());
  std::sort(vc_sorted.begin(), vc_sorted.end(), is_greater);

  for (BacktraceVector::const_iterator it = vc_sorted.begin(); it != vc_sorted.end(); ++it) {
    Key const& key = it->first;
    size_t const count = it->second;
    fprintf(f, "T_VIRTUAL_CALL: %zu calls on %s:\n", count, key.getTypeName());
    key.getBacktrace()->print(f, 2);
    fprintf(f, "\n");
  }
}

/**
 * Print the recorded profiling information to stdout.
 */
void profile_print_info() {
  profile_print_info(stdout);
}

/**
 * Write a BacktraceMap as Google CPU profiler binary data.
 */
static void profile_write_pprof_file(FILE* f, BacktraceMap const& map) {
  // Write the header
  uintptr_t header[5] = {0, 3, 0, 0, 0};
  fwrite(&header, sizeof(header), 1, f);

  // Write the profile records
  for (BacktraceMap::const_iterator it = map.begin(); it != map.end(); ++it) {
    uintptr_t count = it->second;
    fwrite(&count, sizeof(count), 1, f);

    Backtrace const* bt = it->first.getBacktrace();
    uintptr_t num_pcs = bt->getDepth();
    fwrite(&num_pcs, sizeof(num_pcs), 1, f);

    for (uintptr_t n = 0; n < num_pcs; ++n) {
      void* pc = bt->getFrame(n);
      fwrite(&pc, sizeof(pc), 1, f);
    }
  }

  // Write the trailer
  uintptr_t trailer[3] = {0, 1, 0};
  fwrite(&trailer, sizeof(trailer), 1, f);

  // Write /proc/self/maps
  // TODO(simpkins): This only works on linux
  FILE* proc_maps = fopen("/proc/self/maps", "r");
  if (proc_maps) {
    uint8_t buf[4096];
    while (true) {
      size_t bytes_read = fread(buf, 1, sizeof(buf), proc_maps);
      if (bytes_read == 0) {
        break;
      }
      fwrite(buf, 1, bytes_read, f);
    }
    fclose(proc_maps);
  }
}

/**
 * Write the recorded profiling information as pprof files.
 *
 * This writes the information using the Google CPU profiler binary data
 * format, so it can be analyzed with pprof.  Note that information about the
 * protocol/transport data types cannot be stored in this file format.
 *
 * See http://code.google.com/p/google-perftools/ for more details.
 *
 * @param gen_calls_f     The information about calls to
 *                        profile_generic_protocol() will be written to this
 *                        file.
 * @param virtual_calls_f The information about calls to
 *                        profile_virtual_call() will be written to this file.
 */
void profile_write_pprof(FILE* gen_calls_f, FILE* virtual_calls_f) {
  typedef std::vector<std::pair<Key, size_t> > BacktraceVector;

  CountGreater is_greater;

  // Grab both locks for the duration of the print operation,
  // to ensure the output is a consistent snapshot of a single point in time
  Guard generic_calls_guard(generic_calls_mutex);
  Guard virtual_calls_guard(virtual_calls_mutex);

  // write the info from generic_calls
  profile_write_pprof_file(gen_calls_f, generic_calls);

  // write the info from virtual_calls
  profile_write_pprof_file(virtual_calls_f, virtual_calls);
}
}
} // apache::thrift

#endif // T_GLOBAL_PROFILE_VIRTUAL > 0
