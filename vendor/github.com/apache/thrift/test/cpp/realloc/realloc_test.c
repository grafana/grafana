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

#define _GNU_SOURCE
#include <stdlib.h>
#include <stdio.h>
#include <time.h>
#include <dlfcn.h>

int copies;
int non_copies;

void *realloc(void *ptr, size_t size) {
  static void *(*real_realloc)(void*, size_t) = NULL;
  if (real_realloc == NULL) {
    real_realloc = (void* (*) (void*, size_t)) dlsym(RTLD_NEXT, "realloc");
  }

  void *ret_ptr = (*real_realloc)(ptr, size);

  if (ret_ptr == ptr) {
    non_copies++;
  } else {
    copies++;
  }

  return ret_ptr;
}


struct TMemoryBuffer {
  void* ptr;
  int size;
};

int main(int argc, char *argv[]) {
  int num_buffers;
  int init_size;
  int max_size;
  int doublings;
  int iterations;

  if (argc < 6 ||
      argc > 7 ||
      (num_buffers = atoi(argv[1])) == 0 ||
      (init_size = atoi(argv[2])) == 0 ||
      (max_size = atoi(argv[3])) == 0 ||
      init_size > max_size ||
      (iterations = atoi(argv[4])) == 0 ||
      (doublings = atoi(argv[5])) == 0 ||
      (argc == 7 && atoi(argv[6]) == 0)) {
    fprintf(stderr, "usage: realloc_test <num_buffers> <init_size> <max_size> <doublings> <iterations> [seed]\n");
    exit(EXIT_FAILURE);
  }

  for ( int i = 0 ; i < argc ; i++ ) {
    printf("%s ", argv[i]);
  }
  printf("\n");

  if (argc == 7) {
    srand(atoi(argv[6]));
  } else {
    srand(time(NULL));
  }

  struct TMemoryBuffer* buffers = calloc(num_buffers, sizeof(*buffers));
  if (buffers == NULL) abort();

  for ( int i = 0 ; i < num_buffers ; i++ ) {
    buffers[i].size = max_size;
  }

  while (iterations --> 0) {
    for ( int i = 0 ; i < doublings * num_buffers ; i++ ) {
      struct TMemoryBuffer* buf = &buffers[rand() % num_buffers];
      buf->size *= 2;
      if (buf->size <= max_size) {
        buf->ptr = realloc(buf->ptr, buf->size);
      } else {
        free(buf->ptr);
        buf->size = init_size;
        buf->ptr = malloc(buf->size);
      }
      if (buf->ptr == NULL) abort();
    }
  }

  printf("Non-copied %d/%d (%.2f%%)\n", non_copies, copies + non_copies, 100.0 * non_copies / (copies + non_copies));
  return 0;
}
