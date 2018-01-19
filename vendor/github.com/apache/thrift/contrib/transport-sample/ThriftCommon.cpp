// ThriftCommon.cpp : Common functions for sample Thrift client and server
//

#include "ThriftCommon.h"

namespace thriftcommon
{
	//----------------------------------------------------------------------------
	//Launch child process and pass R/W anonymous pipe handles on cmd line.
	//This is a simple example and does not include elevation or other 
	//advanced features.
	//
	bool LaunchAnonPipeChild(std::string app, boost::shared_ptr<TServerTransport> transport)
	{
#ifdef _WIN32
		PROCESS_INFORMATION pi;
		STARTUPINFOA si;
		GetStartupInfoA(&si);  //set startupinfo for the spawned process
		char handles[MAX_PATH];  //Stores pipe handles converted to text

		sprintf(handles, "%s %d %d", app.c_str(),
			(int)boost::shared_dynamic_cast<TPipeServer>(transport)->getClientRdPipeHandle(),
			(int)boost::shared_dynamic_cast<TPipeServer>(transport)->getClientWrtPipeHandle());

		//spawn the child process
		if (!CreateProcessA(NULL, handles, NULL,NULL,TRUE,0,NULL,NULL,&si,&pi))
		{
			GlobalOutput.perror("TPipeServer CreateProcess failed, GLE=", GetLastError());
			return false;
		}

		CloseHandle(pi.hThread);
		CloseHandle(pi.hProcess);
#endif
		return true;
	}
}
