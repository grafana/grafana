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

#include <cstdint>
#include <memory>

// helper functions to be included by C++ code for interacting with Cgo

// create_ref will construct a shared_ptr on the heap and return a pointer
// to it. the returned uintptr_t can then be used with retrieve_instance
// to get back the shared_ptr and object it refers to. This ensures that
// the object outlives the exported function so that Go can use it.
template <typename T>
uintptr_t create_ref(std::shared_ptr<T> t) {
    std::shared_ptr<T>* retained_ptr = new std::shared_ptr<T>(t);
    return reinterpret_cast<uintptr_t>(retained_ptr);
}

// retrieve_instance is used to get back the shared_ptr which was created with
// create_ref in order to use it in functions where the caller passes back the
// uintptr_t so that an object can be managed by C++ while a reference to it
// is passed around in C/CGO
template <typename T>
std::shared_ptr<T> retrieve_instance(uintptr_t ref) {
    std::shared_ptr<T>* retrieved_ptr = reinterpret_cast<std::shared_ptr<T>*>(ref);
    return *retrieved_ptr;
}

// release_ref deletes the shared_ptr that was created by create_ref, freeing the
// object if it was the last shared_ptr which referenced it as per normal smart_ptr
// rules.
template <typename T>
void release_ref(uintptr_t ref) {
    std::shared_ptr<T>* retrieved_ptr = reinterpret_cast<std::shared_ptr<T>*>(ref);
    delete retrieved_ptr;
}
