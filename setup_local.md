# Only a temporary file. This needs to be deleted in the final PR. 

### Debug environment in vscode :

Add the snippet to .vscode/launch.json
    ```
```json
{
      "name": "Launch chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}",
},
```

And launch in Chrome to debug. This should launch chrome in a separate profile.

### Start Grafana
Grafana backend and frontend must be started separately in addition to the debugger

install dependencies:

```bash
$ brew install node@20 && brew link node@20
```

Start the server:

```bash
$ yarn install --immutable
$ yarn start
```

run the backend

```bash
$ make run
```


### Loki datasource
Add loki datasource from Grafana UI and point to localhost:3100

####  Install manually 
This should be good to use to port-forward and point to ops or dev query-frontend

####  Install separately 
this should spin up a docker instance with loki running and a data gen (if needed)
```bash
$ make devenv sources=loki
```


### Explore App to local Grafana
// TODO