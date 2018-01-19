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
using System;
using System.Collections;

namespace Thrift.Collections
{
    public class TCollections
    {
        /// <summary>
        /// This will return true if the two collections are value-wise the same.
        /// If the collection contains a collection, the collections will be compared using this method.
        /// </summary>
        public static bool Equals (IEnumerable first, IEnumerable second)
        {
            if (first == null && second == null)
            {
                return true;
            }
            if (first == null || second == null)
            {
                return false;
            }
            IEnumerator fiter = first.GetEnumerator ();
            IEnumerator siter = second.GetEnumerator ();

            bool fnext = fiter.MoveNext ();
            bool snext = siter.MoveNext ();
            while (fnext && snext)
            {
                IEnumerable fenum = fiter.Current as IEnumerable;
                IEnumerable senum = siter.Current as IEnumerable;
                if (fenum != null && senum != null)
                {
                    if (!Equals(fenum, senum))
                    {
                        return false;
                    }
                }
                else if (fenum == null ^ senum == null)
                {
                    return false;
                }
                else if (!Equals(fiter.Current, siter.Current))
                {
                    return false;
                }
                fnext = fiter.MoveNext();
                snext = siter.MoveNext();
            }

            return fnext == snext;
        }

        /// <summary>
        /// This returns a hashcode based on the value of the enumerable.
        /// </summary>
        public static int GetHashCode (IEnumerable enumerable)
        {
            if (enumerable == null)
            {
                return 0;
            }

            int hashcode = 0;
            foreach (Object obj in enumerable)
            {
                IEnumerable enum2 = obj as IEnumerable;
                int objHash = enum2 == null ? obj.GetHashCode () : GetHashCode (enum2);
                unchecked
                {
                    hashcode = (hashcode * 397) ^ (objHash);
                }
            }
            return hashcode;
        }
    }
}