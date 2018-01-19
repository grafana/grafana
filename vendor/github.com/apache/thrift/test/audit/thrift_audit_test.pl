#!/usr/bin/perl -w

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


#break1 - Thrift method removed from service base
#break2 - Struct field changed in test_struct1(i16 to i32)
#break3 - Struct field changed in test_struct1(enum1 to enum2)
#break4 - Field type changed in test_struct1(bool to string)
#break5- member field type changed in test_struct1(bool to list<bool>)
#break6-  Field type changed in test_struct2 (list<double> to list<i16>)
#break7 - requiredness removed in struct6
#break8 - requiredness addedd in struct5
#break9 - Struct field removed from struct1
#break10 - Struct field removed from struct2 id = 1
#break11 - Struct field removed from struct3 last id
#break12 -  derived1_function1 return type changed from enum1 to enum2
#break13 - derived1_function6 return type changed from struct1 to struct2
#break14 -  derived1_function4 return type changed from string to double 
#break15 - derived2_function1 return type changed from list<i32> to list<i16>
#break16 - derived2_function5 return type changed from map<test_enum1,test_enum2> to map<test_enum3, test_enum2>
#break17 - derived2_function6 return type changed from map<struct1,struct2> to map<struct1, struct3>
#break18- oneway removed from base_oneway
#break19 - oneway added to base_function1
#break20 - first enum value removed from enum1
#break21- last enum value removed from enum2
#break22 - in-between enum value removed from enum1
#break23 - required struct field added to struct4
#break24 - removed inheritance of derived1.
#break25 - changed inheritance of derived2.
#break26 - Field type changed in base_function1 argument id=3
#break27 - argument changed base_function2 list<enum1> to list<enum3> id =8
#break28- derived1_function5 arguement type changed map<i64, double> to list<i64>
#break29 - base_function2 arguemnt type changed list<string> to string
#break30- derived1_function6 argument changed struct1 to map<struct1,struct1>
#break31 - Exception removed to base_function2
#break32- Exception1 field type changed for id =1
#break33 - derived1_function1 exception type changed.
#break34 - Field added to struct with Field ID being in between two existing field IDs

#warning.thrift
#Changing defaults
#Id=1 struct5
#id=2 struct5 
#id=4 struct2(list<double>)
#id=3 struct2(list<i64>  default values removed)
#id 4 struct1 change in double value
#id 5 struct1 (default string value removed)
#id=1 struct3 (change in map values)
#id2 struct3 (change in map keys)

#change in inheritance for derived1 and derived2

#change in struct field names
#id9 struct1
#id2 struct2

use strict;
use warnings;
use Getopt::Std;

# globals
my $gArguments = "";                # arguments that will be passed to AuditTool
my $gAuditToolPath = "";
my $gPreviousThriftPath;            # previous thrift path
my $gCurrentThriftPath;             # current thrift path
my $gThriftFileFolder;
my $gBreakingFilesCount =34; 

my $gVerbose = 0;
#functions
sub auditBreakingChanges;
sub auditNonBreakingChanges;

main();

sub main
{
    parseOptions();
    auditBreakingChanges();
    auditNonBreakingChanges();
}

sub parseOptions
{
    my %options = ();
    if ( getopts ('vf:o:t:',\%options) )
    {
        # current (new) thrift folder
        if ($options{'f'})
        {
            $gThriftFileFolder = $options{'f'};
            $gPreviousThriftPath = $gThriftFileFolder."/test.thrift";
        }
        else
        {
            die "Missing Folder containing thrift files\n";
        }

        if($options{'t'})
        {
            $gAuditToolPath = $options{'t'};
        }
        else
        {
            die "Audit Tool Path required \n";
        }

        if ($options{'v'})
        {
            $gVerbose = 1;
        }

    }
}

sub auditBreakingChanges
{
    my $breakingFileBaseName = $gThriftFileFolder."/break";
    my $newThriftFile;
    for(my $i=1; $i <= $gBreakingFilesCount; $i++)
    {
        $newThriftFile = $breakingFileBaseName."$i.thrift";
        my $arguments =  $gPreviousThriftPath." ".$newThriftFile;
        my ($exitCode, $output) = callThriftAuditTool($arguments);
        print $output if $gVerbose eq 1;

        if($exitCode == 1)
        {
            # thrift_audit returns 1 when it is not able to find files or other non-audit failures
            print "exiting with exit code =1 i = ".$i."\n";
            print $output;
            exit $exitCode;
        }
        if($exitCode != 2)
        {
            # thrift-audit return 2 for audit failures. So for Breaking changes we should get 2 as return value.
            print $output;
            die "\nTEST FAILURE: Breaking Change not detected for thrift file $newThriftFile, code=$exitCode \n";
        }
        if(index($output,getMessageSubString("break$i")) == -1)
        {
            #Audit tool detected failure, but not the expected one. The change in breaking thrift file does not match getMessageSubString()
            print $output;
            die "\nTest FAILURE: Audit tool detected failure, but not the expected one!\n";
        }
        else
        {
            #Thrift audit tool has detected audit failure and has returned exited to status code 2
            print "Test Pass: Audit Failure detected for thrift file break$i.thrift \n";
        }
    }

}

sub auditNonBreakingChanges
{
    my $breakingFileBaseName = $gThriftFileFolder."/warning";
    my $newThriftFile;
    $newThriftFile = $breakingFileBaseName.".thrift";
    my $arguments =  $gPreviousThriftPath." ".$newThriftFile;
    my ($exitCode, $output) = callThriftAuditTool($arguments);
    print $output if $gVerbose eq 1;

    if($exitCode == 1)
    {
        # thrift_audit returns 1 when it is not able to find files or other non-audit failures
        print "exiting with exit code = 1  for file warning.thrift\n";
        exit $exitCode;
    }
    elsif($exitCode != 0)
    {
        # thrift-audit return 0 if there are no audit failures.
        die "\nTEST FAILURE: Non Breaking changes returned failure for thrift file $newThriftFile \n";
    }
    else
    {
        #Thrift audit tool has exited with status 0. 
        print "Test Pass: Audit tool exits with success for warnings \n";
    }


}

# -----------------------------------------------------------------------------------------------------
# call thriftAuditTool script
sub callThriftAuditTool ( $ )
{
    my $args = shift;

    my $command = "$gAuditToolPath --audit $args";
    my $output = `$command 2>&1`;
    my $exitCode = $? >> 8;

    return ($exitCode,$output);
}

sub getMessageSubString( $ )
{
    my $fileName = shift;
    my %lookupTable = (
        "break1"  => "base_function3",
        "break2"  => "test_struct1",
        "break3"  => "test_struct1",
        "break4"  => "test_struct1",
        "break5"  => "test_struct1",
        "break6"  => "test_struct2",
        "break7"  => "test_struct6",
        "break8"  => "test_struct5",
        "break9"  => "test_struct1",
        "break10" => "test_struct2",
        "break11" => "test_struct3",
        "break12" => "derived1_function1",
        "break13" => "derived1_function6",
        "break14" => "derived1_function4",
        "break15" => "derived2_function1",
        "break16" => "derived2_function5",
        "break17" => "derived2_function6",
        "break18" => "base_oneway",
        "break19" => "base_function1",
        "break20" => "test_enum1",
        "break21" => "test_enum2",
        "break22" => "test_enum1",
        "break23" => "test_struct4",
        "break24" => "derived1",
        "break25" => "derived2",
        "break26" => "base_function1",
        "break27" => "base_function2_args",
        "break28" => "derived1_function5_args",
        "break29" => "base_function2_args",
        "break30" => "derived1_function6",
        "break31" => "base_function2_exception",
        "break32" => "test_exception1",
        "break33" => "derived1_function1_exception",
        "break34" => "test_struct3",
    );
    if (not exists $lookupTable{ $fileName })
    {
        print "in the null case\n";
        return "NULL";
    }
    
    my $retval = $lookupTable{ $fileName };
    print "$fileName => $retval\n";
    return $lookupTable{ $fileName };
}
