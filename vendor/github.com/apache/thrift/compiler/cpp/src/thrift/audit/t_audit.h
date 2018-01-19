#ifndef T_AUDIT_H
#define T_AUDIT_H

void compare_namespace(t_program* newProgram, t_program* oldProgram);
void compare_enums(const std::vector<t_enum*>& newEnumList,
                   const std::vector<t_enum*>& oldEnumList);
bool compare_defaults(t_const_value* newStructDefault, t_const_value* oldStructDefault);
void compare_structs(const std::vector<t_struct*>& newStructList,
                     const std::vector<t_struct*>& oldStructList);
void compare_services(const std::vector<t_service*>& newServices,
                      const std::vector<t_service*>& oldServices);
void compare_consts(const std::vector<t_const*>& newConst, const std::vector<t_const*>& oldConst);

#endif
