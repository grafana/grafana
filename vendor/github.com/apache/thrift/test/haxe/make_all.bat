@echo off
rem /*
rem  * Licensed to the Apache Software Foundation (ASF) under one
rem  * or more contributor license agreements. See the NOTICE file
rem  * distributed with this work for additional information
rem  * regarding copyright ownership. The ASF licenses this file
rem  * to you under the Apache License, Version 2.0 (the
rem  * "License"); you may not use this file except in compliance
rem  * with the License. You may obtain a copy of the License at
rem  *
rem  *   http://www.apache.org/licenses/LICENSE-2.0
rem  *
rem  * Unless required by applicable law or agreed to in writing,
rem  * software distributed under the License is distributed on an
rem  * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
rem  * KIND, either express or implied. See the License for the
rem  * specific language governing permissions and limitations
rem  * under the License.
rem  */

setlocal
if "%HOMEDRIVE%"=="" goto MISSINGVARS
if "%HOMEPATH%"=="" goto MISSINGVARS
if "%HAXEPATH%"=="" goto NOTINSTALLED

set path=%HAXEPATH%;%HAXEPATH%\..\neko;%path%

rem # invoke Thrift comnpiler
thrift -r -gen haxe   ..\ThriftTest.thrift
if errorlevel 1 goto STOP

rem # invoke Haxe compiler for all targets
for %%a in (*.hxml) do (
	rem * filter Python, as it is not supported by Haxe 3.1.3 (but will be in 3.1.4)
	if not "%%a"=="python.hxml" (
		echo --------------------------
		echo Building %%a ...
		echo --------------------------
		haxe  --cwd .  %%a
	)
)


echo.
echo done.
pause
goto eof

:NOTINSTALLED
echo FATAL: Either Haxe is not installed, or the HAXEPATH variable is not set.
pause
goto eof

:MISSINGVARS
echo FATAL: Unable to locate home folder.
echo.
echo Both HOMEDRIVE and HOMEPATH need to be set to point to your Home folder.
echo The current values are:
echo HOMEDRIVE=%HOMEDRIVE%
echo HOMEPATH=%HOMEPATH%
pause
goto eof

:STOP
pause
goto eof

:eof
