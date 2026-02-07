@ECHO OFF
setlocal

set GOARCH=amd64

cd %~dp0
md artifacts

echo Windows
set GOOS=windows
call go build -o artifacts\jsonmerge.exe .\cmd || goto :error

echo Linux
set GOOS=linux
call go build -o artifacts\jsonmerge .\cmd || goto :error

echo Darwin
set GOOS=darwin
call go build -o artifacts\jsonmerge_darwin .\cmd || goto :error

echo Build done
exit

:error
exit /b %errorlevel%
