package option

const DefaultEnvJson = `
{
  "datetime_format": [],
  "timezone": "Local",
  "ansi_quotes": false,
  "interactive_shell": {
    "history_file": ".csvq_history",
    "history_limit": 500,
    "prompt": "\u001b[34;1m@#WORKING_DIRECTORY${(IF(@#UNCOMMITTED, ' \u001b[33;1m(Uncommitted:' || @#CREATED + @#UPDATED + @#UPDATED_VIEWS || ')', ''))}\u001b[34;1m >\u001b[0m ",
    "continuous_prompt": " > ",
    "completion": true,
    "kill_whole_line": false,
    "vi_mode": false
  },
  "environment_variables": {},
  "palette": {
    "effectors": {
      "label": {
        "effects": [
          "Bold"
        ],
        "foreground": "Blue",
        "background": null
      },
      "number": {
        "effects": [],
        "foreground": "Magenta",
        "background": null
      },
      "string": {
        "effects": [],
        "foreground": "Green",
        "background": null
      },
      "boolean": {
        "effects": [
          "Bold"
        ],
        "foreground": "Yellow",
        "background": null
      },
      "ternary": {
        "effects": [],
        "foreground": "Yellow",
        "background": null
      },
      "datetime": {
        "effects": [],
        "foreground": "Cyan",
        "background": null
      },
      "null": {
        "effects": [],
        "foreground": "BrightBlack",
        "background": null
      },
      "object": {
        "effects": [
          "Bold"
        ],
        "foreground": "Green",
        "background": null
      },
      "attribute": {
        "effects": [],
        "foreground": "Yellow",
        "background": null
      },
      "identifier": {
        "effects": [
          "Bold"
        ],
        "foreground": "Cyan",
        "background": null
      },
      "value": {
        "effects": [
          "Bold"
        ],
        "foreground": "Blue",
        "background": null
      },
      "emphasis": {
        "effects": [
          "Bold"
        ],
        "foreground": "Red",
        "background": null
      },
      "json_object_key": {
        "effects": [
          "Bold"
        ],
        "foreground": "Blue",
        "background": null
      },
      "json_number": {
        "effects": [],
        "foreground": "Magenta",
        "background": null
      },
      "json_string": {
        "effects": [],
        "foreground": "Green",
        "background": null
      },
      "json_boolean": {
        "effects": [
          "Bold"
        ],
        "foreground": "Yellow",
        "background": null
      },
      "json_null": {
        "effects": [],
        "foreground": "BrightBlack",
        "background": null
      },
      "syntax_name": {
        "effects": [
          "Italic"
        ],
        "foreground": null,
        "background": null
      },
      "syntax_keyword": {
        "effects": [
          "Bold"
        ],
        "foreground": "Green",
        "background": null
      },
      "syntax_link": {
        "effects": [
          "Bold",
          "Italic"
        ],
        "foreground": "Magenta",
        "background": null
      },
      "syntax_variable": {
        "effects": [
          "Bold",
          "Italic"
        ],
        "foreground": "Yellow",
        "background": null
      },
      "syntax_flag": {
        "effects": [
          "Italic"
        ],
        "foreground": "Yellow",
        "background": null
      },
      "syntax_italic": {
        "effects": [
          "Italic"
        ],
        "foreground": null,
        "background": null
      },
      "syntax_type": {
        "effects": [],
        "foreground": "BrightBlack",
        "background": null
      },
      "prompt": {
        "effects": [],
        "foreground": "Blue",
        "background": null
      },
      "error": {
        "effects": [
          "Bold"
        ],
        "foreground": "Red",
        "background": null
      },
      "warn": {
        "effects": [
          "Bold"
        ],
        "foreground": "Yellow",
        "background": null
      },
      "notice": {
        "effects": [],
        "foreground": "Green",
        "background": null
      }
    }
  }
}`
