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

// +build ccalloc

#include "allocator.h"
#include "arrow/memory_pool.h"
#include "helpers.h"

struct mem_holder {
    std::unique_ptr<arrow::MemoryPool> owned_pool;    
    arrow::MemoryPool* pool;
};

ArrowMemoryPool arrow_create_memory_pool(bool enable_logging) {
    auto holder = std::make_shared<mem_holder>();    
    if (enable_logging) {        
        holder->owned_pool.reset(new arrow::LoggingMemoryPool(arrow::default_memory_pool()));
        holder->pool = holder->owned_pool.get();
    } else {
        holder->pool = arrow::default_memory_pool();
    }

    return create_ref(holder);
}

void arrow_release_pool(ArrowMemoryPool pool) {
    release_ref<mem_holder>(pool);
}

int arrow_pool_allocate(ArrowMemoryPool pool, int64_t size, uint8_t** out) {
    auto holder = retrieve_instance<mem_holder>(pool);
    auto status = holder->pool->Allocate(size, out);
    if (!status.ok()) {
        return 1;
    }
    return 0;
}

void arrow_pool_free(ArrowMemoryPool pool, uint8_t* buffer, int64_t size) {
    auto holder = retrieve_instance<mem_holder>(pool);
    holder->pool->Free(buffer, size);
}

int arrow_pool_reallocate(ArrowMemoryPool pool, int64_t old_size, int64_t new_size, uint8_t** ptr) {
    auto holder = retrieve_instance<mem_holder>(pool);
    auto status = holder->pool->Reallocate(old_size, new_size, ptr);
    if (!status.ok()) {
        return 1;
    }
    return 0;
}

int64_t arrow_pool_bytes_allocated(ArrowMemoryPool pool) {
    auto holder = retrieve_instance<mem_holder>(pool);
    return holder->pool->bytes_allocated();
}
