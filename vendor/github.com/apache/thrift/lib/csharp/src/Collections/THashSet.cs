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
using System.Collections.Generic;

#if SILVERLIGHT
using System.Runtime.Serialization;
#endif

namespace Thrift.Collections
{
#if SILVERLIGHT
    [DataContract]
#else
    [Serializable]
#endif
    public class THashSet<T> : ICollection<T>
    {
#if NET_2_0 || SILVERLIGHT
#if SILVERLIGHT
        [DataMember]
#endif
        TDictSet<T> set = new TDictSet<T>();
#else
        HashSet<T> set = new HashSet<T>();
#endif
        public int Count
        {
            get { return set.Count; }
        }

        public bool IsReadOnly
        {
            get { return false; }
        }

        public void Add(T item)
        {
            set.Add(item);
        }

        public void Clear()
        {
            set.Clear();
        }

        public bool Contains(T item)
        {
            return set.Contains(item);
        }

        public void CopyTo(T[] array, int arrayIndex)
        {
            set.CopyTo(array, arrayIndex);
        }

        public IEnumerator GetEnumerator()
        {
            return set.GetEnumerator();
        }

        IEnumerator<T> IEnumerable<T>.GetEnumerator()
        {
            return ((IEnumerable<T>)set).GetEnumerator();
        }

        public bool Remove(T item)
        {
            return set.Remove(item);
        }

#if NET_2_0 || SILVERLIGHT
#if SILVERLIGHT
        [DataContract]
#endif
        private class TDictSet<V> : ICollection<V>
        {
#if SILVERLIGHT
            [DataMember]
#endif
            Dictionary<V, TDictSet<V>> dict = new Dictionary<V, TDictSet<V>>();

            public int Count
            {
                get { return dict.Count; }
            }

            public bool IsReadOnly
            {
                get { return false; }
            }

            public IEnumerator GetEnumerator()
            {
                return ((IEnumerable)dict.Keys).GetEnumerator();
            }

            IEnumerator<V> IEnumerable<V>.GetEnumerator()
            {
                return dict.Keys.GetEnumerator();
            }

            public bool Add(V item)
            {
                if (!dict.ContainsKey(item))
                {
                    dict[item] = this;
                    return true;
                }

                return false;
            }

            void ICollection<V>.Add(V item)
            {
                Add(item);
            }

            public void Clear()
            {
                dict.Clear();
            }

            public bool Contains(V item)
            {
                return dict.ContainsKey(item);
            }

            public void CopyTo(V[] array, int arrayIndex)
            {
                dict.Keys.CopyTo(array, arrayIndex);
            }

            public bool Remove(V item)
            {
                return dict.Remove(item);
            }
        }
#endif
    }

}
