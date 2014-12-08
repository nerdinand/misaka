Events
======

This describes the events sent/received by the V7 chat client.

Incoming events (listened for by the client via `socket.on`):

Name            | Description
--------------- | -----------
channelUsers    | Todo
chatMode        | Todo
clearChat       | Todo
color           | Todo
commandHelp     | Todo
finishPoll      | Todo
globalMsg       | Todo
meMsg           | Todo
modList         | Todo
modToolsVisible | Todo
onlineState     | Todo
pollVotes       | Todo
raffleUsers     | Todo
runPoll         | Todo
showPoll        | Todo
srvMsg          | Todo
userMsg         | Todo
voteResponse    | Todo
whisper         | Todo
wonRaffle       | Todo

Outgoing events (emitted by the client via `socket.emit`):

Name            | Description
--------------- | -----------
chatMsg         | Send a chat message
endPoll         | End a poll (?)
pollOptions     | Specify options for a poll (?)
pollVote        | Vote for a poll (?)
raffleUsers     | Perform a raffle given some users (?)
setColor        | Set username color
setName         | Set name (always causes a kick?)
