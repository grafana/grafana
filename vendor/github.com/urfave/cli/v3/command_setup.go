package cli

import (
	"flag"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func (cmd *Command) setupDefaults(osArgs []string) {
	if cmd.didSetupDefaults {
		tracef("already did setup (cmd=%[1]q)", cmd.Name)
		return
	}

	cmd.didSetupDefaults = true

	isRoot := cmd.parent == nil
	tracef("isRoot? %[1]v (cmd=%[2]q)", isRoot, cmd.Name)

	if cmd.ShellComplete == nil {
		tracef("setting default ShellComplete (cmd=%[1]q)", cmd.Name)
		cmd.ShellComplete = DefaultCompleteWithFlags
	}

	if cmd.Name == "" && isRoot {
		name := filepath.Base(osArgs[0])
		tracef("setting cmd.Name from first arg basename (cmd=%[1]q)", name)
		cmd.Name = name
	}

	if cmd.Usage == "" && isRoot {
		tracef("setting default Usage (cmd=%[1]q)", cmd.Name)
		cmd.Usage = "A new cli application"
	}

	if cmd.Version == "" {
		tracef("setting HideVersion=true due to empty Version (cmd=%[1]q)", cmd.Name)
		cmd.HideVersion = true
	}

	if cmd.Action == nil {
		tracef("setting default Action as help command action (cmd=%[1]q)", cmd.Name)
		cmd.Action = helpCommandAction
	}

	if cmd.Reader == nil {
		tracef("setting default Reader as os.Stdin (cmd=%[1]q)", cmd.Name)
		cmd.Reader = os.Stdin
	}

	if cmd.Writer == nil {
		tracef("setting default Writer as os.Stdout (cmd=%[1]q)", cmd.Name)
		cmd.Writer = os.Stdout
	}

	if cmd.ErrWriter == nil {
		tracef("setting default ErrWriter as os.Stderr (cmd=%[1]q)", cmd.Name)
		cmd.ErrWriter = os.Stderr
	}

	if cmd.AllowExtFlags {
		tracef("visiting all flags given AllowExtFlags=true (cmd=%[1]q)", cmd.Name)
		// add global flags added by other packages
		flag.VisitAll(func(f *flag.Flag) {
			// skip test flags
			if !strings.HasPrefix(f.Name, ignoreFlagPrefix) {
				cmd.Flags = append(cmd.Flags, &extFlag{f})
			}
		})
	}

	for _, subCmd := range cmd.Commands {
		tracef("setting sub-command (cmd=%[1]q) parent as self (cmd=%[2]q)", subCmd.Name, cmd.Name)
		subCmd.parent = cmd
	}

	cmd.ensureHelp()

	if !cmd.HideVersion && isRoot {
		tracef("appending version flag (cmd=%[1]q)", cmd.Name)
		cmd.appendFlag(VersionFlag)
	}

	if cmd.PrefixMatchCommands && cmd.SuggestCommandFunc == nil {
		tracef("setting default SuggestCommandFunc (cmd=%[1]q)", cmd.Name)
		cmd.SuggestCommandFunc = suggestCommand
	}

	if isRoot && cmd.EnableShellCompletion || cmd.ConfigureShellCompletionCommand != nil {
		completionCommand := buildCompletionCommand(cmd.Name)

		if cmd.ShellCompletionCommandName != "" {
			tracef(
				"setting completion command name (%[1]q) from "+
					"cmd.ShellCompletionCommandName (cmd=%[2]q)",
				cmd.ShellCompletionCommandName, cmd.Name,
			)
			completionCommand.Name = cmd.ShellCompletionCommandName
		}

		tracef("appending completionCommand (cmd=%[1]q)", cmd.Name)
		cmd.appendCommand(completionCommand)
		if cmd.ConfigureShellCompletionCommand != nil {
			cmd.ConfigureShellCompletionCommand(completionCommand)
		}
	}

	tracef("setting command categories (cmd=%[1]q)", cmd.Name)
	cmd.categories = newCommandCategories()

	for _, subCmd := range cmd.Commands {
		cmd.categories.AddCommand(subCmd.Category, subCmd)
	}

	tracef("sorting command categories (cmd=%[1]q)", cmd.Name)
	sort.Sort(cmd.categories.(*commandCategories))

	tracef("setting category on mutually exclusive flags (cmd=%[1]q)", cmd.Name)
	for _, grp := range cmd.MutuallyExclusiveFlags {
		grp.propagateCategory()
	}

	tracef("setting flag categories (cmd=%[1]q)", cmd.Name)
	cmd.flagCategories = newFlagCategoriesFromFlags(cmd.allFlags())

	if cmd.Metadata == nil {
		tracef("setting default Metadata (cmd=%[1]q)", cmd.Name)
		cmd.Metadata = map[string]any{}
	}

	if len(cmd.SliceFlagSeparator) != 0 {
		tracef("setting defaultSliceFlagSeparator from cmd.SliceFlagSeparator (cmd=%[1]q)", cmd.Name)
		defaultSliceFlagSeparator = cmd.SliceFlagSeparator
	}

	tracef("setting disableSliceFlagSeparator from cmd.DisableSliceFlagSeparator (cmd=%[1]q)", cmd.Name)
	disableSliceFlagSeparator = cmd.DisableSliceFlagSeparator

	cmd.setFlags = map[Flag]struct{}{}
}

func (cmd *Command) setupCommandGraph() {
	tracef("setting up command graph (cmd=%[1]q)", cmd.Name)

	for _, subCmd := range cmd.Commands {
		subCmd.parent = cmd
		subCmd.setupSubcommand()
		subCmd.setupCommandGraph()
	}
}

func (cmd *Command) setupSubcommand() {
	tracef("setting up self as sub-command (cmd=%[1]q)", cmd.Name)

	cmd.ensureHelp()

	tracef("setting command categories (cmd=%[1]q)", cmd.Name)
	cmd.categories = newCommandCategories()

	for _, subCmd := range cmd.Commands {
		cmd.categories.AddCommand(subCmd.Category, subCmd)
	}

	tracef("sorting command categories (cmd=%[1]q)", cmd.Name)
	sort.Sort(cmd.categories.(*commandCategories))

	tracef("setting category on mutually exclusive flags (cmd=%[1]q)", cmd.Name)
	for _, grp := range cmd.MutuallyExclusiveFlags {
		grp.propagateCategory()
	}

	tracef("setting flag categories (cmd=%[1]q)", cmd.Name)
	cmd.flagCategories = newFlagCategoriesFromFlags(cmd.allFlags())
}

func (cmd *Command) hideHelp() bool {
	tracef("hide help (cmd=%[1]q)", cmd.Name)
	for c := cmd; c != nil; c = c.parent {
		if c.HideHelp {
			return true
		}
	}

	return false
}

func (cmd *Command) ensureHelp() {
	tracef("ensuring help (cmd=%[1]q)", cmd.Name)

	helpCommand := buildHelpCommand(true)

	if !cmd.hideHelp() {
		if cmd.Command(helpCommand.Name) == nil {
			if !cmd.HideHelpCommand {
				tracef("appending helpCommand (cmd=%[1]q)", cmd.Name)
				cmd.appendCommand(helpCommand)
			}
		}

		if HelpFlag != nil {
			// TODO need to remove hack
			if hf, ok := HelpFlag.(*BoolFlag); ok {
				hf.applied = false
				hf.hasBeenSet = false
				hf.Value = false
				hf.value = nil
			}
			tracef("appending HelpFlag (cmd=%[1]q)", cmd.Name)
			cmd.appendFlag(HelpFlag)
		}
	}
}
