<!---
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->

# Package cpu

Copied from Go src/internal/cpu

## Extras

### Intel

The `INTEL_DISABLE_EXT` environment variable can control which CPU extensions are available for
the running process. It should be a comma-separate list of upper-case strings as follows

|   Flag   | Description |
| -------- | ----------- |
| `ALL`    | Disable all CPU extensions and fall back to Go implementation |
| `AVX2`   | Disable AVX2 optimizations |  
| `AVX`    | Disable AVX optimizations |  
| `SSE`    | Disable all SSE optimizations |  
| `SSE4`   | Disable SSE42, SSE41 optimizations |  
| `SSSE3`  | Disable supplemental SSE3 optimizations |  
| `SSE3`   | Disable SSE3 optimizations |  
| `SSE2`   | Disable SSE2 optimizations |

Any unrecognized flags will be ignored and therefore it is possible to leave the environment variable with a bogus value such as `NONE` when experimenting.