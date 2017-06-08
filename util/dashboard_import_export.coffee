# requirejs = require "requirejs"
# requirejs.config { nodeRequire: require }
# define = require("amdefine")(module)  if typeof define isnt "function"
# config = require "../src/config.js"
# console.log "test"



program = require 'commander'
colors = require 'colors'
argv = require("minimist") process.argv.slice 2
fs = require "fs"
rest = require "restler"
assert = require 'assert'

program.version('0.0.1')
  .option('-h, --host [host]', 'ElasticSearch host to export to/import from',"localhost")
  .option("-p, --port [port]",null,9200)
  .option("-e --export [DashboardName]","Export the named Grafana Dashboard from ElasticSearch")
  .option("-o --overwrite","Whether or not to overwrite should the export file already exist",false)
  .option("-i --import [DashboardFile.json]","Import the given file in ElasticSearch")
  .parse(process.argv)


level_set = if argv['d']? then 7 else 6

logger = new(require('caterpillar').Logger)({
  level: level_set
})
filter = new(require('caterpillar-filter').Filter)()
human = new(require('caterpillar-human').Human)()

logger.pipe(filter).pipe(human).pipe process.stdout

if program.import && program.export
  console.log "error".red.inverse,"Can't both import & export!"
  process.exit 0

if program.export
  Dashboard_ENDPOINT = "http://#{program.host}:#{program.port}/grafana-dash/dashboard/#{program.export}"

  rest.get(Dashboard_ENDPOINT).on 'complete', processResponse = (data) ->
    if !data.exists
      logger.log "error","#{program.export} doesn't exist on ElasticSearch host #{program.host}:#{program.port}"
    else if !data._source.dashboard
      logger.log("oddly the file had no dashboard source in it, are you sure it's a properly formed dashboard file?")
    else
      fileName = "#{program.export}.json"

      if (!fs.existsSync(fileName) or (fs.existsSync(fileName) and argv.o==true))

        fd = fs.openSync(fileName, "w")

        fileBuffer = new Buffer data._source.dashboard

        written = fs.writeSync fd,fileBuffer,null,fileBuffer.length

        assert.ok(written > 3)

        fs.closeSync fd

        logger.log("info",("Success".green.inverse+": #{fileName} dashboard file was successfully written"))

      else
        console.log "error".red.inverse,"File exists, will not overwrite file unless -o is specified"

else if program.import
  fileName = "#{program.import}"
  logger.log "Will import file #{fileName}"
  
  if !fs.existsSync(fileName)
    console.log "error".red.inverse,"File #{fileName} doesn't exist"
    process.exit 0
  else
    contents = fs.readFileSync(fileName).toString()

    oDashboard = JSON.parse(contents)
    
    dashboardTitle = JSON.parse(contents).title
    
    oMain = { dashboard: contents, group: "guest",tags: [], title: dashboardTitle, user: "guest" }
    
    Dashboard_ENDPOINT = "http://#{program.host}:#{program.port}/grafana-dash/dashboard/#{dashboardTitle}"

    rest.putJson(Dashboard_ENDPOINT,oMain).on 'complete', processResponse = (data,response) ->
      if !response.statusCode == 200
        console.log "There was an issue"
        console.log "Response code was #{response.statusCode}"
      else logger.log "'#{dashboardTitle}' imported successfully"
      console.dir data


else
  console.log "error".red.inverse,"You need to tell me whether to export or import!"
  program.help()





