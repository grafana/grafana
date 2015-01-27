# Description:
#   A way to interact with the Google Images API.
#
# Commands:
#   hubot image me <query> - The Original. Queries Google Images for <query> and returns a random top result.
#   hubot animate me <query> - The same thing as `image me`, except adds a few parameters to try to return an animated GIF instead.
#   hubot mustache me <url> - Adds a mustache to the specified URL.
#   hubot mustache me <query> - Searches Google Images for the specified query and mustaches it.

module.exports = (robot) ->
  robot.hear /grafana (.*)/i, (msg) ->
    sendUrl msg.match[1]

  robot.router.get '/hubot/test', (req, res) ->
    sendUrl()
    res.send 'OK '

imageMe = (msg, cb) ->
  cb 'http://localhost:3000/render/dashboard/solo/grafana-play-home?from=now-1h&to=now&panelId=4&fullscreen'

sendUrl = (params) ->
  https = require 'https'
  querystring = require 'querystring'
  opts = params.split(' ')
  dashboard = opts[0]
  panelId = opts[1]
  from = opts[2]

  imageUrl = "http://localhost:3000/render/dashboard/solo/#{dashboard}/?panelId=#{panelId}"
  link = "http://localhost:3000/dashboard/db/#{dashboard}/?panelId=#{panelId}&fullscreen"
  if from
    imageUrl += "&from=#{from}"
    link += "&from=#{from}"

  console.log 'imageUrl: ' + imageUrl

  hipchat = {}
  hipchat.format = 'json'
  hipchat.auth_token = process.env.HUBOT_HIPCHAT_TOKEN
  console.log 'token: ' + hipchat.auth_token

  hipchat.room_id = '877465'
  hipchat.message = "<a href='#{link}'><img src='#{imageUrl}'></img></a>"
  hipchat.from = "hubot"
  hipchat.message_format = "html"

  params = querystring.stringify(hipchat)

  path = "/v1/rooms/message/?#{params}"

  data = ''

  https.get {host: 'api.hipchat.com', path: path}, (res) ->
      res.on 'data', (chunk) ->
          data += chunk.toString()
      res.on 'end', () ->
          json = JSON.parse(data)
          console.log "Hipchat response ", data


