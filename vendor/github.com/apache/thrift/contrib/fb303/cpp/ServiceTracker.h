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

/**
 * ServiceTracker is a utility class for logging and timing service
 * calls to a fb303 Thrift server.  Currently, ServiceTracker offers
 * the following features:
 *
 *   . Logging of service method start, end (and duration), and
 *     optional steps in between.
 *
 *   . Automatic check of server status via fb303::getStatus()
 *     with a ServiceException thrown if server not alive
 *     (at method start).
 *
 *   . A periodic logged checkpoint reporting lifetime time, lifetime
 *     service count, and per-method statistics since the last checkpoint
 *     time (at method finish).
 *
 *   . Export of fb303 counters for lifetime and checkpoint statistics
 *     (at method finish).
 *
 *   . For TThreadPoolServers, a logged warning when all server threads
 *     are busy (at method start).  (Must call setThreadManager() after
 *     ServiceTracker instantiation for this feature to be enabled.)
 *
 * Individual features may be enabled or disabled by arguments to the
 * constructor.  The constructor also accepts a pointer to a logging
 * method -- if no pointer is passed, the tracker will log to stdout.
 *
 * ServiceTracker defines private methods for service start, finish,
 * and step, which are designed to be accessed by instantiating a
 * friend ServiceMethod object, as in the following example:
 *
 *    #include <ServiceTracker.h>
 *    class MyServiceHandler : virtual public MyServiceIf,
 *                             public facebook::fb303::FacebookBase
 *    {
 *    public:
 *      MyServiceHandler::MyServiceHandler() : mServiceTracker(this) {}
 *      void MyServiceHandler::myServiceMethod(int userId) {
 *        // note: Instantiating a ServiceMethod object starts a timer
 *        // and tells the ServiceTracker to log the start.  Might throw
 *        // a ServiceException.
 *        ServiceMethod serviceMethod(&mServiceTracker,
 *                                   "myServiceMethod",
 *                                   userId);
 *        ...
 *        // note: Calling the step method tells the ServiceTracker to
 *        // log the step, with a time elapsed since start.
 *        serviceMethod.step("post parsing, begin processing");
 *        ...
 *        // note: When the ServiceMethod object goes out of scope, the
 *        // ServiceTracker will log the total elapsed time of the method.
 *      }
 *      ...
 *    private:
 *      ServiceTracker mServiceTracker;
 *    }
 *
 * The step() method call is optional; the startService() and
 * finishService() methods are handled by the object's constructor and
 * destructor.
 *
 * The ServiceTracker is (intended to be) thread-safe.
 *
 * Future:
 *
 *   . Come up with something better for logging than passing a
 *     function pointer to the constructor.
 *
 *   . Add methods for tracking errors from service methods, e.g.
 *     ServiceTracker::reportService().
 */

#ifndef SERVICETRACKER_H
#define SERVICETRACKER_H


#include <iostream>
#include <string>
#include <sstream>
#include <exception>
#include <map>
#include <boost/shared_ptr.hpp>

#include <thrift/concurrency/Mutex.h>


namespace apache { namespace thrift { namespace concurrency {
  class ThreadManager;
}}}


namespace facebook { namespace fb303 {


class FacebookBase;
class ServiceMethod;


class Stopwatch
{
public:
  enum Unit { UNIT_SECONDS, UNIT_MILLISECONDS, UNIT_MICROSECONDS };
  Stopwatch();
  uint64_t elapsedUnits(Unit unit, std::string *label = NULL) const;
  void reset();
private:
  timeval startTime_;
};


class ServiceTracker
{
  friend class ServiceMethod;

public:

  static uint64_t CHECKPOINT_MINIMUM_INTERVAL_SECONDS;
  static int LOG_LEVEL;

  ServiceTracker(facebook::fb303::FacebookBase *handler,
                 void (*logMethod)(int, const std::string &)
                 = &ServiceTracker::defaultLogMethod,
                 bool featureCheckpoint = true,
                 bool featureStatusCheck = true,
                 bool featureThreadCheck = true,
                 Stopwatch::Unit stopwatchUnit
                 = Stopwatch::UNIT_MILLISECONDS);

  void setThreadManager(boost::shared_ptr<apache::thrift::concurrency::ThreadManager> threadManager);

private:

  facebook::fb303::FacebookBase *handler_;
  void (*logMethod_)(int, const std::string &);
  boost::shared_ptr<apache::thrift::concurrency::ThreadManager> threadManager_;

  bool featureCheckpoint_;
  bool featureStatusCheck_;
  bool featureThreadCheck_;
  Stopwatch::Unit stopwatchUnit_;

  apache::thrift::concurrency::Mutex statisticsMutex_;
  time_t checkpointTime_;
  uint64_t checkpointServices_;
  uint64_t checkpointDuration_;
  std::map<std::string, std::pair<uint64_t, uint64_t> > checkpointServiceDuration_;

  void startService(const ServiceMethod &serviceMethod);
  int64_t stepService(const ServiceMethod &serviceMethod,
                      const std::string &stepName);
  void finishService(const ServiceMethod &serviceMethod);
  void reportCheckpoint();
  static void defaultLogMethod(int level, const std::string &message);
};


class ServiceMethod
{
  friend class ServiceTracker;
public:
  ServiceMethod(ServiceTracker *tracker,
                const std::string &name,
                const std::string &signature,
                bool featureLogOnly = false);
  ServiceMethod(ServiceTracker *tracker,
                const std::string &name,
                uint64_t id,
                bool featureLogOnly = false);
  ~ServiceMethod();
  uint64_t step(const std::string &stepName);
private:
  ServiceTracker *tracker_;
  std::string name_;
  std::string signature_;
  bool featureLogOnly_;
  Stopwatch timer_;
};


class ServiceException : public std::exception
{
public:
  explicit ServiceException(const std::string &message, int code = 0)
    : message_(message), code_(code) {}
  ~ServiceException() throw() {}
  virtual const char *what() const throw() { return message_.c_str(); }
  int code() const throw() { return code_; }
private:
  std::string message_;
  int code_;
};


}} // facebook::fb303

#endif
