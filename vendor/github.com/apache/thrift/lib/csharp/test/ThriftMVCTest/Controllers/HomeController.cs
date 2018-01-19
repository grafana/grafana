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
using System.Threading.Tasks;
using System.Web.Mvc;
using Thrift.Protocol;
using Thrift.Test;
using Thrift.Transport;

namespace ThriftMVCTest.Controllers
{
    public class HomeController : Controller
    {
        public ActionResult Index()
        {
            return View();
        }

        public async Task<ActionResult> TestThriftAsync()
        {
            var baseUri = new Uri(string.Format("{0}://{1}{2}", Request.Url.Scheme, Request.Url.Authority,
                Url.Content("~")));

            SecondService.IAsync asyncService =
                new SecondService.Client(new TBinaryProtocol(new THttpClient(new Uri(baseUri, "Async.thrift"))));

            await asyncService.blahBlahAsync();
            var result = await asyncService.secondtestStringAsync("TestString");
            if (result != "TestString")
            {
                throw new Exception("The wrong result was returned");
            }

            return RedirectToAction("Index");
        }

        public ActionResult TestThriftSync()
        {
            var baseUri = new Uri(string.Format("{0}://{1}{2}", Request.Url.Scheme, Request.Url.Authority,
                Url.Content("~")));

            SecondService.ISync service =
                new SecondService.Client(new TBinaryProtocol(new THttpClient(new Uri(baseUri, "Sync.thrift"))));

            service.blahBlah();
            var result = service.secondtestString("TestString");
            if (result != "TestString")
            {
                throw new Exception("The wrong result was returned");
            }

            return RedirectToAction("Index");
        }
    }
}