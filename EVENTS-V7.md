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
nameResp        | Todo
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
setName         | Attempt to set name, with a `nameResp` event sent in response.


Examples (Incoming)
-------------------

### nameResp

Response event for `setName`.

```
socket.on('nameResp', function(data) {
  if(data === true) {
    // Name was successfully set
    console.log('Name was set!');
  } else {
    // If not true, data will be a message indicating why
    // setting the name failed
    console.error('Couldn\'t set name: ' + data);
  }
});
```

### onlineState

Emitted when the viewer count changes. If `viewers` is `-1`, the stream went offline.

```
socket.on('onlineState', function(data) {
  if(data.viewers === -1) {
    console.log('Stream is offline');
  } else {
    console.log('Current viewers: ' + data.viewers);
  }
});
```

### whisper

Emitted when a whisper is received from another user.

```
socket.on('whisper', function(data) {
  console.log(data.username + ' whispered: ' + data.msg);
});
```


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

Attempt to set the client's username. Will result in a kick if a name has already
been set.

```
socket.emit('setName', 'User123');
```
