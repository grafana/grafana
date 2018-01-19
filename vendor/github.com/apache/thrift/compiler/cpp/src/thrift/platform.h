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
 * define for mkdir,since the method signature
 * is different for the non-POSIX MinGW
 */

#ifdef _MSC_VER
#include "thrift/windows/config.h"
#endif

#ifdef _WIN32
#include <direct.h>
#include <io.h>
#else
#include <sys/types.h>
#include <sys/stat.h>
#endif

#ifdef _WIN32
#define MKDIR(x) mkdir(x)
#else
#define MKDIR(x) mkdir(x, S_IRWXU | S_IRWXG | S_IRWXO)
#endif

#ifdef PATH_MAX
#define THRIFT_PATH_MAX PATH_MAX
#else
#define THRIFT_PATH_MAX MAX_PATH
#endif
