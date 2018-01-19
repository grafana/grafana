/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements. See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership. The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License. You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied. See the License for the
 specific language governing permissions and limitations
 under the License.

*/

$.getJSON('results.json', function(results) {
    $(document).ready(function() {
        var transport = 3;
        var socket = 4;
        var success = 5;
        var expected = 6;
        var returnCode = 7;
        var logFile = 8;
        testTable = $('#test_results').DataTable({
            data: results['results'],
            columnDefs: [
                {
                    targets: 3,
                    render: function(data, type, row) {
                        return row[transport] + '-' + row[socket];
                    },
                },
                {
                    targets: 4,
                    render: function(data, type, row) {
                        return (row[success] ? 'success' : 'failure')
                                + '(' + (row[returnCode] == 128 ? 'timeout' : row[returnCode]) + ')'
                                + '(<a href="' + row[logFile].server + '">Server</a>, '
                                + '<a href="' + row[logFile].client + '">Client</a>)';
                    },
                },
                {
                    targets: 5,
                    render: function(data, type, row) {
                        // 'yes' rather than 'expected' to ease search
                        return row[expected] ? 'yes' : 'unexpected';
                    },
                }
            ],
        });
        $('#test_results_filter label input').focus().val('unexpected failure');
        $('#test_info').text(
            "Test Date:     " + results['date'] + "\n" +
            "Revision:      " + results['revision'] + "\n" +
            "Platform:      " + results['platform'] + "\n" +
            "Test duration: " + results['duration']) + " seconds";
    });
});

