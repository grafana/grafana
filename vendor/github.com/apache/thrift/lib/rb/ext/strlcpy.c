/**
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

#include "strlcpy.h"

#ifndef HAVE_STRLCPY
#define HAVE_STRLCPY
size_t
strlcpy (char *dst, const char *src, size_t dst_sz)
{
    size_t n;

    for (n = 0; n < dst_sz; n++) {
      if ((*dst++ = *src++) == '\0')
        break;
    }

    if (n < dst_sz)
      return n;
    if (n > 0)
      *(dst - 1) = '\0';
    return n + strlen (src);
}
#endif

