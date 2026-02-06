package syntax

type Syntax []Expression

type Expression struct {
	Label       string
	Grammar     []Definition
	Description Description
	Children    []Expression
}

var CsvqSyntax = []Expression{
	{
		Label: "SELECT Statement",
		Grammar: []Definition{
			{
				Name: "select_query",
				Group: []Grammar{
					{Option{Link("with_clause")}, Link("select_entity"), Option{Link("order_by_clause")}, Option{Link("limit_clause")}, Option{Keyword("FOR"), Keyword("UPDATE")}},
				},
			},
			{
				Name: "select_entity",
				Group: []Grammar{
					{Link("select_clause"), Option{Link("from_clause")}, Option{Link("where_clause")}, Option{Link("group_by_clause")}},
					{Link("select_set_entity"), Link("Set Operators"), Option{Keyword("ALL")}, Link("select_set_entity")},
				},
			},
			{
				Name: "select_set_entity",
				Group: []Grammar{
					{Link("select_entity")},
					{Parentheses{Link("select_query")}},
				},
			},
		},
		Children: []Expression{
			{
				Label: "WITH Clause",
				Grammar: []Definition{
					{
						Name: "with_clause",
						Group: []Grammar{
							{Keyword("WITH"), ContinuousOption{Link("common_table_expression")}},
						},
					},
					{
						Name: "common_table_expression",
						Group: []Grammar{
							{Option{Keyword("RECURSIVE")}, Identifier("table_name"), Option{Parentheses{ContinuousOption{Identifier("column_name")}}}, Keyword("AS"), Parentheses{Link("select_query")}},
						},
					},
				},
			},
			{
				Label: "SELECT Clause",
				Grammar: []Definition{
					{
						Name: "select_clause",
						Group: []Grammar{
							{Keyword("SELECT"), Option{Keyword("DISTINCT")}, ContinuousOption{Link("field")}},
						},
					},
					{
						Name: "field",
						Group: []Grammar{
							{Link("value")},
							{Link("value"), Keyword("AS"), Identifier("alias")},
							{Keyword("*")},
							{ConnectedGroup{Identifier("table_name"), Token("."), Keyword("*")}},
						},
					},
				},
			},
			{
				Label: "FROM Clause",
				Grammar: []Definition{
					{
						Name: "from_clause",
						Group: []Grammar{
							{Keyword("FROM"), Link("table"), FollowingContinuousOption{AnyOne{Link("table"), PlainGroup{Keyword("LATERAL"), Link("laterable_table")}}}},
						},
					},
					{
						Name: "table",
						Group: []Grammar{
							{Link("table_entity")},
							{Link("table_entity"), Identifier("alias")},
							{Link("table_entity"), Keyword("AS"), Identifier("alias")},
							{Link("join")},
							{Keyword("DUAL")},
							{Link("laterable_table")},
							{Parentheses{Link("table")}},
						},
					},
					{
						Name: "table_entity",
						Group: []Grammar{
							{Link("table_identifier")},
							{Link("format_specified_function")},
						},
					},
					{
						Name: "table_identifier",
						Group: []Grammar{
							{Identifier("table_name")},
							{Identifier("url")},
							{Link("table_identification_function")},
							{Keyword("STDIN")},
						},
					},
					{
						Name: "laterable_table",
						Group: []Grammar{
							{Link("subquery")},
							{Link("subquery"), Identifier("alias")},
							{Link("subquery"), Keyword("AS"), Identifier("alias")},
						},
					},
					{
						Name: "subquery",
						Group: []Grammar{
							{Parentheses{Link("select_query")}},
						},
					},
					{
						Name: "join",
						Group: []Grammar{
							{Link("table"), Keyword("CROSS"), Keyword("JOIN"), Link("table")},
							{Link("table"), Option{Keyword("INNER")}, Keyword("JOIN"), Link("table"), Link("join_condition")},
							{Link("table"), AnyOne{Keyword("LEFT"), Keyword("RIGHT"), Keyword("FULL")}, Option{Keyword("OUTER")}, Keyword("JOIN"), Link("table"), Link("join_condition")},
							{Link("table"), Keyword("NATURAL"), Option{Keyword("INNER")}, Keyword("JOIN"), Link("table")},
							{Link("table"), Keyword("NATURAL"), AnyOne{Keyword("LEFT"), Keyword("RIGHT")}, Option{Keyword("OUTER")}, Keyword("JOIN"), Link("table")},
							{Link("table"), Keyword("CROSS"), Keyword("JOIN"), Keyword("LATERAL"), Link("laterable_table")},
							{Link("table"), Option{Keyword("INNER")}, Keyword("JOIN"), Keyword("LATERAL"), Link("laterable_table"), Link("join_condition")},
							{Link("table"), Keyword("LEFT"), Option{Keyword("OUTER")}, Keyword("JOIN"), Keyword("LATERAL"), Link("laterable_table"), Link("join_condition")},
							{Link("table"), Keyword("NATURAL"), Option{Keyword("INNER")}, Keyword("JOIN"), Keyword("LATERAL"), Link("laterable_table")},
							{Link("table"), Keyword("NATURAL"), Keyword("LEFT"), Option{Keyword("OUTER")}, Keyword("JOIN"), Keyword("LATERAL"), Link("laterable_table")},
						},
					},
					{
						Name: "join_condition",
						Group: []Grammar{
							{Keyword("ON"), Link("condition")},
							{Keyword("USING"), Parentheses{ContinuousOption{Identifier("column_name")}}},
						},
					},
					{
						Name: "table_identification_function",
						Group: []Grammar{
							{Function{Name: "FILE::", Args: []Element{String("file_path")}}},
							{Function{Name: "INLINE::", Args: []Element{String("file_path")}}},
							{Function{Name: "URL::", Args: []Element{String("url")}}},
							{Function{Name: "DATA::", Args: []Element{String("data")}}},
						},
					},
					{
						Name: "format_specified_function",
						Group: []Grammar{
							{Function{Name: "CSV", Args: []Element{String("delimiter"), Link("table_identifier"), Option{String("encoding"), Boolean("no_header"), Boolean("without_null")}}}},
							{Function{Name: "FIXED", Args: []Element{String("delimiter_positions"), Link("table_identifier"), Option{String("encoding"), Boolean("no_header"), Boolean("without_null")}}}},
							{Function{Name: "JSON", Args: []Element{String("json_query"), Link("table_identifier")}}},
							{Function{Name: "JSONL", Args: []Element{String("json_query"), Link("table_identifier")}}},
							{Function{Name: "LTSV", Args: []Element{Link("table_identifier"), Option{String("encoding"), Boolean("without_null")}}}},
						},
					},
				},
			},
			{
				Label: "WHERE Clause",
				Grammar: []Definition{
					{
						Name: "where_clause",
						Group: []Grammar{
							{Keyword("WHERE"), Link("condition")},
						},
					},
					{
						Name: "condition",
						Group: []Grammar{
							{Link("value")},
						},
					},
				},
			},
			{
				Label: "GROUP BY Clause",
				Grammar: []Definition{
					{
						Name: "group_by_clause",
						Group: []Grammar{
							{Keyword("GROUP"), Keyword("BY"), ContinuousOption{Link("field")}},
						},
					},
				},
			},
			{
				Label: "HAVING Clause",
				Grammar: []Definition{
					{
						Name: "having_clause",
						Group: []Grammar{
							{Keyword("HAVING"), Link("condition")},
						},
					},
				},
			},
			{
				Label: "ORDER BY Clause",
				Grammar: []Definition{
					{
						Name: "order_by_clause",
						Group: []Grammar{
							{Keyword("ORDER"), Keyword("BY"), ContinuousOption{Link("order_item")}},
						},
					},
					{
						Name: "order_item",
						Group: []Grammar{
							{Link("field"), Option{Link("order_direction")}, Option{Link("null_position")}},
						},
						Description: Description{
							Template: "If %s keyword is specified in the %s, you can use only enumerated fields in the %s as %s.",
							Values:   []Element{Keyword("DISTINCT"), Link("select_clause"), Link("select_clause"), Link("field")},
						},
					},
					{
						Name: "order_direction",
						Group: []Grammar{
							{AnyOne{Keyword("ASC"), Keyword("DESC")}},
						},
						Description: Description{
							Template: "%s is the default.",
							Values:   []Element{Keyword("ASC")},
						},
					},
					{
						Name: "null_position",
						Group: []Grammar{
							{Keyword("NULLS"), AnyOne{Keyword("FIRST"), Keyword("LAST")}},
						},
						Description: Description{
							Template: "If %s is specified as %s then %s is the default. Otherwise %s is the default.",
							Values:   []Element{Link("order_direction"), Keyword("ASC"), Keyword("FIRST"), Keyword("LAST")},
						},
					},
				},
			},
			{
				Label: "LIMIT Clause",
				Grammar: []Definition{
					{
						Name: "limit_clause",
						Group: []Grammar{
							{Keyword("LIMIT"), Integer("number_of_records"), Option{AnyOne{Keyword("ROW"), Keyword("ROWS")}}, Option{AnyOne{Keyword("ONLY"), Keyword("WITH TIES")}}, Option{Link("offset_clause")}},
							{Keyword("LIMIT"), Float("percentage"), Keyword("PERCENT"), Option{AnyOne{Keyword("ONLY"), Keyword("WITH TIES")}}, Option{Link("offset_clause")}},
							{Option{Link("offset_clause")}, Keyword("FETCH"), AnyOne{Keyword("FIRST"), Keyword("NEXT")}, Integer("number_of_records"), AnyOne{Keyword("ROW"), Keyword("ROWS")}, Option{AnyOne{Keyword("ONLY"), Keyword("WITH TIES")}}},
							{Option{Link("offset_clause")}, Keyword("FETCH"), AnyOne{Keyword("FIRST"), Keyword("NEXT")}, Float("percentage"), Keyword("PERCENT"), Option{AnyOne{Keyword("ONLY"), Keyword("WITH TIES")}}},
							{Link("offset_clause")},
						},
					},
					{
						Name: "offset_clause",
						Group: []Grammar{
							{Keyword("OFFSET"), Integer("number_of_records"), Option{AnyOne{Keyword("ROW"), Keyword("ROWS")}}},
						},
					},
				},
			},
		},
	},
	{
		Label: "INSERT Statement",
		Grammar: []Definition{
			{
				Name: "insert_statement",
				Group: []Grammar{
					{Option{Link("with_clause")}, Link("insert_query")},
				},
			},
			{
				Name: "insert_query",
				Group: []Grammar{
					{Keyword("INSERT"), Keyword("INTO"), Identifier("table_name"), Option{Parentheses{ContinuousOption{Identifier("column_name")}}}, Keyword("VALUES"), ContinuousOption{Link("row_value")}},
					{Keyword("INSERT"), Keyword("INTO"), Identifier("table_name"), Option{Parentheses{ContinuousOption{Identifier("column_name")}}}, Link("select_query")},
				},
			},
		},
	},
	{
		Label: "UPDATE Statement",
		Grammar: []Definition{
			{
				Name: "update_statement",
				Group: []Grammar{
					{Option{Link("with_clause")}, Link("update_query")},
				},
			},
			{
				Name: "update_query",
				Group: []Grammar{
					{Keyword("UPDATE"), Identifier("table_name"), Keyword("SET"), ContinuousOption{Link("set_value")}, Option{Link("where_clause")}},
					{Keyword("UPDATE"), ContinuousOption{Identifier("table_alias")}, Keyword("SET"), ContinuousOption{Link("set_value")}, Link("from_clause"), Option{Link("where_clause")}},
				},
			},
			{
				Name: "set_value",
				Group: []Grammar{
					{Identifier("column_name"), Token("="), Link("value")},
				},
			},
		},
	},
	{
		Label: "REPLACE Statement",
		Grammar: []Definition{
			{
				Name: "replace_statement",
				Group: []Grammar{
					{Option{Link("with_clause")}, Link("replace_query")},
				},
			},
			{
				Name: "replace_query",
				Group: []Grammar{
					{Keyword("REPLACE"), Keyword("INTO"), Identifier("table_name"), Option{Parentheses{ContinuousOption{Identifier("column_name")}}}, Keyword("USING"), Parentheses{ContinuousOption{Identifier("key_column_name")}}, Keyword("VALUES"), ContinuousOption{Link("row_value")}},
					{Keyword("REPLACE"), Keyword("INTO"), Identifier("table_name"), Option{Parentheses{ContinuousOption{Identifier("column_name")}}}, Keyword("USING"), Parentheses{ContinuousOption{Identifier("key_column_name")}}, Link("select_query")},
				},
			},
		},
	},
	{
		Label: "DELETE Statement",
		Grammar: []Definition{
			{
				Name: "delete_statement",
				Group: []Grammar{
					{Option{Link("with_clause")}, Link("delete_query")},
				},
			},
			{
				Name: "delete_query",
				Group: []Grammar{
					{Keyword("DELETE"), Keyword("FROM"), Identifier("table_name"), Option{Link("where_clause")}},
					{Keyword("DELETE"), ContinuousOption{Identifier("table_alias")}, Link("from_clause"), Option{Link("where_clause")}},
				},
			},
		},
	},
	{
		Label: "CREATE TABLE Statement",
		Grammar: []Definition{
			{
				Name: "create_table_statement",
				Group: []Grammar{
					{Keyword("CREATE"), Keyword("TABLE"), Option{Keyword("IF NOT EXISTS")}, Identifier("file_path"), Parentheses{ContinuousOption{Identifier("column_name")}}},
					{Keyword("CREATE"), Keyword("TABLE"), Option{Keyword("IF NOT EXISTS")}, Identifier("file_path"), Option{Parentheses{ContinuousOption{Identifier("column_name")}}}, Option{Keyword("AS")}, Link("select_query")},
				},
			},
		},
	},
	{
		Label: "ALTER TABLE Statement",
		Grammar: []Definition{
			{
				Name: "alter_table_add_column_statement",
				Group: []Grammar{
					{Keyword("ALTER"), Keyword("TABLE"), Identifier("table_name"), Keyword("ADD"), Link("column_definition"), Option{Link("column_position")}},
					{Keyword("ALTER"), Keyword("TABLE"), Identifier("table_name"), Keyword("ADD"), Parentheses{ContinuousOption{Link("column_definition")}}, Option{Link("column_position")}},
				},
			},
			{
				Name: "column_definition",
				Group: []Grammar{
					{Identifier("column_name"), Option{Keyword("DEFAULT"), Link("value")}},
				},
				Description: Description{
					Template: "%s is the default value.",
					Values:   []Element{Null("NULL")},
				},
			},
			{
				Name: "column_position",
				Group: []Grammar{
					{AnyOne{Keyword("FIRST"), Keyword("LAST"), PlainGroup{Keyword("AFTER"), Identifier("column_name")}, PlainGroup{Keyword("BEFORE"), Identifier("column_name")}}},
				},
				Description: Description{
					Template: "%s is the default.",
					Values:   []Element{Keyword("LAST")},
				},
			},
			{
				Name: "alter_table_drop_column_statement",
				Group: []Grammar{
					{Keyword("ALTER"), Keyword("TABLE"), Identifier("table_name"), Keyword("DROP"), Identifier("column_name")},
					{Keyword("ALTER"), Keyword("TABLE"), Identifier("table_name"), Keyword("DROP"), Parentheses{ContinuousOption{Identifier("column_name")}}},
				},
			},
			{
				Name: "alter_table_rename_column_statement",
				Group: []Grammar{
					{Keyword("ALTER"), Keyword("TABLE"), Identifier("table_name"), Keyword("RENAME"), Identifier("old_column_name"), Keyword("TO"), Identifier("new_column_name")},
				},
			},
			{
				Name: "alter_table_set_attribute_statement",
				Group: []Grammar{
					{Keyword("ALTER"), Keyword("TABLE"), Identifier("table_name"), Keyword("SET"), Link("table_attribute"), Keyword("TO"), Link("value")},
				},
			},
			{
				Name: "table_attribute",
				Group: []Grammar{
					{AnyOne{Keyword("FORMAT"), Keyword("DELIMITER"), Keyword("DELIMITER_POSITIONS"), Keyword("JSON_ESCAPE"), Keyword("ENCODING"), Keyword("LINE_BREAK"), Keyword("HEADER"), Keyword("ENCLOSE_ALL"), Keyword("PRETTY_PRINT")}},
				},
			},
		},
	},
	{
		Label: "Prepared Statement",
		Grammar: []Definition{
			{
				Name: "prepare_statement",
				Group: []Grammar{
					{Keyword("PREPARE"), Identifier("statement_name"), Keyword("FROM"), String("statement")},
				},
			},
			{
				Name: "execute_prepared_statement",
				Group: []Grammar{
					{Keyword("EXECUTE"), Identifier("statement_name")},
					{Keyword("EXECUTE"), Identifier("statement_name"), Keyword("USING"), ContinuousOption{Link("statement_replace_value")}},
				},
			},
			{
				Name: "statement_replace_value",
				Group: []Grammar{
					{Link("value")},
					{Link("value"), Keyword("AS"), Identifier("placeholder_name")},
				},
			},
			{
				Name: "dispose_prepared_statement",
				Group: []Grammar{
					{Keyword("DISPOSE"), Keyword("PREPARE"), Identifier("statement_name")},
				},
			},
			{
				Name: "statement_placeholder",
				Description: Description{
					Template: "" +
						"Positional Placeholder\n" +
						"  > Question Mark(U+003F `?`)\n" +
						"Named Placeholder\n" +
						"  > Colon(U+003A `:`) and followd by %s",
					Values: []Element{Identifier("identifier")},
				},
			},
		},
	},
	{
		Label: "Variables",
		Grammar: []Definition{
			{
				Name: "declare_variable_statement",
				Group: []Grammar{
					{Keyword("DECLARE"), ContinuousOption{Link("variable_assignment")}},
					{Keyword("VAR"), ContinuousOption{Link("variable_assignment")}},
				},
			},
			{
				Name: "variable_assignment",
				Group: []Grammar{
					{Variable("@variable")},
					{Variable("@variable"), Token(":="), Link("value")},
				},
				Description: Description{
					Template: "%s is the default value.",
					Values:   []Element{Null("NULL")},
				},
			},
			{
				Name: "variable_substitution",
				Group: []Grammar{
					{Variable("@variable"), Token(":="), Link("value")},
				},
			},
			{
				Name: "select_into_statement",
				Group: []Grammar{
					{Option{Link("with_clause")}, Link("select_clause"), Keyword("INTO"), ContinuousOption{Link("variable")}, Option{Link("from_clause")}, Option{Link("where_clause")}, Option{Link("group_by_clause")}, Option{Link("having_clause")}, Option{Link("order_by_clause")}, Option{Link("limit_clause")}, Option{Link("offset_clause")}, Option{Keyword("FOR"), Keyword("UPDATE")}},
				},
			},
			{
				Name: "dispose_variable_statement",
				Group: []Grammar{
					{Keyword("DISPOSE"), Variable("@variable")},
				},
			},
		},
	},
	{
		Label: "Cursors",
		Grammar: []Definition{
			{
				Name: "declare_cursor_statement",
				Group: []Grammar{
					{Keyword("DECLARE"), Identifier("cursor_name"), Keyword("CURSOR"), Keyword("FOR"), Link("select_query")},
					{Keyword("DECLARE"), Identifier("cursor_name"), Keyword("CURSOR"), Keyword("FOR"), Identifier("prepared_statement_name")},
				},
			},
			{
				Name: "open_cursor_statement",
				Group: []Grammar{
					{Keyword("OPEN"), Identifier("cursor_name")},
					{Keyword("OPEN"), Identifier("cursor_name"), Keyword("USING"), ContinuousOption{Link("replace_value")}},
				},
			},
			{
				Name: "close_cursor_statement",
				Group: []Grammar{
					{Keyword("CLOSE"), Identifier("cursor_name")},
				},
			},
			{
				Name: "fetch_cursor_statement",
				Group: []Grammar{
					{Keyword("FETCH"), Option{Link("fetch_position")}, Identifier("cursor_name"), Keyword("INTO"), ContinuousOption{Variable("@variable")}},
				},
			},
			{
				Name: "fetch_position",
				Group: []Grammar{
					{AnyOne{Keyword("NEXT"), Keyword("PRIOR"), Keyword("FIRST"), Keyword("LAST"), PlainGroup{Keyword("ABSOLUTE"), Integer("row_number")}, PlainGroup{Keyword("RELATIVE"), Integer("row_number")}}},
				},
				Description: Description{
					Template: "%s is the default.",
					Values:   []Element{Keyword("NEXT")},
				},
			},
			{
				Name: "dispose_cursor_statement",
				Group: []Grammar{
					{Keyword("DISPOSE"), Keyword("CURSOR"), Identifier("cursor_name")},
				},
			},
		},
	},
	{
		Label: "Temporary Tables",
		Grammar: []Definition{
			{
				Name: "declare_view_statement",
				Group: []Grammar{
					{Keyword("DECLARE"), Identifier("view_name"), Keyword("VIEW"), Parentheses{ContinuousOption{Identifier("column_name")}}},
					{Keyword("DECLARE"), Identifier("view_name"), Keyword("VIEW"), Option{Parentheses{ContinuousOption{Identifier("column_name")}}}, Keyword("AS"), Link("select_query")},
				},
			},
			{
				Name: "dispose_view_statement",
				Group: []Grammar{
					{Keyword("DISPOSE"), Keyword("VIEW"), Identifier("view_name")},
				},
			},
		},
	},
	{
		Label: "User Defined Functions",
		Grammar: []Definition{
			{
				Name: "declare_scalar_function_statement",
				Group: []Grammar{
					{Keyword("DECLARE"), Identifier("function_name"), Keyword("FUNCTION"), Parentheses{Link("function_parameters")}, Keyword("AS"), Keyword("BEGIN"), Token("statements"), Keyword("END")},
				},
			},
			{
				Name: "declare_aggregate_function_statement",
				Group: []Grammar{
					{Keyword("DECLARE"), Identifier("function_name"), Keyword("AGGREGATE"), Parentheses{Identifier("internal_cursor_name"), Link("function_parameters")}, Keyword("AS"), Keyword("BEGIN"), Token("statements"), Keyword("END")},
				},
				Description: Description{
					Template: "An aggregate function can also be called as an analytic function.",
				},
			},
			{
				Name: "function_parameters",
				Group: []Grammar{
					{Option{ContinuousOption{Variable("@parameter")}}, Option{ContinuousOption{Link("optional_parameter")}}},
				},
			},
			{
				Name: "optional_parameter",
				Group: []Grammar{
					{Variable("@parameter"), Keyword("DEFAULT"), Link("value")},
				},
			},
			{
				Name: "dispose_function_statement",
				Group: []Grammar{
					{Keyword("DISPOSE"), Keyword("FUNCTION"), Identifier("function_name")},
				},
			},
			{
				Name: "return_statement",
				Group: []Grammar{
					{Keyword("RETURN"), Option{Link("value")}},
				},
				Description: Description{
					Template: "%s is the default value.",
					Values:   []Element{Null("NULL")},
				},
			},
			{
				Name: "scalar_function_call",
				Group: []Grammar{
					{Identifier("function_name"), Parentheses{ContinuousOption{Link("argument")}}},
				},
			},
			{
				Name: "aggregate_function_call",
				Group: []Grammar{
					{Identifier("function_name"), Parentheses{Option{Keyword("DISTINCT")}, Link("list_value"), Option{ContinuousOption{Link("argument")}}}},
				},
			},
			{
				Name: "analytic_function_call",
				Group: []Grammar{
					{Identifier("function_name"), Parentheses{Option{Keyword("DISTINCT")}, Link("list_value"), Option{ContinuousOption{Link("argument")}}}, Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}},
				},
			},
		},
	},
	{
		Label: "Control Flow",
		Grammar: []Definition{
			{
				Name: "if_statement",
				Group: []Grammar{
					{Keyword("IF"), Link("condition"), Keyword("THEN"), Token("statements"), Option{Keyword("ELSEIF"), Link("condition"), Keyword("THEN"), Token("statements"), Token("...")}, Option{Keyword("ELSE"), Token("statements")}, Keyword("END"), Keyword("IF")},
				},
			},
			{
				Name: "case_statement",
				Group: []Grammar{
					{Keyword("CASE"), Keyword("WHEN"), Link("condition"), Keyword("THEN"), Token("statements"), Option{Keyword("WHEN"), Link("condition"), Keyword("THEN"), Token("statements"), Token("...")}, Option{Keyword("ELSE"), Token("statements")}, Keyword("END"), Keyword("CASE")},
					{Keyword("CASE"), Link("value"), Keyword("WHEN"), Link("comparison_value"), Keyword("THEN"), Token("statements"), Option{Keyword("WHEN"), Link("comparison_value"), Keyword("THEN"), Token("statements"), Token("...")}, Option{Keyword("ELSE"), Token("statements")}, Keyword("END"), Keyword("CASE")},
				},
			},
			{
				Name: "while_statement",
				Group: []Grammar{
					{Keyword("WHILE"), Link("condition"), Keyword("DO"), Token("statements"), Keyword("END"), Keyword("WHILE")},
				},
			},
			{
				Name: "while_in_cursor_statement",
				Group: []Grammar{
					{Keyword("WHILE"), Option{AnyOne{Keyword("DECLARE"), Keyword("VAR")}}, ContinuousOption{Variable("@variable")}, Keyword("IN"), Identifier("cursor_name"), Keyword("DO"), Token("statements"), Keyword("END"), Keyword("WHILE")},
				},
			},
			{
				Name: "continue_statement",
				Group: []Grammar{
					{Keyword("CONTINUE")},
				},
			},
			{
				Name: "break_statement",
				Group: []Grammar{
					{Keyword("BREAK")},
				},
			},
			{
				Name: "exit_statement",
				Group: []Grammar{
					{Keyword("EXIT"), Option{Integer("exit_code")}},
				},
				Description: Description{
					Template: "%s is the default %s.",
					Values:   []Element{Token("0"), Integer("exit_code")},
				},
			},
			{
				Name: "trigger_error_statement",
				Group: []Grammar{
					{Keyword("TRIGGER"), Keyword("ERROR"), Option{Integer("exit_code")}, Option{String("error_message")}},
				},
				Description: Description{
					Template: "%s is the default %s.",
					Values:   []Element{Token("1"), Integer("exit_code")},
				},
			},
		},
	},
	{
		Label: "Transaction Management",
		Grammar: []Definition{
			{
				Name: "commit_statement",
				Group: []Grammar{
					{Keyword("COMMIT")},
				},
			},
			{
				Name: "rollback_statement",
				Group: []Grammar{
					{Keyword("ROLLBACK")},
				},
			},
		},
	},
	{
		Label: "Built-in Command",
		Grammar: []Definition{
			{
				Name: "echo",
				Group: []Grammar{
					{Keyword("ECHO"), Link("value")},
				},
				Description: Description{
					Template: "Print a value. This command returns the same result as \"PRINTF '%%s' USING value\".",
				},
			},
			{
				Name: "print",
				Group: []Grammar{
					{Keyword("PRINT"), Link("value")},
				},
				Description: Description{
					Template: "Print a value formatted according to the type.",
				},
			},
			{
				Name: "printf",
				Group: []Grammar{
					{Keyword("PRINTF"), String("format")},
					{Keyword("PRINTF"), String("format"), Keyword("USING"), ContinuousOption{Link("replace_value")}},
				},
				Description: Description{
					Template: "Print a formatted value.",
				},
			},
			{
				Name: "source",
				Group: []Grammar{
					{Keyword("SOURCE"), Identifier("file_path")},
				},
				Description: Description{
					Template: "Load and execute an external file as a part of the procedure.",
				},
			},
			{
				Name: "execute",
				Group: []Grammar{
					{Keyword("EXECUTE"), String("statements")},
					{Keyword("EXECUTE"), String("statements_format"), Keyword("USING"), ContinuousOption{Link("replace_value")}},
				},
				Description: Description{
					Template: "Execute a string as statements.",
				},
			},
			{
				Name: "show",
				Group: []Grammar{
					{Keyword("SHOW"), AnyOne{Keyword("TABLES"), Keyword("VIEWS"), Keyword("CURSORS"), Keyword("FUNCTIONS"), Keyword("FLAGS"), Keyword("ENV"), Keyword("RUNINFO")}},
				},
				Description: Description{
					Template: "Show objects.",
				},
			},
			{
				Name: "show_fields",
				Group: []Grammar{
					{Keyword("SHOW"), Keyword("FIELDS"), Keyword("FROM"), Identifier("table_name")},
				},
				Description: Description{
					Template: "Show fields in a table or a view.",
				},
			},
			{
				Name: "chdir",
				Group: []Grammar{
					{Keyword("CHDIR"), Identifier("directory_path")},
				},
				Description: Description{
					Template: "Change current working directory.",
				},
			},
			{
				Name: "pwd",
				Group: []Grammar{
					{Keyword("PWD")},
				},
				Description: Description{
					Template: "Print current working directory.",
				},
			},
			{
				Name: "reload",
				Group: []Grammar{
					{Keyword("RELOAD"), Keyword("CONFIG")},
				},
				Description: Description{
					Template: "Reload configuration json files.",
				},
			},
			{
				Name: "syntax",
				Group: []Grammar{
					{Keyword("SYNTAX"), Option{ContinuousOption{String("search_word")}}},
				},
				Description: Description{
					Template: "Print syntax.",
				},
			},
		},
	},
	{
		Label: "External Command",
		Grammar: []Definition{
			{
				Name: "external_command",
				Group: []Grammar{
					{Token("$"), Token("command"), Option{Token("args"), Token("...")}},
				},
				Description: Description{
					Template: "Run an external command. The result is written to the standard output.",
				},
			},
		},
	},
	{
		Label: "Values",
		Grammar: []Definition{
			{
				Name: "Primitive Types",
				Description: Description{
					Template: "" +
						"%s\n" +
						"  > Character strings encoded in UTF-8.\n" +
						"%s\n" +
						"  > 64-bit signed integers.\n" +
						"%s\n" +
						"  > 64-bit floating point numbers.\n" +
						"%s\n" +
						"  > Boolean values. true or false.\n" +
						"%s\n" +
						"  > Values of three-valued logic. TRUE, UNKNOWN or FALSE.\n" +
						"%s\n" +
						"  > Values of Date and time with nano seconds.\n" +
						"%s\n" +
						"  > Representations of missing values." +
						"",
					Values: []Element{
						String("String"),
						Integer("Integer"),
						Float("Float"),
						Boolean("Boolean"),
						Ternary("Ternary"),
						Datetime("Datetime"),
						Null("Null"),
					},
				},
			},
			{
				Name: "field_reference",
				Group: []Grammar{
					{Identifier("column_name")},
					{ConnectedGroup{Identifier("table_name"), Token("."), Identifier("column_name")}},
					{ConnectedGroup{Identifier("table_name"), Token("."), Integer("column_number")}},
				},
			},
			{
				Name: "arithmetic_operation",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("Arithmetic Operators")},
				},
			},
			{
				Name: "string_operation",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("String Operators")},
				},
			},
			{
				Name: "function",
				Description: Description{
					Template: "cf.\n" +
						"   > %s\n" +
						"   > %s\n" +
						"   > %s\n" +
						"   > %s\n" +
						"   > %s\n" +
						"   > %s\n" +
						"   > %s\n" +
						"   > %s\n" +
						"   > %s\n" +
						"   > %s\n" +
						"",
					Values: []Element{
						Link("Logical Functions"),
						Link("Numeric Functions"),
						Link("DateTime Functions"),
						Link("String Functions"),
						Link("Cryptographic Hash Functions"),
						Link("Cast Functions"),
						Link("System Functions"),
						Link("Aggregate Functions"),
						Link("Analytic Functions"),
						Link("User Defined Functions"),
					},
				},
			},
			{
				Name: "subquery",
				Group: []Grammar{
					{Parentheses{Link("select_query")}},
				},
			},
			{
				Name: "variable",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("Variables")},
				},
			},
			{
				Name: "variable_substitution",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("variable_substitution")},
				},
			},
			{
				Name: "environment_variable",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("Environment Variables")},
				},
			},
			{
				Name: "runtime_information",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("Runtime Information")},
				},
			},
			{
				Name: "system_defined_constant",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("System Defined Constant")},
				},
			},
			{
				Name: "flag",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("Flags")},
				},
			},
			{
				Name: "parentheses",
				Group: []Grammar{
					{Parentheses{Link("value")}},
				},
			},
			{
				Name: "case_expression",
				Group: []Grammar{
					{Keyword("CASE"), Keyword("WHEN"), Link("condition"), Keyword("THEN"), Link("result_value"), Option{Keyword("WHEN"), Link("condition"), Keyword("THEN"), Link("result_value"), Token("...")}, Option{Keyword("ELSE"), Link("result_value")}, Keyword("END")},
					{Keyword("CASE"), Link("value"), Keyword("WHEN"), Link("comparison_value"), Keyword("THEN"), Link("result_value"), Option{Keyword("WHEN"), Link("comparison_value"), Keyword("THEN"), Link("result_value"), Token("...")}, Option{Keyword("ELSE"), Link("result_value")}, Keyword("END")},
				},
			},
			{
				Name: "comparison_operation",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("Comparison Operators")},
				},
			},
			{
				Name: "logic_operation",
				Description: Description{
					Template: "cf. %s",
					Values:   []Element{Link("Logic Operators")},
				},
			},
			{
				Name: "cursor_status",
				Group: []Grammar{
					{Keyword("CURSOR"), Identifier("cursor_name"), Keyword("IS"), Option{Keyword("NOT")}, Keyword("OPEN")},
					{Keyword("CURSOR"), Identifier("cursor_name"), Keyword("IS"), Option{Keyword("NOT")}, Keyword("IN"), Keyword("RANGE")},
					{Keyword("CURSOR"), Identifier("cursor_name"), Keyword("COUNT")},
				},
			},
		},
	},
	{
		Label: "Row Values",
		Grammar: []Definition{
			{
				Name: "row_value",
				Group: []Grammar{
					{Parentheses{ContinuousOption{Link("value")}}},
					{Parentheses{Link("select_query")}},
					{Function{Name: "JSON_ROW", Args: []Element{Link("json_query"), Link("json_data")}}},
				},
			},
		},
	},
	{
		Label: "Flags",
		Description: Description{
			Template: "" +
				"%s  <type::%s>\n" +
				"  > Deirectory path where files are located.\n" +
				"%s  <type::%s>\n" +
				"  > Default %s.\n" +
				"%s  <type::%s>\n" +
				"  > Datetime Format to parse strings.\n" +
				"%s  <type::%s>\n" +
				"  > Use double quotation mark(U+0022 \") as identifier enclosure.\n" +
				"%s  <type::%s>\n" +
				"  > Compare strictly that two values are equal for DISTINCT, GROUP BY and ORDER BY.\n" +
				"%s  <type::%s>\n" +
				"  > Limit of the waiting time in seconds to wait for locked files to be released.\n" +
				"%s  <type::%s>\n" +
				"  > Default format to load files.\n" +
				"%s  <type::%s>\n" +
				"  > Field delimiter for CSV.\n" +
				"%s  <type::%s>\n" +
				"  > Allow loading CSV files with uneven field length.\n" +
				"%s  <type::%s>\n" +
				"  > Delimiter positions for Fixed-Length Format.\n" +
				"%s  <type::%s>\n" +
				"  > Query for JSON data.\n" +
				"%s  <type::%s>\n" +
				"  > Character %s.\n" +
				"%s  <type::%s>\n" +
				"  > Import first line as a record.\n" +
				"%s  <type::%s>\n" +
				"  > Parse empty fields as empty strings.\n" +
				"%s  <type::%s>\n" +
				"  > Strip line break from the end of files and query results.\n" +
				"%s  <type::%s>\n" +
				"  > %s of query results.\n" +
				"%s  <type::%s>\n" +
				"  > Character %s of query results.\n" +
				"%s  <type::%s>\n" +
				"  > Field delimiter for query results in CSV.\n" +
				"%s  <type::%s>\n" +
				"  > Delimiter positions for query results in Fixed-Length Format.\n" +
				"%s  <type::%s>\n" +
				"  > Write without the header line in query results.\n" +
				"%s  <type::%s>\n" +
				"  > %s in query results.\n" +
				"%s  <type::%s>\n" +
				"  > Enclose all string values in CSV.\n" +
				"%s  <type::%s>\n" +
				"  > %s of query results.\n" +
				"%s  <type::%s>\n" +
				"  > Make JSON output easier to read in query results.\n" +
				"%s  <type::%s>\n" +
				"  > Use Scientific Notation for large exponents in output.\n" +
				"%s  <type::%s>\n" +
				"  > Count ambiguous characters as fullwidth.\n" +
				"%s  <type::%s>\n" +
				"  > Count diacritical signs as halfwidth.\n" +
				"%s  <type::%s>\n" +
				"  > Count format characters and zero-width spaces as halfwidth.\n" +
				"%s  <type::%s>\n" +
				"  > Use ANSI color escape sequences.\n" +
				"%s  <type::%s>\n" +
				"  > Suppress operation log output.\n" +
				"%s  <type::%s>\n" +
				"  > Hint for the number of cpu cores to be used.\n" +
				"%s  <type::%s>\n" +
				"  > Show execution time.\n" +
				"",
			Values: []Element{
				Flag("@@REPOSITORY"), String("string"),
				Flag("@@TIMEZONE"), String("string"), Link("Timezone"),
				Flag("@@DATETIME_FORMAT"), String("string"),
				Flag("@@ANSI_QUOTES"), String("boolean"),
				Flag("@@STRICT_EQUAL"), String("boolean"),
				Flag("@@WAIT_TIMEOUT"), Float("float"),
				Flag("@@IMPORT_FORMAT"), String("string"),
				Flag("@@DELIMITER"), String("string"),
				Flag("@@ALLOW_UNEVEN_FIELDS"), String("boolean"),
				Flag("@@DELIMITER_POSITIONS"), String("string"),
				Flag("@@JSON_QUERY"), String("string"),
				Flag("@@ENCODING"), String("string"), Link("Encoding"),
				Flag("@@NO_HEADER"), Boolean("boolean"),
				Flag("@@WITHOUT_NULL"), Boolean("boolean"),
				Flag("@@STRIP_ENDING_LINE_BREAK"), Boolean("boolean"),
				Flag("@@FORMAT"), String("string"), Link("Format"),
				Flag("@@WRITE_ENCODING"), String("string"), Link("Encoding"),
				Flag("@@WRITE_DELIMITER"), String("string"),
				Flag("@@WRITE_DELIMITER_POSITIONS"), String("string"),
				Flag("@@WITHOUT_HEADER"), Boolean("boolean"),
				Flag("@@LINE_BREAK"), String("string"), Link("Line Break"),
				Flag("@@ENCLOSE_ALL"), Boolean("boolean"),
				Flag("@@JSON_ESCAPE"), String("string"), Link("Json Escape Type"),
				Flag("@@PRETTY_PRINT"), Boolean("boolean"),
				Flag("@@SCIENTIFIC_NOTATION"), Boolean("boolean"),
				Flag("@@EAST_ASIAN_ENCODING"), Boolean("boolean"),
				Flag("@@COUNT_DIACRITICAL_SIGN"), Boolean("boolean"),
				Flag("@@COUNT_FORMAT_CODE"), Boolean("boolean"),
				Flag("@@COLOR"), Boolean("boolean"),
				Flag("@@QUIET"), Boolean("boolean"),
				Flag("@@CPU"), Integer("integer"),
				Flag("@@STATS"), Boolean("boolean"),
			},
		},
		Grammar: []Definition{
			{
				Name: "set_flag_statement",
				Group: []Grammar{
					{Keyword("SET"), Flag("@@FLAG"), Keyword("TO"), Link("value")},
					{Keyword("SET"), Flag("@@FLAG"), Keyword("="), Link("value")},
				},
			},
			{
				Name: "show_flag_statement",
				Group: []Grammar{
					{Keyword("SHOW"), Flag("@@FLAG")},
				},
			},
			{
				Name: "add_flag_element_statement",
				Group: []Grammar{
					{Keyword("ADD"), String("format"), Keyword("TO"), Flag("@@DATETIME_FORMAT")},
				},
			},
			{
				Name: "remove_flag_element_statement",
				Group: []Grammar{
					{Keyword("REMOVE"), String("format"), Keyword("FROM"), Flag("@@DATETIME_FORMAT")},
					{Keyword("REMOVE"), Integer("format_index"), Keyword("FROM"), Flag("@@DATETIME_FORMAT")},
				},
			},
		},
	},
	{
		Label: "Environment Variables",
		Grammar: []Definition{
			{
				Name: "set_environment_variable_statement",
				Group: []Grammar{
					{Keyword("SET"), Variable("@%ENV_NAME"), Keyword("TO"), Link("value")},
					{Keyword("SET"), Variable("@@ENV_NAME"), Keyword("="), Link("value")},
				},
			},
			{
				Name: "unset_environment_variable_statement",
				Group: []Grammar{
					{Keyword("UNSET"), Variable("@%ENV_NAME")},
				},
			},
		},
	},
	{
		Label: "Runtime Information",
		Description: Description{
			Template: "" +
				"%s  <type::%s>\n" +
				"  > Whether there are tables or views that have not been comitted.\n" +
				"%s  <type::%s>\n" +
				"  > Number of uncommitted tables after creation.\n" +
				"%s  <type::%s>\n" +
				"  > Number of uncommitted tables after update.\n" +
				"%s  <type::%s>\n" +
				"  > Number of uncommitted views after update.\n" +
				"%s  <type::%s>\n" +
				"  > Number of loaded tables.\n" +
				"%s  <type::%s>\n" +
				"  > Current working directory.\n" +
				"%s  <type::%s>\n" +
				"  > Version of csvq.\n" +
				"",
			Values: []Element{
				Variable("@#UNCOMMITTED"), Boolean("boolean"),
				Variable("@#CREATED"), Integer("integer"),
				Variable("@#UPDATED"), Integer("integer"),
				Variable("@#UPDATED_VIEWS"), Integer("integer"),
				Variable("@#LOADED_TABLES"), Integer("integer"),
				Variable("@#WORKING_DIRECTORY"), String("string"),
				Variable("@#VERSION"), String("string"),
			},
		},
	},
	{
		Label: "System Defined Constant",
		Description: Description{
			Template: "" +
				"```\n" +
				"  +----------+------------------+---------+\n" +
				"  | Category | Name             | Type    |\n" +
				"  +----------+------------------+---------+\n" +
				"  | MATH     | E                | float   |\n" +
				"  |          | PI               | float   |\n" +
				"  |          | PHI              | float   |\n" +
				"  |          | SQRT2            | float   |\n" +
				"  |          | SQRTE            | float   |\n" +
				"  |          | SQRTPI           | float   |\n" +
				"  |          | SQRTPHI          | float   |\n" +
				"  |          | LN2              | float   |\n" +
				"  |          | LOG2E            | float   |\n" +
				"  |          | LN10             | float   |\n" +
				"  |          | LOG10E           | float   |\n" +
				"  | FLOAT    | MAX              | float   |\n" +
				"  |          | SMALLEST_NONZERO | float   |\n" +
				"  | INTEGER  | MAX              | integer |\n" +
				"  |          | MIN              | integer |\n" +
				"  +----------+------------------+---------+\n" +
				"```",
		},
	},
	{
		Label: "JSON Query",
		Description: Description{
			Template: "" +
				"%s\n" +
				"  > A value identifier is used to represent an object member.\n" +
				"\n" +
				"  > An identifier is a word starting with any unicode letter or a Low Line(U+005F _) and followed by a character string that contains any unicode letters, any digits or Low Lines(U+005F _)." +
				"    You can use most character strings as an identifier by enclosing in Back Quotes(U+0060 `), Single Quotes(U+0027 ') or Double Quotes(U+0022 \")." +
				"    Quotation Marks are escaped by Backslashes(U+005C \\).\n" +
				"%s\n" +
				"  > Number of json array elements starting with 0.\n" +
				"%s\n" +
				"  > A period(U+002E .) is used to separate values and that represents a child object.\n" +
				"%s\n" +
				"  > Square Brackets(U+005B [, U+005D ]) are used to represent json array.\n" +
				"%s\n" +
				"  > Curly Brackets(U+007B {, U+007D }) are used to repsesent json array of objects.\n" +
				"",
			Values: []Element{
				Name("Value Identifier"),
				Name("Array Index"),
				Name("Value Separator"),
				Name("Array"),
				Name("Object Array"),
			},
		},
		Grammar: []Definition{
			{
				Name: "json_value",
				Group: []Grammar{
					{AnyOne{Link("json_object_member"), Link("json_array_element")}},
					{ContinuousOption{Link("json_value")}},
				},
			},
			{
				Name: "json_object_member",
				Group: []Grammar{
					{Identifier("value_identifier")},
				},
			},
			{
				Name: "json_array_element",
				Group: []Grammar{
					{Option{Integer("index")}},
				},
			},
			{
				Name: "json_array",
				Group: []Grammar{
					{Option{}},
				},
			},
			{
				Name: "json_object_array",
				Group: []Grammar{
					{Token("{"), Option{ContinuousOption{Link("json_object_field")}}, Token("}")},
				},
			},
			{
				Name: "json_object_field",
				Group: []Grammar{
					{Identifier("field_name")},
					{Identifier("field_name"), Keyword("as"), Identifier("alias")},
				},
			},
		},
	},
	{
		Label: "Operators",
		Children: []Expression{
			{
				Label: "Operator Precedence",
				Description: Description{
					Template: "The following table list operators from highest precedence to lowest.\n" +
						"\n" +
						"```\n" +
						"  +------------+---------------------+---------------+\n" +
						"  | Precedence |       Operators     | Associativity |\n" +
						"  +------------+---------------------+---------------+\n" +
						"  |          1 | +  (Unary Plus)     | Right-to-Left |\n" +
						"  |            | -  (Unary Minus)    | Right-to-Left |\n" +
						"  |            | !  (Logical Not)    | Right-to-Left |\n" +
						"  |          2 | *  (Multiplication) | Left-to-Right |\n" +
						"  |            | /  (Division)       | Left-to-Right |\n" +
						"  |            | %s  (Modulo)         | Left-to-Right |\n" +
						"  |          3 | +  (Addition)       | Left-to-Right |\n" +
						"  |            | -  (Subtraction)    | Left-to-Right |\n" +
						"  |          4 | || (Concatenation)  | Left-to-Right |\n" +
						"  |          5 | =                   | n/a           |\n" +
						"  |            | ==                  | n/a           |\n" +
						"  |            | <                   | n/a           |\n" +
						"  |            | <=                  | n/a           |\n" +
						"  |            | >                   | n/a           |\n" +
						"  |            | >=                  | n/a           |\n" +
						"  |            | <>                  | n/a           |\n" +
						"  |            | !=                  | n/a           |\n" +
						"  |            | IS                  | n/a           |\n" +
						"  |            | BETWEEN             | n/a           |\n" +
						"  |            | IN                  | n/a           |\n" +
						"  |            | LIKE                | n/a           |\n" +
						"  |          6 | NOT                 | Right-to-Left |\n" +
						"  |          7 | AND                 | Left-to-Right |\n" +
						"  |          8 | OR                  | Left-to-Right |\n" +
						"  |          9 | INTERSECT           | Left-to-Right |\n" +
						"  |         10 | UNION               | Left-to-Right |\n" +
						"  |            | EXCEPT              | Left-to-Right |\n" +
						"  |         11 | :=                  | Right-to-Left |\n" +
						"  +------------+---------------------+---------------+\n" +
						"```",
					Values: []Element{Token("%")},
				},
			},
			{
				Label: "Arithmetic Operators",
				Grammar: []Definition{
					{
						Name: "binary_operator",
						Group: []Grammar{
							{Link("value"), Link("binary_operator"), Link("value")},
						},
						Description: Description{
							Template: "" +
								"```\n" +
								"  +----------+-----------------+\n" +
								"  | Operator |   Description   |\n" +
								"  +----------+-----------------+\n" +
								"  | +        | Addition        |\n" +
								"  | -        | Subtraction     |\n" +
								"  | *        | Multiplication  |\n" +
								"  | /        | Division        |\n" +
								"  | %s        | Modulo          |\n" +
								"  +----------+-----------------+\n" +
								"```",
							Values: []Element{Token("%")},
						},
					},
					{
						Name: "unary_operator",
						Group: []Grammar{
							{Link("unary_operator"), Link("value")},
						},
						Description: Description{
							Template: "" +
								"```\n" +
								"  +----------+-------------+\n" +
								"  | Operator | Description |\n" +
								"  +----------+-------------+\n" +
								"  | +        | Plus        |\n" +
								"  | -        | Minus       |\n" +
								"  +----------+-------------+\n" +
								"```",
						},
					},
				},
			},
			{
				Label: "Comparison Operators",
				Grammar: []Definition{
					{
						Name: "relational_operator",
						Group: []Grammar{
							{Link("value"), Link("relational_operator"), Link("value")},
							{Link("row_value"), Link("relational_operator"), Link("row_value")},
						},
						Description: Description{
							Template: "" +
								"```\n" +
								"  +----------+-------------------------------------------------+\n" +
								"  | Operator |                   Description                   |\n" +
								"  +----------+-------------------------------------------------+\n" +
								"  | =        | LHS is equal to RHS                             |\n" +
								"  | ==       | Both sides are the same type and the same value |\n" +
								"  | <        | LHS is less than RHS                            |\n" +
								"  | <=       | LHS is less than or equal to RHS                |\n" +
								"  | >        | LHS is greater than RHS                         |\n" +
								"  | >=       | LHS is greater than or equal to RHS             |\n" +
								"  | <>,!=    | LHS is not equal to RHS                         |\n" +
								"  +----------+-------------------------------------------------+\n" +
								"```",
						},
					},
					{
						Name: "is",
						Group: []Grammar{
							{Link("value"), Keyword("IS"), Option{Keyword("NOT")}, Keyword("NULL")},
							{Link("value"), Keyword("IS"), Option{Keyword("NOT")}, Ternary("ternary")},
						},
						Description: Description{
							Template: "Check if %s is %s. If %s value is specified, then evaluates the ternary value of %s and check if the ternary value is equal to %s.",
							Values:   []Element{Link("value"), Null("NULL"), Ternary("ternary"), Link("value"), Ternary("ternary")},
						},
					},
					{
						Name: "between",
						Group: []Grammar{
							{Link("value"), Option{Keyword("NOT")}, Keyword("BETWEEN"), Link("low_value"), Keyword("AND"), Link("high_value")},
							{Link("row_value"), Option{Keyword("NOT")}, Keyword("BETWEEN"), Link("low_row_value"), Keyword("AND"), Link("high_row_value")},
						},
						Description: Description{
							Template: "Check %s is greater than or equal to %s and less than or equal to %s.",
							Values:   []Element{Link("value"), Link("low"), Link("high")},
						},
					},
					{
						Name: "like",
						Group: []Grammar{
							{String("str"), Option{Keyword("NOT")}, Keyword("LIKE"), String("pattern")},
						},
						Description: Description{
							Template: "Check if %s matches %s. If %s is null, then returns %s. In %s, following special characters can be used.\n" +
								"\n" +
								"```\n" +
								"  +---------------------+---------------------------+\n" +
								"  |      character      |        Description        |\n" +
								"  +---------------------+---------------------------+\n" +
								"  | %s                   | Any number of characters  |\n" +
								"  | _ (U+005F Low Line) | Exactly one character     |\n" +
								"  +---------------------+---------------------------+\n" +
								"```",
							Values: []Element{String("str"), String("pattern"), String("str"), Ternary("UNKNOWN"), String("pattern"), Token("%")},
						},
					},
					{
						Name: "in",
						Group: []Grammar{
							{Link("value"), Option{Keyword("NOT")}, Keyword("IN"), Parentheses{ContinuousOption{Link("value")}}},
							{Link("row_value"), Option{Keyword("NOT")}, Keyword("IN"), Parentheses{ContinuousOption{Link("row_value")}}},
						},
					},
					{
						Name: "any",
						Group: []Grammar{
							{Link("value"), Link("relational_operator"), Keyword("ANY"), Parentheses{ContinuousOption{Link("value")}}},
							{Link("row_value"), Link("relational_operator"), Keyword("ANY"), Parentheses{ContinuousOption{Link("row_value")}}},
						},
					},
					{
						Name: "all",
						Group: []Grammar{
							{Link("value"), Link("relational_operator"), Keyword("ALL"), Parentheses{ContinuousOption{Link("value")}}},
							{Link("row_value"), Link("relational_operator"), Keyword("ALL"), Parentheses{ContinuousOption{Link("row_value")}}},
						},
					},
					{
						Name: "exists",
						Group: []Grammar{
							{Keyword("EXISTS"), Parentheses{Link("select_query")}},
						},
					},
				},
			},
			{
				Label: "Logic Operators",
				Grammar: []Definition{
					{
						Name: "and",
						Group: []Grammar{
							{Link("value"), Keyword("AND"), Link("value")},
						},
					},
					{
						Name: "or",
						Group: []Grammar{
							{Link("value"), Keyword("OR"), Link("value")},
						},
					},
					{
						Name: "not",
						Group: []Grammar{
							{Keyword("NOT"), Link("value")},
							{Keyword("!"), Link("value")},
						},
						Description: Description{
							Template: "%s and %s return the same value, but there is the difference of %s between these two operators.",
							Values:   []Element{Keyword("NOT"), Keyword("!"), Link("precedence")},
						},
					},
				},
			},
			{
				Label: "String Operators",
				Grammar: []Definition{
					{
						Name: "concatenation",
						Group: []Grammar{
							{Link("value"), Keyword("||"), Link("value")},
						},
					},
				},
			},
			{
				Label: "Set Operators",
				Grammar: []Definition{
					{
						Name: "union",
						Group: []Grammar{
							{Link("select_set_entity"), Keyword("UNION"), Option{Keyword("ALL")}, Link("select_set_entity")},
						},
					},
					{
						Name: "except",
						Group: []Grammar{
							{Link("select_set_entity"), Keyword("EXCEPT"), Option{Keyword("ALL")}, Link("select_set_entity")},
						},
					},
					{
						Name: "intersect",
						Group: []Grammar{
							{Link("select_set_entity"), Keyword("INTERSECT"), Option{Keyword("ALL")}, Link("select_set_entity")},
						},
					},
				},
			},
		},
	},
	{
		Label: "Functions",
		Children: []Expression{
			{
				Label: "Logical Functions",
				Grammar: []Definition{
					{
						Name: "coalesce",
						Group: []Grammar{
							{Function{Name: "COALESCE", Args: []Element{ContinuousOption{Link("value")}}, Return: Return("primitive type")}},
						},
						Description: Description{Template: "Returns the first non-null %s in arguments. If there is no non-null %s, then returns %s.", Values: []Element{Link("value"), Link("value"), Null("NULL")}},
					},
					{
						Name: "if",
						Group: []Grammar{
							{Function{Name: "IF", Args: []Element{Link("condition"), Link("value1"), Link("value2")}, Return: Return("primitive type")}},
						},
						Description: Description{Template: "If %s is %s, then returns %s. Otherwise returns %s.", Values: []Element{Link("condition"), Ternary("TRUE"), Link("value1"), Link("value2")}},
					},
					{
						Name: "ifnull",
						Group: []Grammar{
							{Function{Name: "IFNULL", Args: []Element{Link("value1"), Link("value2")}, Return: Return("primitive type")}},
						},
						Description: Description{Template: "If %s is %s, then returns %s. Otherwise returns %s.", Values: []Element{Link("value1"), Null("NULL"), Link("value2"), Link("value1")}},
					},
					{
						Name: "nullif",
						Group: []Grammar{
							{Function{Name: "NULLIF", Args: []Element{Link("value1"), Link("value2")}, Return: Return("primitive type")}},
						},
						Description: Description{Template: "If %s is equal to %s, then returns %s. Otherwise returns %s.", Values: []Element{Link("value1"), Link("value2"), Null("NULL"), Link("value1")}},
					},
				},
			},
			{
				Label: "Numeric Functions",
				Grammar: []Definition{
					{
						Name: "abs",
						Group: []Grammar{
							{Function{Name: "ABS", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the absolute value of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "acos",
						Group: []Grammar{
							{Function{Name: "ACOS", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the arc cosine of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "acosh",
						Group: []Grammar{
							{Function{Name: "ACOSH", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the inverse hyperbolic cosine of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "asin",
						Group: []Grammar{
							{Function{Name: "ASIN", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the arc sine of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "asinh",
						Group: []Grammar{
							{Function{Name: "ASINH", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the inverse hyperbolic sine of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "atan",
						Group: []Grammar{
							{Function{Name: "ATAN", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the arc tangent of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "atan2",
						Group: []Grammar{
							{Function{Name: "ATAN2", Args: []Element{Float("number2"), Float("number1")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the arc tangent of %s / %s, using the signs of the two to determine the quadrant of the return value.", Values: []Element{Float("number2"), Float("number1")}},
					},
					{
						Name: "atanh",
						Group: []Grammar{
							{Function{Name: "ATANH", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the inverse hyperbolic tangent of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "cbrt",
						Group: []Grammar{
							{Function{Name: "CBRT", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the cube root of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "ceil",
						Group: []Grammar{
							{Function{Name: "CEIL", Args: []Element{Float("number"), ArgWithDefValue{Arg: Integer("place"), Default: Integer("0")}}, Return: Return("float")}},
						},
						Description: Description{Template: "Rounds %s up to %s decimal place. If %s is a negative number, then %s represents the place in the integer part.", Values: []Element{Float("number"), Integer("place"), Integer("place"), Integer("place")}},
					},
					{
						Name: "cos",
						Group: []Grammar{
							{Function{Name: "COS", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the cosine of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "cosh",
						Group: []Grammar{
							{Function{Name: "COSH", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the hyperbolic cosine of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "exp",
						Group: []Grammar{
							{Function{Name: "EXP", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the value of base %s raised to the power of %s.", Values: []Element{Italic("e"), Float("number")}},
					},
					{
						Name: "exp2",
						Group: []Grammar{
							{Function{Name: "EXP2", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the value of base 2 raised to the power of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "expm1",
						Group: []Grammar{
							{Function{Name: "EXPM1", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the value of base %s raised to the power of %s nimus %s.", Values: []Element{Italic("e"), Float("number"), Italic("1")}},
					},
					{
						Name: "floor",
						Group: []Grammar{
							{Function{Name: "FLOOR", Args: []Element{Float("number"), ArgWithDefValue{Arg: Integer("place"), Default: Integer("0")}}, Return: Return("float")}},
						},
						Description: Description{Template: "Rounds %s down to %s decimal place. If %s is a negative number, then %s represents the place in the integer part.", Values: []Element{Float("number"), Integer("place"), Integer("place"), Integer("place")}},
					},
					{
						Name: "is_inf",
						Group: []Grammar{
							{Function{Name: "IS_INF", Args: []Element{Float("number"), ArgWithDefValue{Arg: Integer("sign"), Default: Integer("0")}}, Return: Return("ternary")}},
						},
						Description: Description{Template: "Returns %s is +INF or not when %s > 0, -INF or not when %s < 0, or either INF when %s = 0.", Values: []Element{Float("number"), Integer("sign"), Integer("sign"), Integer("sign")}},
					},
					{
						Name: "is_nan",
						Group: []Grammar{
							{Function{Name: "IS_NAN", Args: []Element{Float("number")}, Return: Return("ternary")}},
						},
						Description: Description{Template: "Returns whether %s is a NaN.", Values: []Element{Float("number")}},
					},
					{
						Name: "log",
						Group: []Grammar{
							{Function{Name: "LOG", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the natural logarithm of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "log10",
						Group: []Grammar{
							{Function{Name: "LOG10", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the decimal logarithm of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "log1p",
						Group: []Grammar{
							{Function{Name: "LOG1P", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the natural logarithm of 1 plus %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "log2",
						Group: []Grammar{
							{Function{Name: "LOG2", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the binary logarithm of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "logb",
						Group: []Grammar{
							{Function{Name: "LOGB", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the binary exponent of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "pow",
						Group: []Grammar{
							{Function{Name: "POW", Args: []Element{Float("base"), Float("exponent")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the value of %s raised to the power of %s.", Values: []Element{Float("base"), Float("exponent")}},
					},
					{
						Name: "round",
						Group: []Grammar{
							{Function{Name: "ROUND", Args: []Element{Float("number"), ArgWithDefValue{Arg: Integer("place"), Default: Integer("0")}}, Return: Return("float")}},
						},
						Description: Description{Template: "Rounds %s to %s decimal place. If %s is a negative number, then %s represents the place in the integer part.", Values: []Element{Float("number"), Integer("place"), Integer("place"), Integer("place")}},
					},
					{
						Name: "sin",
						Group: []Grammar{
							{Function{Name: "SIN", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the sine of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "sinh",
						Group: []Grammar{
							{Function{Name: "SINH", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the hyperbolic sine of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "sqrt",
						Group: []Grammar{
							{Function{Name: "SQRT", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the square root of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "tan",
						Group: []Grammar{
							{Function{Name: "TAN", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the tangent of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "tanh",
						Group: []Grammar{
							{Function{Name: "TANH", Args: []Element{Float("number")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the hyperbolic tangent of %s.", Values: []Element{Float("number")}},
					},
					{
						Name: "bin_to_dec",
						Group: []Grammar{
							{Function{Name: "BIN_TO_DEC", Args: []Element{String("bin")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Converts %s representing a binary number to an integer.", Values: []Element{String("bin")}},
					},
					{
						Name: "oct_to_dec",
						Group: []Grammar{
							{Function{Name: "OCT_TO_DEC", Args: []Element{String("oct")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Converts %s representing a octal number to an integer.", Values: []Element{String("oct")}},
					},
					{
						Name: "hex_to_dec",
						Group: []Grammar{
							{Function{Name: "HEX_TO_DEC", Args: []Element{String("hex")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Converts %s representing a hexadecimal number to an integer.", Values: []Element{String("hex")}},
					},
					{
						Name: "enotation_to_dec",
						Group: []Grammar{
							{Function{Name: "ENOTATION_TO_DEC", Args: []Element{String("enotation")}, Return: Return("float")}},
						},
						Description: Description{Template: "Converts %s representing a number with exponential notation to an integer or a float.", Values: []Element{String("enotation")}},
					},
					{
						Name: "bin",
						Group: []Grammar{
							{Function{Name: "BIN", Args: []Element{Integer("number")}, Return: Return("string")}},
						},
						Description: Description{Template: "Converts %s to a string representing the binary number.", Values: []Element{Integer("number")}},
					},
					{
						Name: "oct",
						Group: []Grammar{
							{Function{Name: "OCT", Args: []Element{Integer("number")}, Return: Return("string")}},
						},
						Description: Description{Template: "Converts %s to a string representing the octal number.", Values: []Element{Integer("number")}},
					},
					{
						Name: "hex",
						Group: []Grammar{
							{Function{Name: "HEX", Args: []Element{Integer("number")}, Return: Return("string")}},
						},
						Description: Description{Template: "Converts %s to a string representing the hexadecimal number.", Values: []Element{Integer("number")}},
					},
					{
						Name: "enotation",
						Group: []Grammar{
							{Function{Name: "ENOTATION", Args: []Element{Float("number")}, Return: Return("string")}},
						},
						Description: Description{Template: "Converts %s to a string representing the number with exponential notation.", Values: []Element{Integer("number")}},
					},
					{
						Name: "number_format",
						Group: []Grammar{
							{Function{Name: "NUMBER_FORMAT", Args: []Element{Float("number"), ArgWithDefValue{Arg: Integer("precision"), Default: Integer("-1")}, ArgWithDefValue{Arg: String("decimalPoint"), Default: String("'.'")}, ArgWithDefValue{Arg: String("thousandsSeparator"), Default: String("','")}, ArgWithDefValue{Arg: String("decimalSeparator"), Default: String("''")}}, Return: Return("string")}},
						},
						Description: Description{Template: "Formats %s to a string with separators.", Values: []Element{Integer("number")}},
					},
					{
						Name: "rand",
						Group: []Grammar{
							{Function{Name: "RAND", Return: Return("float")}},
							{Function{Name: "RAND", Args: []Element{Integer("min"), Integer("max")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns a random float number greater than or equal to 0.0 and less than 1.0. If %s and %s are specified, then returns a random integer between %s and %s.", Values: []Element{Integer("min"), Integer("max"), Integer("min"), Integer("max")}},
					},
				},
			},
			{
				Label: "Datetime Functions",
				Grammar: []Definition{
					{
						Name: "now",
						Group: []Grammar{
							{Function{Name: "NOW", Return: Return("datetime")}},
						},
						Description: Description{Template: "Returns a datetime value of current date and time. In a single query, every this function returns the same value."},
					},
					{
						Name: "datetime_format",
						Group: []Grammar{
							{Function{Name: "DATETIME_FORMAT", Args: []Element{Datetime("datetime"), String("format")}, Return: Return("string")}},
						},
						Description: Description{Template: "Formats %s according to %s.", Values: []Element{Datetime("datetime"), String("format")}},
					},
					{
						Name: "year",
						Group: []Grammar{
							{Function{Name: "YEAR", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the year of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "month",
						Group: []Grammar{
							{Function{Name: "MONTH", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the month number of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "day",
						Group: []Grammar{
							{Function{Name: "DAY", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the day of month of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "hour",
						Group: []Grammar{
							{Function{Name: "HOUR", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the hour of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "minute",
						Group: []Grammar{
							{Function{Name: "MINUTE", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the minute of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "second",
						Group: []Grammar{
							{Function{Name: "SECOND", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the second of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "millisecond",
						Group: []Grammar{
							{Function{Name: "MILLISECOND", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the millisecond of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "microsecond",
						Group: []Grammar{
							{Function{Name: "MICROSECOND", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the microsecond of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "nanosecond",
						Group: []Grammar{
							{Function{Name: "NANOSECOND", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the nanosecond of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "weekday",
						Group: []Grammar{
							{Function{Name: "WEEKDAY", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the weekday number of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "unix_time",
						Group: []Grammar{
							{Function{Name: "UNIX_TIME", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the number of seconds elapsed since January 1, 1970 UTC of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "unix_nano_time",
						Group: []Grammar{
							{Function{Name: "UNIX_NANO_TIME", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the number of nanoseconds elapsed since January 1, 1970 UTC of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "day_of_year",
						Group: []Grammar{
							{Function{Name: "DAY_OF_YEAR", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the day of the year of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "week_of_year",
						Group: []Grammar{
							{Function{Name: "WEEK_OF_YEAR", Args: []Element{Datetime("datetime")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the week number of the year of %s as an integer.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "add_year",
						Group: []Grammar{
							{Function{Name: "ADD_YEAR", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s years to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "add_month",
						Group: []Grammar{
							{Function{Name: "ADD_MONTH", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s monthes to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "add_day",
						Group: []Grammar{
							{Function{Name: "ADD_DAY", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s days to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "add_hour",
						Group: []Grammar{
							{Function{Name: "ADD_HOUR", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s hours to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "add_minute",
						Group: []Grammar{
							{Function{Name: "ADD_MINUTE", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s minutes to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "add_second",
						Group: []Grammar{
							{Function{Name: "ADD_SECOND", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s seconds to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "add_milli",
						Group: []Grammar{
							{Function{Name: "ADD_MILLI", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s milliseconds to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "add_micro",
						Group: []Grammar{
							{Function{Name: "ADD_MICRO", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s microseconds to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "add_nano",
						Group: []Grammar{
							{Function{Name: "ADD_NANO", Args: []Element{Datetime("datetime"), Integer("duration")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Adds %s nanoseconds to %s.", Values: []Element{Integer("duration"), Datetime("datetime")}},
					},
					{
						Name: "trunc_month",
						Group: []Grammar{
							{Function{Name: "TRUNC_MONTH", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Truncates time information less than 1 year from %s.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "trunc_day",
						Group: []Grammar{
							{Function{Name: "TRUNC_DAY", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Truncates time information less than 1 month from %s.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "trunc_time",
						Group: []Grammar{
							{Function{Name: "TRUNC_TIME", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Truncates time information less than 1 day from %s.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "trunc_minute",
						Group: []Grammar{
							{Function{Name: "TRUNC_MINUTE", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Truncates time information less than 1 hour from %s.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "trunc_second",
						Group: []Grammar{
							{Function{Name: "TRUNC_MONTH", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Truncates time information less than 1 minute from %s.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "trunc_milli",
						Group: []Grammar{
							{Function{Name: "TRUNC_MILLI", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Truncates time information less than 1 second from %s.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "trunc_micro",
						Group: []Grammar{
							{Function{Name: "TRUNC_MICRO", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Truncates time information less than 1 millisecond from %s.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "trunc_nano",
						Group: []Grammar{
							{Function{Name: "TRUNC_NANO", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Truncates time information less than 1 microsecond from %s.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "date_diff",
						Group: []Grammar{
							{Function{Name: "DATE_DIFF", Args: []Element{Datetime("datetime1"), Datetime("datetime2")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the difference of days between two %s values. The time information less than 1 day are ignored in the calculation.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "time_diff",
						Group: []Grammar{
							{Function{Name: "TIME_DIFF", Args: []Element{Datetime("datetime1"), Datetime("datetime2")}, Return: Return("float")}},
						},
						Description: Description{Template: "Returns the difference of time between two %s values as seconds. In the return value, the integer part represents seconds and the fractional part represents nanoseconds.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "time_nano_diff",
						Group: []Grammar{
							{Function{Name: "TIME_DIFF", Args: []Element{Datetime("datetime1"), Datetime("datetime2")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the difference of time between two %s values as nanoseconds.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "utc",
						Group: []Grammar{
							{Function{Name: "UTC", Args: []Element{Datetime("datetime")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Returns the datetime value of %s in UTC.", Values: []Element{Datetime("datetime")}},
					},
					{
						Name: "milli_to_datetime",
						Group: []Grammar{
							{Function{Name: "MILLI_TO_DATETIME", Args: []Element{Integer("unix_milli_time")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Returns the datetime value represented by %s.", Values: []Element{Integer("unix_milli_time")}},
					},
					{
						Name: "nano_to_datetime",
						Group: []Grammar{
							{Function{Name: "NANO_TO_DATETIME", Args: []Element{Integer("unix_nano_time")}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Returns the datetime value represented by %s.", Values: []Element{Integer("unix_nano_time")}},
					},
				},
			},
			{
				Label: "String Functions",
				Grammar: []Definition{
					{
						Name: "trim",
						Group: []Grammar{
							{Function{Name: "TRIM", Args: []Element{String("str")}, Return: Return("string")}},
							{Function{Name: "TRIM", Args: []Element{String("str"), String("charset")}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string value that is removed all leading and trailing characters contained in %s from %s. " +
								"If %s is not specified, then white spaces will be removed.",
							Values: []Element{String("charset"), String("str"), String("charset")},
						},
					},
					{
						Name: "ltrim",
						Group: []Grammar{
							{Function{Name: "LTRIM", Args: []Element{String("str")}, Return: Return("string")}},
							{Function{Name: "LTRIM", Args: []Element{String("str"), String("charset")}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string value that is removed all leading characters contained in %s from %s. " +
								"If %s is not specified, then white spaces will be removed.",
							Values: []Element{String("charset"), String("str"), String("charset")},
						},
					},
					{
						Name: "rtrim",
						Group: []Grammar{
							{Function{Name: "RTRIM", Args: []Element{String("str")}, Return: Return("string")}},
							{Function{Name: "RTRIM", Args: []Element{String("str"), String("charset")}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string value that is removed all trailing characters contained in %s from %s. " +
								"If %s is not specified, then white spaces will be removed.",
							Values: []Element{String("charset"), String("str"), String("charset")},
						},
					},
					{
						Name: "upper",
						Group: []Grammar{
							{Function{Name: "UPPER", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string value replaced %s with characters mapped to their upper case.", Values: []Element{String("str")}},
					},
					{
						Name: "lower",
						Group: []Grammar{
							{Function{Name: "LOWER", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string value replaced %s with characters mapped to their lower case.", Values: []Element{String("str")}},
					},
					{
						Name: "base64_encode",
						Group: []Grammar{
							{Function{Name: "BASE64_ENCODE", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the Base64 encoding of %s.", Values: []Element{String("str")}},
					},
					{
						Name: "base64_decode",
						Group: []Grammar{
							{Function{Name: "BASE64_DECODE", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string value represented by %s that is encoded with Base64.", Values: []Element{String("str")}},
					},
					{
						Name: "hex_encode",
						Group: []Grammar{
							{Function{Name: "HEX_ENCODE", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the hexadecimal encoding of %s.", Values: []Element{String("str")}},
					},
					{
						Name: "hex_decode",
						Group: []Grammar{
							{Function{Name: "HEX_DECODE", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string value represented by %s that is encoded with hexadecimal.", Values: []Element{String("str")}},
					},
					{
						Name: "len",
						Group: []Grammar{
							{Function{Name: "LEN", Args: []Element{String("str")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the number of characters of %s.", Values: []Element{String("str")}},
					},
					{
						Name: "byte_len",
						Group: []Grammar{
							{Function{Name: "BYTE_LEN", Args: []Element{String("str"), ArgWithDefValue{Arg: String("encoding"), Default: String("'UTF8'")}}, Return: Return("integer")}},
						},
						Description: Description{Template: "Returns the byte length of %s.", Values: []Element{String("str")}},
					},
					{
						Name: "width",
						Group: []Grammar{
							{Function{Name: "WIDTH", Args: []Element{String("str")}, Return: Return("integer")}},
						},
						Description: Description{
							Template: "Returns the string width of %s.\n" +
								"Half-width characters are counted as 1, and full-width characters are counted as 2.",
							Values: []Element{String("str")},
						},
					},
					{
						Name: "lpad",
						Group: []Grammar{
							{Function{Name: "LPAD", Args: []Element{String("str"), Integer("len"), String("padstr"), ArgWithDefValue{Arg: String("pad_type"), Default: String("'LEN'")}, ArgWithDefValue{Arg: String("encoding"), Default: String("'UTF8'")}}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string value of %s padded with leading %s to the length specified by %s. %s is any one of %s.",
							Values:   []Element{String("str"), String("padstr"), Integer("len"), String("pad_type"), AnyOne{Keyword("LEN"), Keyword("BYTE"), Keyword("WIDTH")}},
						},
					},
					{
						Name: "rpad",
						Group: []Grammar{
							{Function{Name: "RPAD", Args: []Element{String("str"), Integer("len"), String("padstr"), ArgWithDefValue{Arg: String("padType"), Default: String("'LEN'")}, ArgWithDefValue{Arg: String("encoding"), Default: String("'UTF8'")}}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string value of %s padded with trailing %s to the length specified by %s. %s is any one of %s.",
							Values:   []Element{String("str"), String("padstr"), Integer("len"), String("padType"), AnyOne{Keyword("LEN"), Keyword("BYTE"), Keyword("WIDTH")}},
						},
					},
					{
						Name: "substring",
						Group: []Grammar{
							{Function{Name: "SUBSTRING", CustomArgs: []Element{String("str"), Keyword("FROM"), Integer("pos")}, Return: Return("string")}},
							{Function{Name: "SUBSTRING", CustomArgs: []Element{String("str"), Keyword("FROM"), Integer("pos"), Keyword("FOR"), Integer("len")}, Return: Return("string")}},
							{Function{Name: "SUBSTRING", Args: []Element{String("str"), Integer("pos")}, Return: Return("string")}},
							{Function{Name: "SUBSTRING", Args: []Element{String("str"), Integer("pos"), Integer("len")}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the %s characters in %s starting from the %s-th character using one-based positional indexing.\n" +
								"\n" +
								"If %s is 0, then it is treated as 1.\n" +
								"If %s is not specified or %s is longer than the length from %s to the end, then returns the substring from %s to the end.\n" +
								"If %s is negative, then starting position is %s from the end of the %s.",
							Values: []Element{Integer("len"), String("str"), Integer("pos"), Integer("pos"), Integer("len"), Integer("len"), Integer("pos"), Integer("pos"), Integer("pos"), Integer("pos"), String("str")},
						},
					},
					{
						Name: "substr",
						Group: []Grammar{
							{Function{Name: "SUBSTR", Args: []Element{String("str"), Integer("pos")}, Return: Return("string")}},
							{Function{Name: "SUBSTR", Args: []Element{String("str"), Integer("pos"), Integer("len")}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the %s characters in %s starting from the %s-th character. \n" +
								"This function behaves the same as %s function, but uses zero-based positional indexing.",
							Values: []Element{Integer("len"), String("str"), Integer("pos"), Link("substring")},
						},
					},
					{
						Name: "instr",
						Group: []Grammar{
							{Function{Name: "INSTR", Args: []Element{String("str"), Integer("substr")}, Return: Return("integer")}},
						},
						Description: Description{
							Template: "Returns the index of the first occurrence of %s in %s, or null if %s is not present in %s.",
							Values:   []Element{String("substr"), String("str"), String("substr"), String("str")},
						},
					},
					{
						Name: "list_elem",
						Group: []Grammar{
							{Function{Name: "LIST_ELEM", Args: []Element{String("str"), String("sep"), Integer("index")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string at %s in the list generated by splitting with %s from %s.", Values: []Element{Integer("index"), String("sep"), String("str")}},
					},
					{
						Name: "replace",
						Group: []Grammar{
							{Function{Name: "REPLACE", Args: []Element{String("str"), String("old"), String("new")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string that is replaced all occurrences of %s with %s in %s.", Values: []Element{String("old"), String("new"), String("str")}},
					},
					{
						Name: "regexp_match",
						Group: []Grammar{
							{Function{Name: "REGEXP_MATCH", Args: []Element{String("str"), String("regexp"), Option{Link("flags_of_regular_expressions")}}, Return: Return("ternary")}},
						},
						Description: Description{Template: "Verifies the string %s matches with the regular expression %s.", Values: []Element{String("str"), String("regexp")}},
					},
					{
						Name: "regexp_find",
						Group: []Grammar{
							{Function{Name: "REGEXP_FIND", Args: []Element{String("str"), String("regexp"), Option{Link("flags_of_regular_expressions")}}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string that matches the regular expression %s in %s.", Values: []Element{String("regexp"), String("str")}},
					},
					{
						Name: "regexp_find_submatches",
						Group: []Grammar{
							{Function{Name: "REGEXP_FIND_SUBMATCHES", Args: []Element{String("str"), String("regexp"), Option{Link("flags_of_regular_expressions")}}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string representing an array that matches the regular expression %s in %s.", Values: []Element{String("regexp"), String("str")}},
					},
					{
						Name: "regexp_find_all",
						Group: []Grammar{
							{Function{Name: "REGEXP_FIND_ALL", Args: []Element{String("str"), String("regexp"), Option{Link("flags_of_regular_expressions")}}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string representing a nested array that matches the regular expression %s in %s.", Values: []Element{String("regexp"), String("str")}},
					},
					{
						Name: "regexp_replace",
						Group: []Grammar{
							{Function{Name: "REGEXP_REPLACE", Args: []Element{String("str"), String("regexp"), String("replacement_value"), Option{Link("flags_of_regular_expressions")}}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns the string replaced substrings that match the regular expression %s with %s in %s.", Values: []Element{String("regexp"), String("replacement_value"), String("str")}},
					},
					{
						Name: "title_case",
						Group: []Grammar{
							{Function{Name: "TITLE_CASE", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns a string with the first letter of each word in %s capitalized.", Values: []Element{String("str")}},
					},
					{
						Name: "format",
						Group: []Grammar{
							{Function{Name: "FORMAT", Args: []Element{String("format"), Option{ContinuousOption{Link("replace_value")}}}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns a formatted string replaced %s with %s in %s.", Values: []Element{Link("placeholders"), Link("replace_value"), String("format")}},
					},
					{
						Name: "json_value",
						Group: []Grammar{
							{Function{Name: "JSON_VALUE", Args: []Element{String("json_query"), String("json_data")}, Return: Return("value")}},
						},
						Description: Description{Template: "Returns a %s in %s.", Values: []Element{Link("value"), String("json_data")}},
					},
					{
						Name: "json_object",
						Group: []Grammar{
							{Function{Name: "JSON_OBJECT", Args: []Element{ContinuousOption{Link("string")}}, Return: Return("string")}},
						},
						Description: Description{Template: "Returns a string formatted in JSON."},
					},
				},
			},
			{
				Label: "Cryptographic Hash Functions",
				Grammar: []Definition{
					{
						Name: "md5",
						Group: []Grammar{
							{Function{Name: "MD5", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Generates a MD5 hash value."},
					},
					{
						Name: "sha1",
						Group: []Grammar{
							{Function{Name: "SHA1", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Generates a SHA-1 hash value."},
					},
					{
						Name: "sha256",
						Group: []Grammar{
							{Function{Name: "SHA256", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Generates a SHA-256 hash value."},
					},
					{
						Name: "sha512",
						Group: []Grammar{
							{Function{Name: "SHA512", Args: []Element{String("str")}, Return: Return("string")}},
						},
						Description: Description{Template: "Generates a SHA-512 hash value."},
					},
					{
						Name: "md5_hmac",
						Group: []Grammar{
							{Function{Name: "MD5_HMAC", Args: []Element{String("str"), String("key")}, Return: Return("string")}},
						},
						Description: Description{Template: "Generates a MD5 keyed-hash value using the HMAC method."},
					},
					{
						Name: "sha1_hmac",
						Group: []Grammar{
							{Function{Name: "SHA1_HMAC", Args: []Element{String("str"), String("key")}, Return: Return("string")}},
						},
						Description: Description{Template: "Generates a SHA-1 keyed-hash value using the HMAC method."},
					},
					{
						Name: "sha256_hmac",
						Group: []Grammar{
							{Function{Name: "SHA256_HMAC", Args: []Element{String("str"), String("key")}, Return: Return("string")}},
						},
						Description: Description{Template: "Generates a SHA-256 keyed-hash value using the HMAC method."},
					},
					{
						Name: "sha512_hmac",
						Group: []Grammar{
							{Function{Name: "SHA512_HMAC", Args: []Element{String("str"), String("key")}, Return: Return("string")}},
						},
						Description: Description{Template: "Generates a SHA-512 keyed-hash value using the HMAC method."},
					},
				},
			},
			{
				Label: "Cast Functions",
				Grammar: []Definition{
					{
						Name: "string",
						Group: []Grammar{
							{Function{Name: "STRING", Args: []Element{Link("value")}, Return: Return("string")}},
						},
						Description: Description{Template: "Converts %s to a string.", Values: []Element{Link("value")}},
					},
					{
						Name: "integer",
						Group: []Grammar{
							{Function{Name: "INTEGER", Args: []Element{Link("value")}, Return: Return("integer")}},
						},
						Description: Description{Template: "Converts %s to an integer.", Values: []Element{Link("value")}},
					},
					{
						Name: "float",
						Group: []Grammar{
							{Function{Name: "FLOAT", Args: []Element{Link("value")}, Return: Return("float")}},
						},
						Description: Description{Template: "Converts %s to a float.", Values: []Element{Link("value")}},
					},
					{
						Name: "datetime",
						Group: []Grammar{
							{Function{Name: "DATETIME", Args: []Element{Link("value"), Option{ArgWithDefValue{Arg: String("timezone"), Default: Italic("timezone set to the flag @@TIMEZONE")}}}, Return: Return("datetime")}},
						},
						Description: Description{Template: "Converts %s to a datetime.", Values: []Element{Link("value")}},
					},
					{
						Name: "boolean",
						Group: []Grammar{
							{Function{Name: "BOOLEAN", Args: []Element{Link("value")}, Return: Return("boolean")}},
						},
						Description: Description{Template: "Converts %s to a boolean.", Values: []Element{Link("value")}},
					},
					{
						Name: "ternary",
						Group: []Grammar{
							{Function{Name: "TERNARY", Args: []Element{Link("value")}, Return: Return("ternary")}},
						},
						Description: Description{Template: "Converts %s to a ternary.", Values: []Element{Link("value")}},
					},
				},
			},
			{
				Label: "System Functions",
				Grammar: []Definition{
					{
						Name: "call",
						Group: []Grammar{
							{Function{Name: "CALL", Args: []Element{String("command"), Option{ContinuousOption{String("argument")}}}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Executes an external %s and returns the standard output as a string. " +
								"If the external %s failed, then the executing procedure is terminated with an error.",
							Values: []Element{String("command"), String("command")},
						},
					},
				},
			},
			{
				Label: "Aggregate Functions",
				Description: Description{
					Template: "" +
						"Aggregate functions calculate groupd records retrieved by a select query. " +
						"If records are not grouped, all records are dealt with as one group. " +
						"If %s keyword is specified, aggregate functions calculate only unique values.\n" +
						"\n" +
						"Analytic Functions can be used only in %s, %s and %s",
					Values: []Element{Keyword("DISTINCT"), Link("Select Clause"), Link("Having Clause"), Link("Order By Clause")},
				},
				Grammar: []Definition{
					{
						Name: "count",
						Group: []Grammar{
							{Function{Name: "COUNT", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("integer")}},
							{Function{Name: "COUNT", Args: []Element{Option{Keyword("DISTINCT")}, Keyword("*")}, Return: Return("integer")}},
						},
						Description: Description{
							Template: "Returns the number of non-null values of %s. " +
								"If Asterisk(U+002A '*') is specified as a value, then returns the number of all values including null values.",
							Values: []Element{Link("value")},
						},
					},
					{
						Name: "min",
						Group: []Grammar{
							{Function{Name: "MIN", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the minimum value of non-null values of %s. " +
								"If all values are null, then returns %s.",
							Values: []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "max",
						Group: []Grammar{
							{Function{Name: "MAX", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the maximum value of non-null values of %s. " +
								"If all values are null, then returns %s.",
							Values: []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "sum",
						Group: []Grammar{
							{Function{Name: "SUM", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the sum of float values of %s. " +
								"If all values are null, then returns %s.",
							Values: []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "avg",
						Group: []Grammar{
							{Function{Name: "AVG", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the average of float values of %s. " +
								"If all values are null, then returns %s.",
							Values: []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "stdev",
						Group: []Grammar{
							{Function{Name: "STDEV", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the sample standard deviation of float values of %s. " +
								"If all values are null, then returns %s.",
							Values: []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "stdevp",
						Group: []Grammar{
							{Function{Name: "STDEVP", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the population standard deviation of float values of %s. " +
								"If all values are null, then returns %s.",
							Values: []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "var",
						Group: []Grammar{
							{Function{Name: "VAR", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the sample variance of float values of %s. " +
								"If all values are null, then returns %s.",
							Values: []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "varp",
						Group: []Grammar{
							{Function{Name: "VARP", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the population variance of float values of %s. " +
								"If all values are null, then returns %s.",
							Values: []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "median",
						Group: []Grammar{
							{Function{Name: "MEDIAN", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the median of float or datetime values of %s. " +
								"If all values are null, then returns %s.\n" +
								"\n" +
								"Even if %s represents datetime values, this function returns a float or an integer value. " +
								"The return value can be converted to a datetime value by using the %s function.",
							Values: []Element{Link("value"), Null("NULL"), Link("value"), Keyword("DATETIME")},
						},
					},
					{
						Name: "listagg",
						Group: []Grammar{
							{Function{Name: "LISTAGG", Args: []Element{Option{Keyword("DISTINCT")}, Link("value"), Option{String("sep")}}, AfterArgs: []Element{Option{Keyword("WITHIN"), Keyword("GROUP"), Parentheses{Link("order_by_clause")}}}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string result with the concatenated non-null values of %s. " +
								"If all values are null, then returns %s.\n" +
								"\n" +
								"%s is placed between values. Empty string is the default. " +
								"By using %s, you can sort values.",
							Values: []Element{Link("value"), Null("NULL"), String("sep"), Link("order_by_clause")},
						},
					},
					{
						Name: "json_agg",
						Group: []Grammar{
							{Function{Name: "JSON_AGG", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Option{Keyword("WITHIN"), Keyword("GROUP"), Parentheses{Link("order_by_clause")}}}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string formatted in JSON array of %s. " +
								"By using %s, you can sort values.",
							Values: []Element{Link("value"), Link("order_by_clause")},
						},
					},
				},
			},
			{
				Label: "Analytic Functions",
				Description: Description{
					Template: "Analytic functions calculate values of groups. Analytic Functions can be used only in %s and %s",
					Values:   []Element{Link("Select Clause"), Link("Order By Clause")},
				},
				Grammar: []Definition{
					{
						Name: "row_number",
						Group: []Grammar{
							{Function{Name: "ROW_NUMBER", AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause")}}}, Return: Return("integer")}},
						},
						Description: Description{
							Template: "Returns the sequential numbers of records in a group.",
						},
					},
					{
						Name: "rank",
						Group: []Grammar{
							{Function{Name: "RANK", AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause")}}}, Return: Return("integer")}},
						},
						Description: Description{
							Template: "Returns the ranks of records in a group.",
						},
					},
					{
						Name: "dense_rank",
						Group: []Grammar{
							{Function{Name: "DENSE_RANK", AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause")}}}, Return: Return("integer")}},
						},
						Description: Description{
							Template: "Returns the ranks of records without any gaps in the ranking in a group.",
						},
					},
					{
						Name: "cume_dist",
						Group: []Grammar{
							{Function{Name: "CUME_DIST", AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause")}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the cumulative distributions in a group. The return value is greater than 0 and less than or equal to 1.",
						},
					},
					{
						Name: "percent_rank",
						Group: []Grammar{
							{Function{Name: "PERCENT_RANK", AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause")}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the relative ranks in a group. The return value is greater than or equal to 0 and less than or equal to 1.",
						},
					},
					{
						Name: "ntile",
						Group: []Grammar{
							{Function{Name: "NTILE", Args: []Element{Integer("number_of_groups")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause")}}}, Return: Return("integer")}},
						},
						Description: Description{
							Template: "Splits the records into %s groups, then returns the sequential numbers of the groups.",
							Values:   []Element{Integer("number_of_groups")},
						},
					},
					{
						Name: "first_value",
						Group: []Grammar{
							{Function{Name: "FIRST_VALUE", Args: []Element{Link("value")}, AfterArgs: []Element{Option{Keyword("IGNORE"), Keyword("NULLS")}, Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the first value in a group. " +
								"If %s %s keywords are specified, then returns the first value that is not null.",
							Values: []Element{Keyword("IGNORE"), Keyword("NULLS")},
						},
					},
					{
						Name: "last_value",
						Group: []Grammar{
							{Function{Name: "FIRST_VALUE", Args: []Element{Link("value")}, AfterArgs: []Element{Option{Keyword("IGNORE"), Keyword("NULLS")}, Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the last value in a group. " +
								"If %s %s keywords are specified, then returns the last value that is not null.",
							Values: []Element{Keyword("IGNORE"), Keyword("NULLS")},
						},
					},
					{
						Name: "nth_value",
						Group: []Grammar{
							{Function{Name: "NTH_VALUE", Args: []Element{Link("value"), Integer("n")}, AfterArgs: []Element{Option{Keyword("IGNORE"), Keyword("NULLS")}, Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the %s-th value in a group. " +
								"If %s %s keywords are specified, then returns the %s-th value that is not null.",
							Values: []Element{Integer("n"), Keyword("IGNORE"), Keyword("NULLS"), Integer("n")},
						},
					},
					{
						Name: "lag",
						Group: []Grammar{
							{Function{Name: "LAG", Args: []Element{Link("value"), Option{ArgWithDefValue{Arg: Integer("offset"), Default: Integer("1")}, ArgWithDefValue{Arg: Link("default_value"), Default: Null("NULL")}}}, AfterArgs: []Element{Option{Keyword("IGNORE"), Keyword("NULLS")}, Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause")}}}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the value in a previous row. " +
								"If %s %s keywords are specified, then rows that %s values are nulls will be skipped.",
							Values: []Element{Link("value"), Keyword("IGNORE"), Keyword("NULLS")},
						},
					},
					{
						Name: "lead",
						Group: []Grammar{
							{Function{Name: "LEAD", Args: []Element{Link("value"), Option{ArgWithDefValue{Arg: Integer("offset"), Default: Integer("1")}, ArgWithDefValue{Arg: Link("default_value"), Default: Null("NULL")}}}, AfterArgs: []Element{Option{Keyword("IGNORE"), Keyword("NULLS")}, Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause")}}}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the value in a following row. " +
								"If %s %s keywords are specified, then rows that %s values are nulls will be skipped.",
							Values: []Element{Link("value"), Keyword("IGNORE"), Keyword("NULLS")},
						},
					},
					{
						Name: "count",
						Group: []Grammar{
							{Function{Name: "COUNT", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("integer")}},
							{Function{Name: "COUNT", Args: []Element{Option{Keyword("DISTINCT")}, Keyword("*")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("integer")}},
						},
						Description: Description{
							Template: "Returns the number of non-null values of %s.",
							Values:   []Element{Link("value")},
						},
					},
					{
						Name: "min",
						Group: []Grammar{
							{Function{Name: "MIN", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the minimum value of non-null values of %s. If all values are null, then returns %s.",
							Values:   []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "max",
						Group: []Grammar{
							{Function{Name: "MAX", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("primitive type")}},
						},
						Description: Description{
							Template: "Returns the maximum value of non-null values of %s. If all values are null, then returns %s.",
							Values:   []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "sum",
						Group: []Grammar{
							{Function{Name: "SUM", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the sum of float values of %s. If all values are null, then returns %s.",
							Values:   []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "avg",
						Group: []Grammar{
							{Function{Name: "AVG", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the average of float values of %s. If all values are null, then returns %s.",
							Values:   []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "stdev",
						Group: []Grammar{
							{Function{Name: "STDEV", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the sample standard deviation of float values of %s. If all values are null, then returns %s.",
							Values:   []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "stdevp",
						Group: []Grammar{
							{Function{Name: "STDEVP", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the population standard deviation of float values of %s. If all values are null, then returns %s.",
							Values:   []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "var",
						Group: []Grammar{
							{Function{Name: "VAR", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the sample variance of float values of %s. If all values are null, then returns %s.",
							Values:   []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "varp",
						Group: []Grammar{
							{Function{Name: "VARP", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the population variance of float values of %s. If all values are null, then returns %s.",
							Values:   []Element{Link("value"), Null("NULL")},
						},
					},
					{
						Name: "median",
						Group: []Grammar{
							{Function{Name: "MEDIAN", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("float")}},
						},
						Description: Description{
							Template: "Returns the sumedianm of float or datetime values of %s. If all values are null, then returns %s.\n" +
								"\n" +
								"Even if %s represents datetime values, this function returns a float or an integer value. " +
								"The return value can be converted to a datetime value by using the %s function.",
							Values: []Element{Link("value"), Null("NULL"), Link("value"), Keyword("DATETIME")},
						},
					},
					{
						Name: "listagg",
						Group: []Grammar{
							{Function{Name: "LISTAGG", Args: []Element{Option{Keyword("DISTINCT")}, Link("value"), Option{String("sep")}}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string result with the concatenated non-null values of %s. If all values are null, then returns %s.\n" +
								"\n" +
								"%s is placed between values. Empty string is the default.",
							Values: []Element{Link("value"), Null("NULL"), String("sep")},
						},
					},
					{
						Name: "json_agg",
						Group: []Grammar{
							{Function{Name: "JSON_AGG", Args: []Element{Option{Keyword("DISTINCT")}, Link("value")}, AfterArgs: []Element{Keyword("OVER"), Parentheses{Option{Link("partition_clause")}, Option{Link("order_by_clause"), Option{Link("windowing_clause")}}}}, Return: Return("string")}},
						},
						Description: Description{
							Template: "Returns the string formatted in JSON array of %s.",
							Values:   []Element{Link("value")},
						},
					},
				},
				Children: []Expression{
					{
						Label: "Partition Clause",
						Grammar: []Definition{
							{
								Name: "partition_clause",
								Group: []Grammar{
									{Keyword("PARTITION"), Keyword("BY"), ContinuousOption{Link("value")}},
								},
							},
						},
					},
					{
						Label: "Windowing Clause",
						Grammar: []Definition{
							{
								Name: "windowing_clause",
								Group: []Grammar{
									{Keyword("ROWS"), Link("window_position")},
									{Keyword("ROWS"), Keyword("BETWEEN"), Link("window_frame_low"), Keyword("AND"), Link("window_frame_high")},
								},
							},
							{
								Name: "window_position",
								Group: []Grammar{
									{Keyword("UNBOUNDED"), Keyword("PRECEDING")},
									{Integer("offset"), Keyword("PRECEDING")},
									{Keyword("CURRENT"), Keyword("ROW")},
								},
							},
							{
								Name: "window_frame_low",
								Group: []Grammar{
									{Keyword("UNBOUNDED"), Keyword("PRECEDING")},
									{Integer("offset"), Keyword("PRECEDING")},
									{Integer("offset"), Keyword("FOLLOWING")},
									{Keyword("CURRENT"), Keyword("ROW")},
								},
							},
							{
								Name: "window_frame_high",
								Group: []Grammar{
									{Keyword("UNBOUNDED"), Keyword("FOLLOWING")},
									{Integer("offset"), Keyword("PRECEDING")},
									{Integer("offset"), Keyword("FOLLOWING")},
									{Keyword("CURRENT"), Keyword("ROW")},
								},
							},
						},
					},
				},
			},
		},
	},
	{
		Label: "Parsing",
		Grammar: []Definition{
			{
				Name: "Tokens",
				Description: Description{
					Template: "" +
						"%s\n" +
						"  > An identifier is a word starting with any unicode letter or" +
						"    a Low Line(U+005F _) and followed by a character string that" +
						"    contains any unicode letters, any digits or Low Lines(U+005F _)." +
						"    You cannot use %s as an identifier.\n" +
						"\n" +
						"  > Notwithstanding above naming restriction, you can use most" +
						"    character strings as an identifier by enclosing in" +
						"    Grave Accents(U+0060 `) or Quotation Marks(U+0022 \") if" +
						"    --ansi-quotes is specified. Enclosure characters are escaped by" +
						"    back slashes or double enclosures.\n" +
						"\n" +
						"  > Identifiers represent tables, columns, functions or cursors." +
						"    Character case is insensitive except file paths, and whether file" +
						"    paths are case insensitive or not depends on your file system.\n" +
						"\n" +
						"%s\n" +
						"  > A string is a character string enclosed in Apostrophes(U+0027 ') or" +
						"    Quotation Marks(U+0022 \") if --ansi-quotes is not specified." +
						"    In a string, enclosure characters are escaped by back slashes or" +
						"    double enclosures.\n" +
						"\n" +
						"%s\n" +
						"  > An integer is a word that contains only [0-9].\n" +
						"\n" +
						"%s\n" +
						"  > A float is a word that contains only [0-9] with a decimal point.\n" +
						"\n" +
						"%s\n" +
						"  > A ternary is represented by any one keyword of TRUE, FALSE or" +
						"    UNKNOWN.\n" +
						"\n" +
						"%s\n" +
						"  > A datetime is a string formatted as datetime.\n" +
						"\n" +
						"%s\n" +
						"  > A null is represented by a keyword NULL.\n" +
						"\n" +
						"%s\n" +
						"  > A variable is a word starting with \"@\" and followed by a" +
						"    character string that contains any unicode letters, any digits or" +
						"    Low Lines(U+005F _).\n" +
						"\n" +
						"%s\n" +
						"  > A flag is a word starting with \"@@\" and followed by a character" +
						"    string that contains any unicode letters, any digits or" +
						"    Low Lines(U+005F _). Character case is ignored.\n" +
						"\n" +
						"%s\n" +
						"  > A environment variable is a word starting with \"@%%\" and followed" +
						"    by a character string that contains any unicode letters, any digits" +
						"    or Low Lines(U+005F _). If a environment variable includes other" +
						"    characters, you can use the variable by enclosing" +
						"    in Back Quotes(U+0060 `).\n" +
						"\n" +
						"%s\n" +
						"  > A runtime information is a word starting with \"@#\" and followed" +
						"    by a character string that contains any unicode letters, any digits" +
						"    or Low Lines(U+005F _). Character case is ignored." +
						"\n" +
						"%s\n" +
						"  > A system defined constant is a group of words represented by two" +
						"    words separated by \"::\". Character case is ignored.",
					Values: []Element{
						Identifier("Identifier"),
						Link("reserved words"),
						String("String"),
						Integer("Integer"),
						Float("Float"),
						Ternary("Ternary"),
						Datetime("Datetime"),
						Null("Null"),
						Variable("Variable"),
						Flag("Flag"),
						Variable("Environment Variable"),
						Variable("Runtime Information"),
						Variable("System Defined Constant"),
					},
				},
			},
			{
				Name: "Comments",
				Description: Description{
					Template: "" +
						"%s\n" +
						"  > A single line comment starts with a string \"--\" and ends with a line-break character.\n" +
						"%s\n" +
						"  > A block comment starts with a string \"/*\" and ends with a string \"*/\".",
					Values: []Element{
						Name("Line Comment"),
						Name("Block Comment"),
					},
				},
			},
			{
				Name: "Special Characters",
				Description: Description{
					Template: "In command parameters and statements, following strings represent special characters.\n" +
						"\n" +
						"```\n" +
						"  +----+-------------------------------------------+\n" +
						"  | \\a | U+0007 Bell                               |\n" +
						"  | \\b | U+0008 Backspace                          |\n" +
						"  | \\f | U+000C Form Feed                          |\n" +
						"  | \\n | U+000A Line Feed                          |\n" +
						"  | \\r | U+000D Carriage Return                    |\n" +
						"  | \\t | U+0009 Horizontal Tab                     |\n" +
						"  | \\v | U+000b Vertical Tab                       |\n" +
						"  | \\\" | U+0022 Double Quote                       |\n" +
						"  | \\' | U+0027 Single Quote (in strings only)     |\n" +
						"  | \\` | U+0060 Grave Accent (in identifiers only) |\n" +
						"  | \\\\ | U+005c Backslash                          |\n" +
						"  +----+-------------------------------------------+\n" +
						"```",
				},
			},
			{
				Name: "Reserved Words",
				Description: Description{
					Template: "" +
						"ABSOLUTE ADD AFTER AGGREGATE ALTER ALL AND ANY AS ASC AVG BEFORE BEGIN " +
						"BETWEEN BREAK BY CASE CHDIR CLOSE COMMIT CONTINUE COUNT CREATE CROSS " +
						"CSV_INLINE CUME_DIST CURRENT CURSOR DECLARE DEFAULT DELETE DENSE_RANK DESC DISPOSE " +
						"DISTINCT DO DROP DUAL ECHO ELSE ELSEIF END EXCEPT EXECUTE EXISTS " +
						"EXIT FALSE FETCH FIRST FIRST_VALUE FOLLOWING FOR FROM FULL FUNCTION " +
						"GROUP HAVING IF IGNORE IN INNER INSERT INTERSECT INTO IS JOIN JSONL " +
						"JSON_AGG JSON_INLINE JSON_OBJECT JSON_ROW JSON_TABLE LAG LAST LAST_VALUE LATERAL LEAD " +
						"LEFT LIKE LIMIT LISTAGG MAX MEDIAN MIN NATURAL NEXT NOT NTH_VALUE " +
						"NTILE NULL OFFSET ON ONLY OPEN OR ORDER OUTER OVER PARTITION PERCENT " +
						"PERCENT_RANK PRECEDING PREPARE PRINT PRINTF PRIOR PWD RANGE RANK RECURSIVE " +
						"RELATIVE RELOAD REMOVE RENAME REPLACE RETURN RIGHT ROLLBACK ROW ROW_NUMBER " +
						"SELECT SEPARATOR SET SHOW SOURCE STDEV STDEVP STDIN SUBSTRING SUM SYNTAX TABLE " +
						"THEN TO TRIGGER TRUE " +
						"UNBOUNDED UNION UNKNOWN UNSET UPDATE USING VALUES VAR VARP VIEW WHEN WHERE " +
						"WHILE WITH WITHIN",
				},
			},
		},
	},
	{
		Label: "Formatting",
		Grammar: []Definition{
			{
				Name: "String Format Placeholders",
				Description: Description{
					Template: "" +
						"%%[flag][width][.precision]specifier\n" +
						"\n" +
						"%s\n" +
						"```\n" +
						"    +--------------------+--------------------------------------+\n" +
						"    | +                  | Print a plus sign for numeric values |\n" +
						"    | ' ' (U+0020 Space) | Print a space instead of a plus sign |\n" +
						"    | -                  | Pad on the right                     |\n" +
						"    | 0                  | Pad with zeros                       |\n" +
						"    +--------------------+--------------------------------------+\n" +
						"```\n" +
						"%s\n" +
						"  > Width of the replaced string.\n" +
						"%s\n" +
						"  > Number of digits after the decimal point for a float value, or max length for a string value.\n" +
						"%s\n" +
						"```\n" +
						"    +---+-----------------------------------------------+\n" +
						"    | b | Base 2 integer                                |\n" +
						"    | o | Base 8 integer                                |\n" +
						"    | d | Base 10 integer                               |\n" +
						"    | x | Base 16 integer with lower cases              |\n" +
						"    | X | Base 16 integer with upper cases              |\n" +
						"    | e | Exponential notation with lower cases         |\n" +
						"    | E | Exponential notation with upper cases         |\n" +
						"    | f | Floating point decimal number                 |\n" +
						"    | s | String representation of the value            |\n" +
						"    | q | Quoted string representation of the value     |\n" +
						"    | i | Quoted identifier representation of the value |\n" +
						"    | T | Type of the value                             |\n" +
						"    | %% | '%%'                                           |\n" +
						"    +---+-----------------------------------------------+\n" +
						"```",
					Values: []Element{
						Name("flag"),
						Name("width"),
						Name("precision"),
						Name("specifier"),
					},
				},
			},
			{
				Name: "Datetime Format Placeholders",
				Description: Description{
					Template: "" +
						"```\n" +
						"+----+-------------------------------------------------------------+\n" +
						"| %%a | Abbreviation of week name (Sun, Mon, ...)                   |\n" +
						"| %%b | Abbreviation of month name (Jan, Feb, ...)                  |\n" +
						"| %%c | Month number (0 - 12)                                       |\n" +
						"| %%d | Day of month in two digits (01 - 31)                        |\n" +
						"| %%E | Day of month padding with a underscore (_1 - 31)            |\n" +
						"| %%e | Day of month (1 - 31)                                       |\n" +
						"| %%F | Microseconds that drops trailing zeros (empty - .999999)    |\n" +
						"| %%f | Microseconds (.000000 - .999999)                            |\n" +
						"| %%H | Hour in 24-hour (00 - 23)                                   |\n" +
						"| %%h | Hour in two digits 12-hour (01 - 12)                        |\n" +
						"| %%i | Minute in two digits (00 - 59)                              |\n" +
						"| %%l | Hour in 12-hour (1 - 12)                                    |\n" +
						"| %%M | Month name (January, February, ...)                         |\n" +
						"| %%m | Month number with two digits (01 - 12)                      |\n" +
						"| %%N | Nanoseconds that drops trailing zeros (empty - .999999999)  |\n" +
						"| %%n | Nanoseconds (.000000000 - .999999999)                       |\n" +
						"| %%p | Period in a day (AM or PM)                                  |\n" +
						"| %%r | Time with a period (%%H:%%i:%%s %%p)                            |\n" +
						"| %%s | Second in two digits (00 - 59)                              |\n" +
						"| %%T | Time (%%H:%%i:%%s)                                             |\n" +
						"| %%W | Week name (Sunday, Monday, ...)                             |\n" +
						"| %%Y | Year in four digits                                         |\n" +
						"| %%y | Year in two digits                                          |\n" +
						"| %%Z | Time zone in time difference                                |\n" +
						"| %%z | Abbreviation of Time zone name                              |\n" +
						"| %%%% | '%%'                                                         |\n" +
						"+----+-------------------------------------------------------------+\n" +
						"```\n" +
						"\n" +
						"%s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s\n" +
						"  > %s",
					Values: []Element{
						Name("Preset Datetime Format"),
						String("%Y-%m-%d"),
						String("%Y/%m/%d"),
						String("%Y-%c-%e"),
						String("%Y/%c/%e"),
						String("%Y-%m-%d %T%N"),
						String("%Y/%m/%d %T%N"),
						String("%Y-%c-%e %T%N"),
						String("%Y/%c/%e %T%N"),
						String("%Y-%m-%d %T%N %Z"),
						String("%Y/%m/%d %T%N %Z"),
						String("%Y-%c-%e %T%N %Z"),
						String("%Y/%c/%e %T%N %Z"),
						String("%Y-%m-%d %T%N %z"),
						String("%Y/%m/%d %T%N %z"),
						String("%Y-%c-%e %T%N %z"),
						String("%Y/%c/%e %T%N %z"),
						String("%Y-%m-%dT%T%N"),
						String("%Y-%m-%dT%T%N%Z"),
						String("%m %b %y %H:%i %Z"),
						String("%m %b %y %H:%i %z"),
					},
				},
			},
		},
	},
	{
		Label: "Flags of Regular Expressions",
		Description: Description{
			Template: "" +
				"%s\n" +
				"  > case-insensitive\n" +
				"%s\n" +
				"  > multi-line mode\n" +
				"%s\n" +
				"  > let . match \\n\n" +
				"%s\n" +
				"  > swap meaning of x* and x*?, x+ and x+?, etc.\n" +
				"",
			Values: []Element{
				String("i"),
				String("m"),
				String("s"),
				String("U"),
			},
		},
	},
	{
		Label: "Parameters",
		Grammar: []Definition{
			{
				Name: "Import Encoding",
				Description: Description{
					Template: "" +
						"```\n" +
						"+----------+---------------------------------------------+\n" +
						"| Value    |     Character Encoding                      |\n" +
						"+----------+---------------------------------------------+\n" +
						"| AUTO     | Detect encoding automatically               |\n" +
						"| UTF8     | UTF-8. Detect BOM automatically             |\n" +
						"| UTF8M    | UTF-8 with BOM                              |\n" +
						"| UTF16    | UTF-16. Detect BOM and Endian automatically |\n" +
						"| UTF16BE  | UTF-16 Big-Endian                           |\n" +
						"| UTF16LE  | UTF-16 Little-Endian                        |\n" +
						"| UTF16BEM | UTF-16 Big-Endian with BOM                  |\n" +
						"| UTF16LEM | UTF-16 Little-Endian with BOM               |\n" +
						"| SJIS     | Shift_JIS                                   |\n" +
						"+----------+---------------------------------------------+\n" +
						"```",
				},
			},
			{
				Name: "Export Encoding",
				Description: Description{
					Template: "" +
						"```\n" +
						"+----------+----------------------------------+\n" +
						"| Value    |     Character Encoding           |\n" +
						"+----------+----------------------------------+\n" +
						"| UTF8     | UTF-8                            |\n" +
						"| UTF8M    | UTF-8 with BOM                   |\n" +
						"| UTF16    | An alias of UTF16BE              |\n" +
						"| UTF16BE  | UTF-16 Big-Endian                |\n" +
						"| UTF16LE  | UTF-16 Little-Endian             |\n" +
						"| UTF16BEM | UTF-16 Big-Endian with BOM       |\n" +
						"| UTF16LEM | UTF-16 Little-Endian with BOM    |\n" +
						"| SJIS     | Shift_JIS                        |\n" +
						"+----------+----------------------------------+\n" +
						"```",
				},
			},
			{
				Name: "Line Break",
				Description: Description{
					Template: "" +
						"```\n" +
						"+-------+----------------------------------------------+\n" +
						"| Value |              Unicode Characters              |\n" +
						"+-------+----------------------------------------------+\n" +
						"| CRLF  | U+000D Carriage Return and U+000A Line Feed  |\n" +
						"| CR    | U+000D Carriage Return                       |\n" +
						"| LF    | U+000A Line Feed                             |\n" +
						"+-------+----------------------------------------------+\n" +
						"```",
				},
			},
			{
				Name: "Format",
				Description: Description{
					Template: "" +
						"```\n" +
						"+-------+------------------------------------------+\n" +
						"| Value |                  Format                  |\n" +
						"+-------+------------------------------------------+\n" +
						"| CSV   | Character separated values               |\n" +
						"| TSV   | Tab separated values                     |\n" +
						"| FIXED | Fixed-Length Format                      |\n" +
						"| JSON  | JSON Format                              |\n" +
						"| JSONL | JSON Lines Format                        |\n" +
						"| LTSV  | Labeled Tab-separated Values             |\n" +
						"| GFM   | Text Table for GitHub Flavored Markdown  |\n" +
						"| ORG   | Text Table for Emacs Org-mode            |\n" +
						"| BOX   | Text Table using Box-drawing characters  |\n" +
						"| TEXT  | Text Table for console                   |\n" +
						"+-------+------------------------------------------+\n" +
						"```",
				},
			},
			{
				Name: "JSON Escape Type",
				Description: Description{
					Template: "" +
						"```\n" +
						"+-----------+-------------------------------------------------------+\n" +
						"|   Value   |                      Description                      |\n" +
						"+-----------+-------------------------------------------------------+\n" +
						"| BACKSLASH | Escape special characters with Backslashes(U+005C \\)  |\n" +
						"| HEX       | Escape special characters with six-character sequence |\n" +
						"| HEXALL    | Escape all strings with six-character sequence        |\n" +
						"+-----------+-------------------------------------------------------+\n" +
						"```\n" +
						"\n" +
						"```\n" +
						"                 Escaped characters in JSON output\n" +
						"+------------------------+-----------+--------+-------------------+\n" +
						"|       Character        | BACKSLASH |  HEX   |        HEXALL     |\n" +
						"+------------------------+-----------+--------+-------------------+\n" +
						"| U+0022 Quotation Mark  | \\\"        | \\u0022 | \\u0022            |\n" +
						"| U+005C Backslash       | \\\\        | \\u005C | \\u005C            |\n" +
						"| U+002F Solidus         | \\/        | \\u002F | \\u002F            |\n" +
						"| U+0008 Backspace       | \\b        | \\u0008 | \\u0008            |\n" +
						"| U+000C Form Feed       | \\f        | \\u000C | \\u000C            |\n" +
						"| U+000A Line Feed       | \\n        | \\u000A | \\u000A            |\n" +
						"| U+000D Carriage Return | \\r        | \\u000D | \\u000D            |\n" +
						"| U+0009 Horizontal Tab  | \\t        | \\u0009 | \\u0009            |\n" +
						"| U+0000 - U+001F        | \\uXXXX    | \\uXXXX | \\uXXXX            |\n" +
						"| - U+FFFF               | N/A       | N/A    | \\uXXXX            |\n" +
						"| U+10000 -              | N/A       | N/A    | \\uXXXX\\uXXXX      |\n" +
						"|                        |           |        |  (Surrogate Pair) |\n" +
						"+------------------------+-----------+--------+-------------------+\n" +
						"```",
				},
			},
			{
				Name: "Timezone",
				Description: Description{
					Template: "" +
						"%s, %s or a timezone name in the IANA TimeZone database(in the form of \"Area/Location\". e.g. \"America/Los_Angeles\").\n" +
						"\n" +
						"The timezone database is required in order to use the timezone names. " +
						"Most Unix-like systems provide the database. " +
						"But if your system does not provide it and you have not installed Go Lang, " +
						"then you must put the database file named zoneinfo.zip to the directory \"$ZONEINFO\" or \"$GOROOT/lib/time/\".",
					Values: []Element{
						Keyword("Local"),
						Keyword("UTC"),
					},
				},
			},
		},
	},
}
