// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

#pragma once

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef uintptr_t ArrowMemoryPool;

ArrowMemoryPool arrow_create_memory_pool(bool enable_logging);
int arrow_pool_allocate(ArrowMemoryPool pool, int64_t size, uint8_t** out);
int arrow_pool_reallocate(ArrowMemoryPool pool, int64_t old_size, int64_t new_size, uint8_t** ptr);
void arrow_pool_free(ArrowMemoryPool pool, uint8_t* buffer, int64_t size);
int64_t arrow_pool_bytes_allocated(ArrowMemoryPool pool);
void arrow_release_pool(ArrowMemoryPool pool);


#ifdef __cplusplus
}
#endif
