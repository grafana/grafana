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

PERL_FIXUP_ROTATE=perl -i -pe 's/(ro[rl]\s+\w{2,3})$$/\1, 1/'
# since we're passing an int16, swap the MOVQ for the argument to a MOVW as per
# the message given by go vet since it's a 2-byte value.
PERL_FIXUP_MOVQ_MOVW=perl -i -pe 's/MOVQ rhs\+16\(FP\)/MOVW rhs+16(FP)/'
C2GOASM=c2goasm -a -f
CC=clang
C_FLAGS=-masm=intel -mno-red-zone -mstackrealign -mllvm -inline-threshold=1000 \
				-fno-asynchronous-unwind-tables -fno-exceptions -fno-rtti -O3 -fno-builtin -ffast-math -fno-jump-tables -I_lib
ASM_FLAGS_AVX2=-mavx2 -mfma
ASM_FLAGS_BMI2=-mbmi2
ASM_FLAGS_POPCNT=-mpopcnt

GO_SOURCES := $(shell find . -path ./_lib -prune -o -name '*.go' -not -name '*_test.go')
ALL_SOURCES := $(shell find . -path ./_lib -prune -o -name '*.go' -name '*.s' -not -name '*_test.go')

INTEL_SOURCES := \
	bitmap_bmi2.s

.PHONEY: assembly

assembly: $(INTEL_SOURCES)

_lib/bitmap_bmi2.s: _lib/bitmap_bmi2.c
	$(CC) -S $(ASM_FLAGS_AVX2) $(ASM_FLAGS_BMI2) $(ASM_FLAGS_POPCNT) $(C_FLAGS)  $^ -o $@ ; $(PERL_FIXUP_ROTATE) $@

bitmap_bmi2.s: _lib/bitmap_bmi2.s
	$(C2GOASM) $^ $@ ; $(PERL_FIXUP_MOVQ_MOVW) $@

clean:
	rm -f $(INTEL_SOURCES)
	rm -f _lib/$(INTEL_SOURCES)
