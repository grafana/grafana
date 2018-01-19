
#include <cassert>
#include <stdlib.h>
#include <stdio.h>
#include <stdarg.h>
#include <time.h>
#include <string>
#include <algorithm>
#include <sys/types.h>
#include <sys/stat.h>
#include <errno.h>
#include <limits.h>

// Careful: must include globals first for extern definitions
#include "thrift/globals.h"

#include "thrift/parse/t_program.h"
#include "thrift/parse/t_scope.h"
#include "thrift/parse/t_const.h"
#include "thrift/parse/t_field.h"

#include "thrift/version.h"

#include "thrift/audit/t_audit.h"

extern int g_warn;
extern std::string g_curpath;
extern bool g_return_failure;

void thrift_audit_warning(int level, const char* fmt, ...) {
   if (g_warn < level) {
      return;
   }
   va_list args;
   printf("[Thrift Audit Warning:%s] ", g_curpath.c_str());
   va_start(args, fmt);
   vprintf(fmt, args);
   va_end(args);
   printf("\n");
}

void thrift_audit_failure(const char* fmt, ...) {
  va_list args;
  fprintf(stderr, "[Thrift Audit Failure:%s] ", g_curpath.c_str());
  va_start(args, fmt);
  vfprintf(stderr, fmt, args);
  va_end(args);
  fprintf(stderr, "\n");
  g_return_failure = true;
}

void compare_namespace(t_program* newProgram, t_program* oldProgram)
{
   const std::map<std::string, std::string>& newNamespaceMap = newProgram->get_all_namespaces();
   const std::map<std::string, std::string>& oldNamespaceMap = oldProgram->get_all_namespaces();

   for(std::map<std::string, std::string>::const_iterator oldNamespaceMapIt = oldNamespaceMap.begin();
         oldNamespaceMapIt != oldNamespaceMap.end();
         oldNamespaceMapIt++)
   {
      std::map<std::string, std::string>::const_iterator newNamespaceMapIt = newNamespaceMap.find(oldNamespaceMapIt->first);
      if(newNamespaceMapIt == newNamespaceMap.end())
      {
         thrift_audit_warning(1, "Language %s not found in new thrift file\n", (oldNamespaceMapIt->first).c_str());
      }
      else if((newNamespaceMapIt->second) != oldNamespaceMapIt->second)
      {
         thrift_audit_warning(1, "Namespace %s changed in new thrift file\n", (oldNamespaceMapIt->second).c_str());
      }
   }
}

void compare_enum_values(t_enum* newEnum,t_enum* oldEnum)
{
   const std::vector<t_enum_value*>& oldEnumValues = oldEnum->get_constants();
   for(std::vector<t_enum_value*>::const_iterator oldEnumValuesIt = oldEnumValues.begin();
         oldEnumValuesIt != oldEnumValues.end();
         oldEnumValuesIt++)
   {
      int enumValue = (*oldEnumValuesIt)->get_value();
      t_enum_value* newEnumValue = newEnum->get_constant_by_value(enumValue);
      if(newEnumValue != NULL)
      {
         std::string enumName = (*oldEnumValuesIt)->get_name();
         if(enumName != newEnumValue->get_name())
         {
            thrift_audit_warning(1, "Name of the value %d changed in enum %s\n", enumValue, oldEnum->get_name().c_str());
         }
      }
      else
      {
         thrift_audit_failure("Enum value %d missing in %s\n", enumValue, oldEnum->get_name().c_str());
      }

   }
}

void compare_enums(const std::vector<t_enum*>& newEnumList, const std::vector<t_enum*>& oldEnumList)
{
   std::map<std::string,t_enum*> newEnumMap;
   std::vector<t_enum*>::const_iterator newEnumIt;
   for(newEnumIt = newEnumList.begin(); newEnumIt != newEnumList.end(); newEnumIt++)
   {
      newEnumMap[(*newEnumIt)->get_name()] = *newEnumIt;
   }
   std::vector<t_enum*>::const_iterator oldEnumIt;
   for(oldEnumIt = oldEnumList.begin(); oldEnumIt != oldEnumList.end(); oldEnumIt++)
   {
      std::map<std::string,t_enum*>::iterator newEnumMapIt;
      newEnumMapIt = newEnumMap.find((*oldEnumIt)->get_name());

      if(newEnumMapIt == newEnumMap.end())
      {
         thrift_audit_warning(1, "Enum %s not found in new thrift file\n",(*oldEnumIt)->get_name().c_str());
      }
      else
      {
         compare_enum_values(newEnumMapIt->second, *oldEnumIt);
      }
   }
}

//This function returns 'true' if the two arguements are of same types.
//Returns false if they are of different type
bool compare_type(t_type* newType, t_type* oldType)
{
   //Comparing names of two types will work when the newType and oldType are basic types or structs or enums.
   //However, when they are containers, get_name() returns empty for which we have to compare the type of
   //their elements as well.
   if((newType->get_name()).empty() && (oldType->get_name()).empty())
   {

      if(newType->is_list() && oldType->is_list())
      {
         t_type* newElementType = ((t_list*)newType)->get_elem_type();
         t_type* oldElementType = ((t_list*)oldType)->get_elem_type();
         return compare_type(newElementType, oldElementType);
      }
      else if(newType->is_map() && oldType->is_map())
      {
         t_type* newKeyType = ((t_map*)newType)->get_key_type();
         t_type* oldKeyType = ((t_map*)oldType)->get_key_type();

         t_type* newValType = ((t_map*)newType)->get_val_type();
         t_type* oldValType = ((t_map*)oldType)->get_val_type();

         return (compare_type(newKeyType, oldKeyType) && compare_type(newValType, oldValType));
      }
      else if(newType->is_set() && oldType->is_set())
      {
         t_type* newElementType = ((t_set*)newType)->get_elem_type();
         t_type* oldElementType = ((t_set*)oldType)->get_elem_type();
         return compare_type(newElementType, oldElementType);
      }
      else
      {
         return false;
      }
   }
   else if(newType->get_name() == oldType->get_name())
   {
      return true;
   }
   else
   {
      return false;
   }
}

bool compare_pair(std::pair<t_const_value*, t_const_value*> newMapPair, std::pair<t_const_value*, t_const_value*> oldMapPair)
{
   return compare_defaults(newMapPair.first, oldMapPair.first) && compare_defaults(newMapPair.second, oldMapPair.second);
}

// This function returns 'true' if the default values are same. Returns false if they are different.
bool compare_defaults(t_const_value* newStructDefault, t_const_value* oldStructDefault)
{
   if(newStructDefault == NULL && oldStructDefault == NULL) return true;
   else if(newStructDefault == NULL && oldStructDefault != NULL) return false;
   else if (newStructDefault != NULL && oldStructDefault == NULL) return false;

   if(newStructDefault->get_type() != oldStructDefault->get_type())
   {
      return false;
   }

   switch(newStructDefault->get_type())
   {
      case t_const_value::CV_INTEGER:
         return (newStructDefault->get_integer() == oldStructDefault->get_integer());
      case t_const_value::CV_DOUBLE:
         return (newStructDefault->get_double() == oldStructDefault->get_double());
      case t_const_value::CV_STRING:
         return (newStructDefault->get_string() == oldStructDefault->get_string());
      case t_const_value::CV_LIST:
         {
            const std::vector<t_const_value*>& oldDefaultList = oldStructDefault->get_list();
            const std::vector<t_const_value*>& newDefaultList = newStructDefault->get_list();
            bool defaultValuesCompare = (oldDefaultList.size() == newDefaultList.size());

            return defaultValuesCompare && std::equal(newDefaultList.begin(), newDefaultList.end(), oldDefaultList.begin(), compare_defaults);
         }
      case t_const_value::CV_MAP:
         {
            const std::map<t_const_value*, t_const_value*> newMap = newStructDefault->get_map();
            const std::map<t_const_value*, t_const_value*> oldMap = oldStructDefault->get_map();

            bool defaultValuesCompare = (oldMap.size() == newMap.size());

            return defaultValuesCompare && std::equal(newMap.begin(), newMap.end(), oldMap.begin(), compare_pair);
         }
      case t_const_value::CV_IDENTIFIER:
         return (newStructDefault->get_identifier() == oldStructDefault->get_identifier());
      default:
         return false;
   }

}

void compare_struct_field(t_field* newField, t_field* oldField, std::string oldStructName)
{
   t_type* newFieldType = newField->get_type();
   t_type* oldFieldType = oldField->get_type();
   if(!compare_type(newFieldType, oldFieldType))
   {
      thrift_audit_failure("Struct Field Type Changed for Id = %d in %s \n", newField->get_key(), oldStructName.c_str());
   }

   // A Struct member can be optional if it is mentioned explicitly, or if it is assigned with default values.
   bool newStructFieldOptional = (newField->get_req() != t_field::T_REQUIRED);
   bool oldStructFieldOptional = (oldField->get_req() != t_field::T_REQUIRED);

   if(newStructFieldOptional != oldStructFieldOptional)
   {
      thrift_audit_failure("Struct Field Requiredness Changed for Id = %d in %s \n", newField->get_key(), oldStructName.c_str());
   }
   if(newStructFieldOptional || oldStructFieldOptional)
   {
      if(!compare_defaults(newField->get_value(), oldField->get_value()))
      {
         thrift_audit_warning(1, "Default value changed for Id = %d in %s \n", newField->get_key(), oldStructName.c_str());
      }
   }

   std::string fieldName = newField->get_name();
   if(fieldName != oldField->get_name())
   {
      thrift_audit_warning(1, "Struct field name changed for Id = %d in %s\n", newField->get_key(), oldStructName.c_str());
   }

}

void compare_single_struct(t_struct* newStruct, t_struct* oldStruct, const std::string& oldStructName = std::string())
{
   std::string structName = oldStructName.empty() ? oldStruct->get_name() : oldStructName;
   const std::vector<t_field*>& oldStructMembersInIdOrder = oldStruct->get_sorted_members();
   const std::vector<t_field*>& newStructMembersInIdOrder = newStruct->get_sorted_members();
   std::vector<t_field*>::const_iterator oldStructMemberIt = oldStructMembersInIdOrder.begin();
   std::vector<t_field*>::const_iterator newStructMemberIt = newStructMembersInIdOrder.begin();

   // Since we have the struct members in their ID order, comparing their IDs can be done by traversing the two member
   // lists together.
   while(!(oldStructMemberIt == oldStructMembersInIdOrder.end() && newStructMemberIt == newStructMembersInIdOrder.end()))
   {
      if(newStructMemberIt == newStructMembersInIdOrder.end() && oldStructMemberIt != oldStructMembersInIdOrder.end())
      {
         // A field ID has been removed from the end.
         thrift_audit_failure("Struct Field removed for Id = %d in %s \n", (*oldStructMemberIt)->get_key(), structName.c_str());
         oldStructMemberIt++;
      }
      else if(newStructMemberIt != newStructMembersInIdOrder.end() && oldStructMemberIt == oldStructMembersInIdOrder.end())
      {
         //New field ID has been added to the end.
         if((*newStructMemberIt)->get_req() == t_field::T_REQUIRED)
         {
            thrift_audit_failure("Required Struct Field Added for Id = %d in %s \n", (*newStructMemberIt)->get_key(), structName.c_str());
         }
         newStructMemberIt++;
      }
      else if((*newStructMemberIt)->get_key() == (*oldStructMemberIt)->get_key())
      {
         //Field ID found in both structs. Compare field types, default values.
         compare_struct_field(*newStructMemberIt, *oldStructMemberIt, structName);

         newStructMemberIt++;
         oldStructMemberIt++;
      }
      else if((*newStructMemberIt)->get_key() < (*oldStructMemberIt)->get_key())
      {
         //New Field Id is inserted in between
         //Adding fields to struct is fine, but adding them in the middle is suspicious. Error!!
         thrift_audit_failure("Struct field is added in the middle with Id = %d in %s\n",  (*newStructMemberIt)->get_key(),  structName.c_str());
         newStructMemberIt++;
      }
      else if((*newStructMemberIt)->get_key() > (*oldStructMemberIt)->get_key())
      {
         //A field is deleted in newStruct.
         thrift_audit_failure("Struct Field removed for Id = %d in %s \n",  (*oldStructMemberIt)->get_key(), structName.c_str());
         oldStructMemberIt++;
      }

   }
}

void compare_structs(const std::vector<t_struct*>& newStructList, const std::vector<t_struct*>& oldStructList)
{
   std::map<std::string,t_struct*> newStructMap;
   std::vector<t_struct*>::const_iterator newStructListIt;
   for(newStructListIt = newStructList.begin(); newStructListIt != newStructList.end(); newStructListIt++)
   {
      newStructMap[(*newStructListIt)->get_name()] = *newStructListIt;
   }

   std::vector<t_struct*>::const_iterator oldStructListIt;
   for(oldStructListIt = oldStructList.begin(); oldStructListIt != oldStructList.end(); oldStructListIt++)
   {
      std::map<std::string, t_struct*>::iterator newStructMapIt;
      newStructMapIt = newStructMap.find((*oldStructListIt)->get_name());
      if(newStructMapIt == newStructMap.end())
      {
         thrift_audit_failure("Struct %s not found in new thrift file\n", (*oldStructListIt)->get_name().c_str());
      }
      else
      {
         compare_single_struct(newStructMapIt->second, *oldStructListIt);
      }
   }

}

void compare_single_function(t_function* newFunction, t_function* oldFunction)
{
   t_type* newFunctionReturnType = newFunction->get_returntype();

   if(newFunction->is_oneway() != oldFunction->is_oneway())
   {
      thrift_audit_failure("Oneway attribute changed for function %s\n",oldFunction->get_name().c_str());
   }
   if(!compare_type(newFunctionReturnType, oldFunction->get_returntype()))
   {
      thrift_audit_failure("Return type changed for function %s\n",oldFunction->get_name().c_str());
   }

   //Compare function arguments.
   compare_single_struct(newFunction->get_arglist(), oldFunction->get_arglist());
   std::string exceptionName = oldFunction->get_name();
   exceptionName += "_exception";
   compare_single_struct(newFunction->get_xceptions(), oldFunction->get_xceptions(), exceptionName);
}

void compare_functions(const std::vector<t_function*>& newFunctionList, const std::vector<t_function*>& oldFunctionList)
{
   std::map<std::string, t_function*> newFunctionMap;
   std::map<std::string, t_function*>::iterator newFunctionMapIt;
   for(std::vector<t_function*>::const_iterator newFunctionIt = newFunctionList.begin();
         newFunctionIt != newFunctionList.end();
         newFunctionIt++)
   {
      newFunctionMap[(*newFunctionIt)->get_name()] = *newFunctionIt;
   }

   for(std::vector<t_function*>::const_iterator oldFunctionIt = oldFunctionList.begin();
         oldFunctionIt != oldFunctionList.end();
         oldFunctionIt++)
   {
      newFunctionMapIt = newFunctionMap.find((*oldFunctionIt)->get_name());
      if(newFunctionMapIt == newFunctionMap.end())
      {
         thrift_audit_failure("New Thrift File has missing function %s\n",(*oldFunctionIt)->get_name().c_str());
         continue;
      }
      else
      {
         //Function is found in both thrift files. Compare return type and argument list
         compare_single_function(newFunctionMapIt->second, *oldFunctionIt);
      }
   }

}

void compare_services(const std::vector<t_service*>& newServices, const std::vector<t_service*>& oldServices)
{
   std::vector<t_service*>::const_iterator oldServiceIt;

   std::map<std::string, t_service*> newServiceMap;
   for(std::vector<t_service*>::const_iterator newServiceIt = newServices.begin();
         newServiceIt != newServices.end();
         newServiceIt++)
   {
      newServiceMap[(*newServiceIt)->get_name()] = *newServiceIt;
   }


   for(oldServiceIt = oldServices.begin(); oldServiceIt != oldServices.end(); oldServiceIt++)
   {
      const std::string oldServiceName = (*oldServiceIt)->get_name();
      std::map<std::string, t_service*>::iterator newServiceMapIt = newServiceMap.find(oldServiceName);

      if(newServiceMapIt == newServiceMap.end())
      {
         thrift_audit_failure("New Thrift file is missing a service %s\n", oldServiceName.c_str());
      }
      else
      {
         t_service* oldServiceExtends = (*oldServiceIt)->get_extends();
         t_service* newServiceExtends = (newServiceMapIt->second)->get_extends();

         if(oldServiceExtends == NULL)
         {
            // It is fine to add extends. So if service in older thrift did not have any extends, we are fine.
            // DO Nothing
         }
         else if(oldServiceExtends != NULL && newServiceExtends == NULL)
         {
            thrift_audit_failure("Change in Service inheritance for %s\n", oldServiceName.c_str());
         }
         else
         {
            std::string oldExtendsName = oldServiceExtends->get_name();
            std::string newExtendsName = newServiceExtends->get_name();

            if( newExtendsName != oldExtendsName)
            {
               thrift_audit_failure("Change in Service inheritance for %s\n", oldServiceName.c_str());
            }
         }

         compare_functions((newServiceMapIt->second)->get_functions(), (*oldServiceIt)->get_functions());
      }

   }

}

void compare_consts(const std::vector<t_const*>& newConst, const std::vector<t_const*>& oldConst)
{
   std::vector<t_const*>::const_iterator newConstIt;
   std::vector<t_const*>::const_iterator oldConstIt;

   std::map<std::string, t_const*> newConstMap;

   for(newConstIt = newConst.begin(); newConstIt != newConst.end(); newConstIt++)
   {
      newConstMap[(*newConstIt)->get_name()] = *newConstIt;
   }

   std::map<std::string, t_const*>::const_iterator newConstMapIt;
   for(oldConstIt = oldConst.begin(); oldConstIt != oldConst.end(); oldConstIt++)
   {
      newConstMapIt = newConstMap.find((*oldConstIt)->get_name());
      if(newConstMapIt == newConstMap.end())
      {
         thrift_audit_warning(1, "Constants Missing %s \n", ((*oldConstIt)->get_name()).c_str());
      }
      else if(!compare_type((newConstMapIt->second)->get_type(), (*oldConstIt)->get_type()))
      {
         thrift_audit_warning(1, "Constant %s is of different type \n", ((*oldConstIt)->get_name()).c_str());
      }
      else if(!compare_defaults((newConstMapIt->second)->get_value(), (*oldConstIt)->get_value()))
      {
         thrift_audit_warning(1, "Constant %s has different value\n", ((*oldConstIt)->get_name()).c_str());
      }
   }
}
