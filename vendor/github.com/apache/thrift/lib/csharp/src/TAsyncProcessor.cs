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

using System.Threading.Tasks;
using Thrift.Protocol;

namespace Thrift
{
    /// <summary>
    /// Processes a message asynchronously.
    /// </summary>
    public interface TAsyncProcessor
    {
        /// <summary>
        /// Processes the next part of the message.
        /// </summary>
        /// <param name="iprot">The input protocol.</param>
        /// <param name="oprot">The output protocol.</param>
        /// <returns>true if there's more to process, false otherwise.</returns>
        Task<bool> ProcessAsync(TProtocol iprot, TProtocol oprot);
    }
}
