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

#include <sys/time.h>

#include "FacebookBase.h"
#include "ServiceTracker.h"
#include <thrift/concurrency/ThreadManager.h>

using namespace std;
using namespace facebook::fb303;
using namespace apache::thrift::concurrency;


uint64_t ServiceTracker::CHECKPOINT_MINIMUM_INTERVAL_SECONDS = 60;
int ServiceTracker::LOG_LEVEL = 5;


ServiceTracker::ServiceTracker(facebook::fb303::FacebookBase *handler,
                               void (*logMethod)(int, const string &),
                               bool featureCheckpoint,
                               bool featureStatusCheck,
                               bool featureThreadCheck,
                               Stopwatch::Unit stopwatchUnit)
  : handler_(handler), logMethod_(logMethod),
    featureCheckpoint_(featureCheckpoint),
    featureStatusCheck_(featureStatusCheck),
    featureThreadCheck_(featureThreadCheck),
    stopwatchUnit_(stopwatchUnit),
    checkpointServices_(0)
{
  if (featureCheckpoint_) {
    time_t now = time(NULL);
    checkpointTime_ = now;
  } else {
    checkpointTime_ = 0;
  }
}

/**
 * Registers the beginning of a "service method": basically, any of
 * the implementations of Thrift remote procedure calls that a
 * FacebookBase handler is handling.  Controls concurrent
 * services and reports statistics (via log and via fb303 counters).
 * Throws an exception if the server is not ready to handle service
 * methods yet.
 *
 * note: The relationship between startService() and finishService()
 * is currently defined so that a call to finishService() should only
 * be matched to this call to startService() if this method returns
 * without exception.  It wouldn't be a problem to implement things
 * the other way, so that *every* start needed a finish, but this
 * convention was chosen to match the way an object's constructor and
 * destructor work together, i.e. to work well with ServiceMethod
 * objects.
 *
 * @param const ServiceMethod &serviceMethod A reference to the ServiceMethod
 *                                           object instantiated at the start
 *                                           of the service method.
 */
void
ServiceTracker::startService(const ServiceMethod &serviceMethod)
{
  // note: serviceMethod.timer_ automatically starts at construction.

  // log service start
  logMethod_(5, serviceMethod.signature_);

  // check handler ready
  if (featureStatusCheck_ && !serviceMethod.featureLogOnly_) {
    // note: Throwing exceptions before counting statistics.  See note
    // in method header.
    // note: A STOPPING server is not accepting new connections, but it
    // is still handling any already-connected threads -- so from the
    // service method's point of view, a status of STOPPING is a green
    // light.
    facebook::fb303::fb_status status = handler_->getStatus();
    if (status != facebook::fb303::ALIVE
        && status != facebook::fb303::STOPPING) {
      if (status == facebook::fb303::STARTING) {
        throw ServiceException("Server starting up; please try again later");
      } else {
        throw ServiceException("Server not alive; please try again later");
      }
    }
  }

  // check server threads
  if (featureThreadCheck_ && !serviceMethod.featureLogOnly_) {
    // note: Might want to put these messages in reportCheckpoint() if
    // log is getting spammed.
    if (threadManager_ != NULL) {
      size_t idle_count = threadManager_->idleWorkerCount();
      if (idle_count == 0) {
        stringstream message;
        message << "service " << serviceMethod.signature_
                << ": all threads (" << threadManager_->workerCount()
                << ") in use";
        logMethod_(3, message.str());
      }
    }
  }
}

/**
 * Logs a significant step in the middle of a "service method"; see
 * startService.
 *
 * @param const ServiceMethod &serviceMethod A reference to the ServiceMethod
 *                                           object instantiated at the start
 *                                           of the service method.
 * @return int64_t Elapsed units (see stopwatchUnit_) since ServiceMethod
 *                 instantiation.
 */
int64_t
ServiceTracker::stepService(const ServiceMethod &serviceMethod,
                            const string &stepName)
{
  stringstream message;
  string elapsed_label;
  int64_t elapsed = serviceMethod.timer_.elapsedUnits(stopwatchUnit_,
                                                      &elapsed_label);
  message << serviceMethod.signature_
          << ' ' << stepName
          << " [" << elapsed_label << ']';
  logMethod_(5, message.str());
  return elapsed;
}

/**
 * Registers the end of a "service method"; see startService().
 *
 * @param const ServiceMethod &serviceMethod A reference to the ServiceMethod
 *                                           object instantiated at the start
 *                                           of the service method.
 */
void
ServiceTracker::finishService(const ServiceMethod &serviceMethod)
{
  // log end of service
  stringstream message;
  string duration_label;
  int64_t duration = serviceMethod.timer_.elapsedUnits(stopwatchUnit_,
                                                       &duration_label);
  message << serviceMethod.signature_
          << " finish [" << duration_label << ']';
  logMethod_(5, message.str());

  // count, record, and maybe report service statistics
  if (!serviceMethod.featureLogOnly_) {

    if (!featureCheckpoint_) {

      // lifetime counters
      // (note: No need to lock statisticsMutex_ if not doing checkpoint;
      // FacebookService::incrementCounter() is already thread-safe.)
      handler_->incrementCounter("lifetime_services");

    } else {

      statisticsMutex_.lock();
      // note: No exceptions expected from this code block.  Wrap in a try
      // just to be safe.
      try {

        // lifetime counters
        // note: Good to synchronize this with the increment of
        // checkpoint services, even though incrementCounter() is
        // already thread-safe, for the sake of checkpoint reporting
        // consistency (i.e.  since the last checkpoint,
        // lifetime_services has incremented by checkpointServices_).
        handler_->incrementCounter("lifetime_services");

        // checkpoint counters
        checkpointServices_++;
        checkpointDuration_ += duration;

        // per-service timing
        // note kjv: According to my tests it is very slightly faster to
        // call insert() once (and detect not-found) than calling find()
        // and then maybe insert (if not-found).  However, the difference
        // is tiny for small maps like this one, and the code for the
        // faster solution is slightly less readable.  Also, I wonder if
        // the instantiation of the (often unused) pair to insert makes
        // the first algorithm slower after all.
        map<string, pair<uint64_t, uint64_t> >::iterator iter;
        iter = checkpointServiceDuration_.find(serviceMethod.name_);
        if (iter != checkpointServiceDuration_.end()) {
          iter->second.first++;
          iter->second.second += duration;
        } else {
          checkpointServiceDuration_.insert(make_pair(serviceMethod.name_,
                                                      make_pair(1, duration)));
        }

        // maybe report checkpoint
        // note: ...if it's been long enough since the last report.
        time_t now = time(NULL);
        uint64_t check_interval = now - checkpointTime_;
        if (check_interval >= CHECKPOINT_MINIMUM_INTERVAL_SECONDS) {
          reportCheckpoint();
        }

      } catch (...) {
        statisticsMutex_.unlock();
        throw;
      }
      statisticsMutex_.unlock();

    }
  }
}

/**
 * Logs some statistics gathered since the last call to this method.
 *
 * note: Thread race conditions on this method could cause
 * misreporting and/or undefined behavior; the caller must protect
 * uses of the object variables (and calls to this method) with a
 * mutex.
 *
 */
void
ServiceTracker::reportCheckpoint()
{
  time_t now = time(NULL);

  uint64_t check_count = checkpointServices_;
  uint64_t check_interval = now - checkpointTime_;
  uint64_t check_duration = checkpointDuration_;

  // export counters for timing of service methods (by service name)
  handler_->setCounter("checkpoint_time", check_interval);
  map<string, pair<uint64_t, uint64_t> >::iterator iter;
  uint64_t count;
  for (iter = checkpointServiceDuration_.begin();
       iter != checkpointServiceDuration_.end();
       ++iter) {
    count = iter->second.first;
    handler_->setCounter(string("checkpoint_count_") + iter->first, count);
    if (count == 0) {
      handler_->setCounter(string("checkpoint_speed_") + iter->first,
                           0);
    } else {
      handler_->setCounter(string("checkpoint_speed_") + iter->first,
                           iter->second.second / count);
    }
  }

  // reset checkpoint variables
  // note: Clearing the map while other threads are using it might
  // cause undefined behavior.
  checkpointServiceDuration_.clear();
  checkpointTime_ = now;
  checkpointServices_ = 0;
  checkpointDuration_ = 0;

  // get lifetime variables
  uint64_t life_count = handler_->getCounter("lifetime_services");
  uint64_t life_interval = now - handler_->aliveSince();

  // log checkpoint
  stringstream message;
  message << "checkpoint_time:" << check_interval
          << " checkpoint_services:" << check_count
          << " checkpoint_speed_sum:" << check_duration
          << " lifetime_time:" << life_interval
          << " lifetime_services:" << life_count;
  if (featureThreadCheck_ && threadManager_ != NULL) {
    size_t worker_count = threadManager_->workerCount();
    size_t idle_count = threadManager_->idleWorkerCount();
    message << " total_workers:" << worker_count
            << " active_workers:" << (worker_count - idle_count);
  }
  logMethod_(4, message.str());
}

/**
 * Remembers the thread manager used in the server, for monitoring thread
 * activity.
 *
 * @param shared_ptr<ThreadManager> threadManager The server's thread manager.
 */
void
ServiceTracker::setThreadManager(boost::shared_ptr<ThreadManager>
                                 threadManager)
{
  threadManager_ = threadManager;
}

/**
 * Logs messages to stdout; the passed message will be logged if the
 * passed level is less than or equal to LOG_LEVEL.
 *
 * This is the default logging method used by the ServiceTracker.  An
 * alternate logging method (that accepts the same parameters) may be
 * specified to the constructor.
 *
 * @param int level A level associated with the message: higher levels
 *                  are used to indicate higher levels of detail.
 * @param string message The message to log.
 */
void
ServiceTracker::defaultLogMethod(int level, const string &message)
{
  if (level <= LOG_LEVEL) {
    string level_string;
    time_t now = time(NULL);
    char now_pretty[26];
    ctime_r(&now, now_pretty);
    now_pretty[24] = '\0';
    switch (level) {
    case 1:
      level_string = "CRITICAL";
      break;
    case 2:
      level_string = "ERROR";
      break;
    case 3:
      level_string = "WARNING";
      break;
    case 5:
      level_string = "DEBUG";
      break;
    case 4:
    default:
      level_string = "INFO";
      break;
    }
    cout << '[' << level_string << "] [" << now_pretty << "] "
         << message << endl;
  }
}


/**
 * Creates a Stopwatch, which can report the time elapsed since its
 * creation.
 *
 */
Stopwatch::Stopwatch()
{
  gettimeofday(&startTime_, NULL);
}

void
Stopwatch::reset()
{
  gettimeofday(&startTime_, NULL);
}

uint64_t
Stopwatch::elapsedUnits(Stopwatch::Unit unit, string *label) const
{
  timeval now_time;
  gettimeofday(&now_time, NULL);
  time_t duration_secs = now_time.tv_sec - startTime_.tv_sec;

  uint64_t duration_units;
  switch (unit) {
  case UNIT_SECONDS:
    duration_units = duration_secs
      + (now_time.tv_usec - startTime_.tv_usec + 500000) / 1000000;
    if (NULL != label) {
      stringstream ss_label;
      ss_label << duration_units << " secs";
      label->assign(ss_label.str());
    }
    break;
  case UNIT_MICROSECONDS:
    duration_units = duration_secs * 1000000
      + now_time.tv_usec - startTime_.tv_usec;
    if (NULL != label) {
      stringstream ss_label;
      ss_label << duration_units << " us";
      label->assign(ss_label.str());
    }
    break;
  case UNIT_MILLISECONDS:
  default:
    duration_units = duration_secs * 1000
      + (now_time.tv_usec - startTime_.tv_usec + 500) / 1000;
    if (NULL != label) {
      stringstream ss_label;
      ss_label << duration_units << " ms";
      label->assign(ss_label.str());
    }
    break;
  }
  return duration_units;
}

/**
 * Creates a ServiceMethod, used for tracking a single service method
 * invocation (via the ServiceTracker).  The passed name of the
 * ServiceMethod is used to group statistics (e.g. counts and durations)
 * for similar invocations; the passed signature is used to uniquely
 * identify the particular invocation in the log.
 *
 * note: A version of this constructor is provided that automatically
 * forms a signature the name and a passed numeric id.  Silly, sure,
 * but commonly used, since it often saves the caller a line or two of
 * code.
 *
 * @param ServiceTracker *tracker The service tracker that will track this
 *                                ServiceMethod.
 * @param const string &name The service method name (usually independent
 *                           of service method parameters).
 * @param const string &signature A signature uniquely identifying the method
 *                                invocation (usually name plus parameters).
 */
ServiceMethod::ServiceMethod(ServiceTracker *tracker,
                             const string &name,
                             const string &signature,
                             bool featureLogOnly)
  : tracker_(tracker), name_(name), signature_(signature),
    featureLogOnly_(featureLogOnly)
{
  // note: timer_ automatically starts at construction.

  // invoke tracker to start service
  // note: Might throw.  If it throws, then this object's destructor
  // won't be called, which is according to plan: finishService() is
  // only supposed to be matched to startService() if startService()
  // returns without error.
  tracker_->startService(*this);
}

ServiceMethod::ServiceMethod(ServiceTracker *tracker,
                             const string &name,
                             uint64_t id,
                             bool featureLogOnly)
  : tracker_(tracker), name_(name), featureLogOnly_(featureLogOnly)
{
  // note: timer_ automatically starts at construction.
  stringstream ss_signature;
  ss_signature << name << " (" << id << ')';
  signature_ = ss_signature.str();

  // invoke tracker to start service
  // note: Might throw.  If it throws, then this object's destructor
  // won't be called, which is according to plan: finishService() is
  // only supposed to be matched to startService() if startService()
  // returns without error.
  tracker_->startService(*this);
}

ServiceMethod::~ServiceMethod()
{
  // invoke tracker to finish service
  // note: Not expecting an exception from this code, but
  // finishService() might conceivably throw an out-of-memory
  // exception.
  try {
    tracker_->finishService(*this);
  } catch (...) {
    // don't throw
  }
}

uint64_t
ServiceMethod::step(const std::string &stepName)
{
  return tracker_->stepService(*this, stepName);
}
