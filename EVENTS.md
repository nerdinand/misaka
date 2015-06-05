Events
======

This describes the events sent/received by the V7 chat client.

Incoming events (listened for by the client via `socket.on`):

Name            | Description
--------------- | -----------
channelUsers    | Array of user objects for the userlist/ban list
chatMode        | Marks chat as read-only if false (default not sent/true)
clearChat       | Clear chat history
color           | New colour notification for personal colour change sync between connections
commandHelp     | Response from /help, array of cmd/desc objects
finishPoll      | Notification when poll ends
globalMsg       | Global server notification (sent by Picarto.TV admins)
meMsg           | /me formatted messages
modList         | Array of moderators, triggered by /sm or /showmods
modToolsVisible | 0 = normal user, 1 = moderator, 2 = admin/streamer
nameResp        | Response for choosing a name (true for success, string for reason name isn't available)
onlineState     | Viewer count for the current stream (-1 = offline)
pollVotes       | Poll vote data update (vote count)
raffleUsers     | Contains an array of users able to be put in a raffle, triggered by /r or /raffle
runPoll         | Notification to show poll details entry screen to streamer
showPoll        | Show poll, object {name: "Question", options: [ {id: index/refid (used in pollVotes), option: "option name"} ] }
srvMsg          | Server notification
userMsg         | User message
voteResponse    | Response to say user has voted, disables the "vote" buttons
whisper         | Whisper response (enableReply = true if recepient, false if sender)
wonRaffle       | Raffle ending, format {winner: "name", host: "streamer username"}

Outgoing events (emitted by the client via `socket.emit`):

Name            | Description
--------------- | -----------
chatMsg         | Send a chat message
endPoll         | End a poll
pollOptions     | Specify options for a poll
pollVote        | Vote for a poll
raffleUsers     | Perform a raffle given some users
setColor        | Set username color
setName         | Query the server if a name can be set (if you have a name, kicks for exploiting)

*These will NOT be sent on join, only if state changes - the PHP server will send these normally.*
*API of some form is coming soon for things such as these*

New incoming events (Available and working, but not yet implemented client-side - wait for the site update):

Name                  | Description
--------------------- | -----------
adultMode             | New 18+ state (true/false)
contentType           | If content type has changed (an AJAX request will need to be made)
descriptionChange     | If channel description has changed (an AJAX request will need to be made)
commissionsAvailable  | New commission availability state (true/false)
commissionInfoChanged | If channel description has changed (an AJAX request will need to be made)
gameMode              | Game mode state (true/false)

New outgoing events (Available and working, but not yet implemented client-side - wait for the site update):

Name                  | Description
--------------------- | -----------
adultMode             | Notify other clients of new 18+ state (true/false)
contentType           | Notify other clients content type has changed
descriptionChange     | Notify other clients channel description has changed
commissionsAvailable  | Notify other clients of new commission availability state (true/false)
commissionInfoChanged | Notify other clients channel description has changed
gameMode              | Game mode state (true/false) - WILL NOT ALLOW CONFLICTING STATES, resets on channel offline to false. Will remind the streamer every 30 mins if they are in this state.

Other new events:

Name                  | Description
--------------------- | -----------
clearUser             | Clear all messages by a user
removeMessage         | Remove a specified message


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
// Note: when joining an online channel, the 'channel' key may be excluded
// example data: { channel: 'channelName', viewers: 2 }
socket.on('onlineState', function(data) {
  if(data.viewers === -1) {
    console.log(data.channel + '\'s stream is offline');
  } else {
    console.log('Current viewers for ' + data.channel + ': ' + data.viewers);
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
