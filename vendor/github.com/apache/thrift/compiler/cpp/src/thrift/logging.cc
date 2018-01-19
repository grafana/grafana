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
 * Logging functions copied from main.cc to avoid link errors for plugins
 */

#include "thrift/logging.h"
#include "thrift/globals.h"
#include <cstdarg>
#include <cstdio>
#include <cstdlib>

// TODO: make plugins accept log options from main compiler
int g_debug = 0;
int g_warn = 1;
int g_verbose = 0;

void pdebug(const char* fmt, ...) {
  if (g_debug == 0) {
    return;
  }
  va_list args;
  // printf("[PARSE:%d] ", yylineno);
  va_start(args, fmt);
  vprintf(fmt, args);
  va_end(args);
  printf("\n");
}

void pverbose(const char* fmt, ...) {
  if (g_verbose == 0) {
    return;
  }
  va_list args;
  va_start(args, fmt);
  vprintf(fmt, args);
  va_end(args);
}

void pwarning(int level, const char* fmt, ...) {
  if (g_warn < level) {
    return;
  }
  va_list args;
  // printf("[WARNING:%s:%d] ", g_curpath.c_str(), yylineno);
  va_start(args, fmt);
  vprintf(fmt, args);
  va_end(args);
  printf("\n");
}

void failure(const char* fmt, ...) {
  va_list args;
  // fprintf(stderr, "[FAILURE:%s:%d] ", g_curpath.c_str(), yylineno);
  va_start(args, fmt);
  vfprintf(stderr, fmt, args);
  va_end(args);
  printf("\n");
  exit(1);
}
