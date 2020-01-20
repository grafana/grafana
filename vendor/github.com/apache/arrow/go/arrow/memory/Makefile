# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

GO_BUILD=go build
GO_GEN=go generate
GO_TEST=go test
GOPATH=$(realpath ../../../..)

# this converts rotate instructions from "ro[lr] <reg>" -> "ro[lr] <reg>, 1" for yasm compatibility
PERL_FIXUP_ROTATE=perl -i -pe 's/(ro[rl]\s+\w{2,3})$$/\1, 1/'

C2GOASM=c2goasm -a -f
CC=clang
C_FLAGS=-target x86_64-unknown-none -masm=intel -mno-red-zone -mstackrealign -mllvm -inline-threshold=1000 -fno-asynchronous-unwind-tables \
	-fno-exceptions -fno-rtti -O3 -fno-builtin -ffast-math -fno-jump-tables -I_lib
ASM_FLAGS_AVX2=-mavx2 -mfma -mllvm -force-vector-width=32
ASM_FLAGS_SSE3=-msse3
ASM_FLAGS_SSE4=-msse4

GO_SOURCES  := $(shell find . -path ./_lib -prune -o -name '*.go' -not -name '*_test.go')
ALL_SOURCES := $(shell find . -path ./_lib -prune -o -name '*.go' -name '*.s' -not -name '*_test.go')

INTEL_SOURCES := \
	memory_avx2_amd64.s memory_sse4_amd64.s

.PHONEY: assembly

assembly: $(INTEL_SOURCES)

_lib/memory_avx2.s: _lib/memory.c
	$(CC) -S $(C_FLAGS) $(ASM_FLAGS_AVX2) $^ -o $@ ; $(PERL_FIXUP_ROTATE) $@

_lib/memory_sse4.s: _lib/memory.c
	$(CC) -S $(C_FLAGS) $(ASM_FLAGS_SSE4) $^ -o $@ ; $(PERL_FIXUP_ROTATE) $@

memory_avx2_amd64.s: _lib/memory_avx2.s
	$(C2GOASM) -a -f $^ $@

memory_sse4_amd64.s: _lib/memory_sse4.s
	$(C2GOASM) -a -f $^ $@

