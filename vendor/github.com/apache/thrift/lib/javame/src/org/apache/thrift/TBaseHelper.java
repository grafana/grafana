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
package org.apache.thrift;

import java.util.Vector;
import java.util.Hashtable;
import java.util.Enumeration;

public class TBaseHelper {

    public static int compareTo(boolean a, boolean b) {
         return (a == b) ? 0 : (a ? 1 : -1);
    

    }
     public static int compareTo(Boolean a, Boolean b) {
         return (a.booleanValue() == b.booleanValue()) ? 0 : (a.booleanValue() ? 1 : -1);


    }
     public static int compareTo(Boolean a, boolean b) {
         return (a.booleanValue() == b) ? 0 : (a.booleanValue() ? 1 : -1);


    }

    public static Boolean booleanValueOf(boolean b) {
        return (b ? Boolean.TRUE : Boolean.FALSE);
    }

    public static int compareTo(byte a, byte b) {
        if (a < b) {
            return -1;
        } else if (b < a) {
            return 1;
        } else {
            return 0;
        }
    }

    public static int compareTo(short a, short b) {
        if (a < b) {
            return -1;
        } else if (b < a) {
            return 1;
        } else {
            return 0;
        }
    }

    public static int compareTo(int a, int b) {
        if (a < b) {
            return -1;
        } else if (b < a) {
            return 1;
        } else {
            return 0;
        }
    }

    public static int compareTo(long a, long b) {
        if (a < b) {
            return -1;
        } else if (b < a) {
            return 1;
        } else {
            return 0;
        }
    }

    public static int compareTo(double a, double b) {
        if (a < b) {
            return -1;
        } else if (b < a) {
            return 1;
        } else {
            return 0;
        }
    }

    public static int compareTo(String a, String b) {
        return a.compareTo(b);
    }

    public static int compareTo(byte[] a, byte[] b) {
        int sizeCompare = compareTo(a.length, b.length);
        if (sizeCompare != 0) {
            return sizeCompare;
        }
        for (int i = 0; i < a.length; i++) {
            int byteCompare = compareTo(a, b);
            if (byteCompare != 0) {
                return byteCompare;
            }
        }
        return 0;
    }

    public static int compareTo(Object a, Object b) {
        if (a instanceof Vector) {
            return compareTo((Vector)a, (Vector)b);
        } if (a instanceof Hashtable) {
            return compareTo((Hashtable)a, (Hashtable)b);
        } else {
            return ((TBase)a).compareTo(b);
        }
    }

    public static int compareTo(Vector a, Vector b) {
        int lastComparison = compareTo(a.size(), b.size());
        if (lastComparison != 0) {
            return lastComparison;
        }
        for (int i = 0; i < a.size(); i++) {
            Object oA = a.elementAt(i);
            Object oB = b.elementAt(i);
            lastComparison = compareTo(oA, oB);
            if (lastComparison != 0) {
                return lastComparison;
            }

        }
        return 0;
    }

    public static int compareTo(Hashtable a, Hashtable b) {
        int lastComparison = compareTo(a.size(), b.size());
        if (lastComparison != 0) {
            return lastComparison;
        }
        Enumeration enumA = a.keys();
        Enumeration enumB = b.keys();
        while (lastComparison == 0 && enumA.hasMoreElements()) {
            Object keyA = enumA.nextElement();
            Object keyB = enumB.nextElement();
            lastComparison = compareTo(keyA, keyB);
            if (lastComparison == 0) {
                lastComparison = compareTo(a.get(keyA), b.get(keyB));
            }
        }
        return lastComparison;
    }

    public static int compareTo(TEnum a, TEnum b) {
        return compareTo(a.getValue(), b.getValue());
    }

    /*
    public static int compareTo(List a, List b) {
        int lastComparison = compareTo(a.size(), b.size());
        if (lastComparison != 0) {
            return lastComparison;
        }
        for (int i = 0; i < a.size(); i++) {
            Object oA = a.get(i);
            Object oB = b.get(i);
            if (oA instanceof List) {
                lastComparison = compareTo((List) oA, (List) oB);
            } else {
                lastComparison = compareTo((Comparable) oA, (Comparable) oB);
            }
            if (lastComparison != 0) {
                return lastComparison;
            }
        }
        return 0;
    }
     */

  public static void toString(byte[] bytes, StringBuffer sb) {
    toString(bytes, 0, bytes.length, sb);
  }

  public static void toString(byte[] buf, int arrayOffset, int origLimit, StringBuffer sb) {
    int limit = (origLimit - arrayOffset > 128) ? arrayOffset + 128 : origLimit;

    for (int i = arrayOffset; i < limit; i++) {
      if (i > arrayOffset) {
        sb.append(" ");
      }
      sb.append(paddedByteString(buf[i]));
    }
    if (origLimit != limit) {
      sb.append("...");
    }
  }

  public static String paddedByteString(byte b) {
    int extended = (b | 0x100) & 0x1ff;
    return Integer.toHexString(extended).toUpperCase().substring(1);
  }

}
