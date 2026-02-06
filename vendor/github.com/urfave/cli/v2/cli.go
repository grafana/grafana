// Package cli provides a minimal framework for creating and organizing command line
// Go applications. cli is designed to be easy to understand and write, the most simple
// cli application can be written as follows:
//
//	func main() {
//		(&cli.App{}).Run(os.Args)
//	}
//
// Of course this application does not do much, so let's make this an actual application:
//
//	func main() {
//		app := &cli.App{
//	  		Name: "greet",
//	  		Usage: "say a greeting",
//	  		Action: func(c *cli.Context) error {
//	  			fmt.Println("Greetings")
//	  			return nil
//	  		},
//		}
//
//		app.Run(os.Args)
//	}
package cli

//go:generate make -C cmd/urfave-cli-genflags run
