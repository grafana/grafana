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

// The java codegenerator has a few different codepaths depending
// on how many optionals the struct has; this attempts to exercise
// them.

namespace java thrift.test

struct Opt4 {
  1: i32 def1;
  2: i32 def2;
  3: i32 def3;
  4: i32 def4;
}

struct Opt13 {
  1: i32 def1;
  2: i32 def2;
  3: i32 def3;
  4: i32 def4;
  5: i32 def5;
  6: i32 def6;
  7: i32 def7;
  8: i32 def8;
  9: i32 def9;
  10: i32 def10;
  11: i32 def11;
  12: i32 def12;
  13: i32 def13;
}

struct Opt30 {
  1: i32 def1;
  2: i32 def2;
  3: i32 def3;
  4: i32 def4;
  5: i32 def5;
  6: i32 def6;
  7: i32 def7;
  8: i32 def8;
  9: i32 def9;
  10: i32 def10;
  11: i32 def11;
  12: i32 def12;
  13: i32 def13;
  14: i32 def14;
  15: i32 def15;
  16: i32 def16;
  17: i32 def17;
  18: i32 def18;
  19: i32 def19;
  20: i32 def20;
  21: i32 def21;
  22: i32 def22;
  23: i32 def23;
  24: i32 def24;
  25: i32 def25;
  26: i32 def26;
  27: i32 def27;
  28: i32 def28;
  29: i32 def29;
  30: i32 def30;
}

struct Opt64 {
  1: i32 def1;
  2: i32 def2;
  3: i32 def3;
  4: i32 def4;
  5: i32 def5;
  6: i32 def6;
  7: i32 def7;
  8: i32 def8;
  9: i32 def9;
  10: i32 def10;
  11: i32 def11;
  12: i32 def12;
  13: i32 def13;
  14: i32 def14;
  15: i32 def15;
  16: i32 def16;
  17: i32 def17;
  18: i32 def18;
  19: i32 def19;
  20: i32 def20;
  21: i32 def21;
  22: i32 def22;
  23: i32 def23;
  24: i32 def24;
  25: i32 def25;
  26: i32 def26;
  27: i32 def27;
  28: i32 def28;
  29: i32 def29;
  30: i32 def30;
  31: i32 def31;
  32: i32 def32;
  33: i32 def33;
  34: i32 def34;
  35: i32 def35;
  36: i32 def36;
  37: i32 def37;
  38: i32 def38;
  39: i32 def39;
  40: i32 def40;
  41: i32 def41;
  42: i32 def42;
  43: i32 def43;
  44: i32 def44;
  45: i32 def45;
  46: i32 def46;
  47: i32 def47;
  48: i32 def48;
  49: i32 def49;
  50: i32 def50;
  51: i32 def51;
  52: i32 def52;
  53: i32 def53;
  54: i32 def54;
  55: i32 def55;
  56: i32 def56;
  57: i32 def57;
  58: i32 def58;
  59: i32 def59;
  60: i32 def60;
  61: i32 def61;
  62: i32 def62;
  63: i32 def63;
  64: i32 def64;
}

struct Opt80 {
  1: i32 def1;
  2: i32 def2;
  3: i32 def3;
  4: i32 def4;
  5: i32 def5;
  6: i32 def6;
  7: i32 def7;
  8: i32 def8;
  9: i32 def9;
  10: i32 def10;
  11: i32 def11;
  12: i32 def12;
  13: i32 def13;
  14: i32 def14;
  15: i32 def15;
  16: i32 def16;
  17: i32 def17;
  18: i32 def18;
  19: i32 def19;
  20: i32 def20;
  21: i32 def21;
  22: i32 def22;
  23: i32 def23;
  24: i32 def24;
  25: i32 def25;
  26: i32 def26;
  27: i32 def27;
  28: i32 def28;
  29: i32 def29;
  30: i32 def30;
  31: i32 def31;
  32: i32 def32;
  33: i32 def33;
  34: i32 def34;
  35: i32 def35;
  36: i32 def36;
  37: i32 def37;
  38: i32 def38;
  39: i32 def39;
  40: i32 def40;
  41: i32 def41;
  42: i32 def42;
  43: i32 def43;
  44: i32 def44;
  45: i32 def45;
  46: i32 def46;
  47: i32 def47;
  48: i32 def48;
  49: i32 def49;
  50: i32 def50;
  51: i32 def51;
  52: i32 def52;
  53: i32 def53;
  54: i32 def54;
  55: i32 def55;
  56: i32 def56;
  57: i32 def57;
  58: i32 def58;
  59: i32 def59;
  60: i32 def60;
  61: i32 def61;
  62: i32 def62;
  63: i32 def63;
  64: i32 def64;
  65: i32 def65;
  66: i32 def66;
  67: i32 def67;
  68: i32 def68;
  69: i32 def69;
  70: i32 def70;
  71: i32 def71;
  72: i32 def72;
  73: i32 def73;
  74: i32 def74;
  75: i32 def75;
  76: i32 def76;
  77: i32 def77;
  78: i32 def78;
  79: i32 def79;
  80: i32 def80;
}

