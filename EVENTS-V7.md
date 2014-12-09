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


Examples (Outgoing)
-------------------

### chatMsg

Send a chat message.

```
socket.emit('chatMsg', { msg: 'Message text here!' });
```

### pollOptions

Start a poll.

```
socket.emit('pollOptions', {
  name: 'Poll name',
  options: [
    'Poll option 1',
    'Poll option 2',
    'Poll option 3'
  ]
});
```

### raffleUsers

Perform a raffle using a list of names. The names don't have to
be of users in the chat.

```
socket.emit('raffleUsers', ['User1', 'User2', 'User3']);
```

### setColor

Request to set the client's username color. Expects exactly 6 hexadecimal characters
indicating color. Anything else will be ignored.

```
// Set color to #ff0000
socket.emit('setColor', 'ff0000');

// Set color to #123ABC
socket.emit('setColor', '123ABC');
```

### setName

Attmpt to set the client's username? Unsure when this is used, it always results in a kick.

```
socket.emit('setName', 'User123');
```
