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


#TODO: Should we bundle system libraries for DLLs?
#include(InstallRequiredSystemLibraries)

# For help take a look at:
# http://www.cmake.org/Wiki/CMake:CPackConfiguration

### general settings
set(CPACK_PACKAGE_NAME "thrift")
set(CPACK_PACKAGE_VERSION "${PACKAGE_VERSION}")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Apache Thrift")
set(CPACK_PACKAGE_DESCRIPTION_FILE "${CMAKE_CURRENT_SOURCE_DIR}/README.md")
set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_CURRENT_SOURCE_DIR}/LICENSE")
set(CPACK_PACKAGE_VENDOR "Apache Software Foundation")
set(CPACK_PACKAGE_CONTACT "dev@thrift.apache.org")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "${CPACK_PACKAGE_NAME}")
set(CPACK_SYSTEM_NAME "${CMAKE_SYSTEM_NAME}")

### versions
set(CPACK_PACKAGE_VERSION_MAJOR ${thrift_VERSION_MAJOR})
set(CPACK_PACKAGE_VERSION_MINOR ${thrift_VERSION_MINOR})
set(CPACK_PACKAGE_VERSION_PATCH ${thrift_VERSION_PATCH})

### source generator
set(CPACK_SOURCE_GENERATOR "TGZ")
set(CPACK_SOURCE_IGNORE_FILES "~$;[.]swp$;/[.]svn/;/[.]git/;.gitignore;/build/;tags;cscope.*")
set(CPACK_SOURCE_PACKAGE_FILE_NAME "${CPACK_PACKAGE_NAME}-${CPACK_PACKAGE_VERSION}")

### zip generator
set(CPACK_GENERATOR "ZIP")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "thrift")


if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
    set(CPACK_GENERATOR "NSIS")
    set(CPACK_NSIS_HELP_LINK "http://thrift.apache.org")
    set(CPACK_NSIS_MENU_LINKS
        "http://thrift.apache.org" "Apache Thrift - Web Site"
        "https://issues.apache.org/jira/browse/THRIFT" "Apache Thrift - Issues")
    set(CPACK_NSIS_CONTACT ${CPACK_PACKAGE_CONTACT})
    set(CPACK_NSIS_MODIFY_PATH "ON")
    set(CPACK_PACKAGE_INSTALL_DIRECTORY "${CPACK_PACKAGE_NAME}")
else()
    set(CPACK_GENERATOR "DEB" )
    set(CPACK_DEBIAN_PACKAGE_MAINTAINER ${CPACK_PACKAGE_CONTACT})
endif()


include(CPack)
