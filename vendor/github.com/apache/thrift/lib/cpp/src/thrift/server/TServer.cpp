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

#ifdef HAVE_SYS_TIME_H
#include <sys/time.h>
#endif
#ifdef HAVE_SYS_RESOURCE_H
#include <sys/resource.h>
#endif

#ifdef HAVE_UNISTD_H
#include <unistd.h>
#endif

namespace apache {
namespace thrift {
namespace server {

#ifdef HAVE_SYS_RESOURCE_H
int increase_max_fds(int max_fds = (1 << 24)) {
  struct rlimit fdmaxrl;

  for (fdmaxrl.rlim_cur = max_fds, fdmaxrl.rlim_max = max_fds;
       max_fds && (setrlimit(RLIMIT_NOFILE, &fdmaxrl) < 0);
       fdmaxrl.rlim_cur = max_fds, fdmaxrl.rlim_max = max_fds) {
    max_fds /= 2;
  }

  return static_cast<int>(fdmaxrl.rlim_cur);
}
#endif
}
}
} // apache::thrift::server
