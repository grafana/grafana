#!/usr/bin/env python

#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

from twisted.application import internet, service
from thrift.transport import TTwisted

import glob
import sys
sys.path.append('gen-py.twisted')
sys.path.insert(0, glob.glob('../../lib/py/build/lib*')[0])
from tutorial import Calculator
from PythonServer import CalculatorHandler
from thrift.protocol import TBinaryProtocol


def make_application():
    application = service.Application('CalcServer')

    handler = CalculatorHandler()
    processor = Calculator.Processor(handler)

    serverFactory = TTwisted.ThriftServerFactory(
        processor,
        TBinaryProtocol.TBinaryProtocolFactory())

    calcService = internet.TCPServer(9090, serverFactory)

    multiService = service.MultiService()
    calcService.setServiceParent(multiService)
    multiService.setServiceParent(application)

    return application

if __name__ == '__main__':
    application = make_application()
