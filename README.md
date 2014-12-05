Misaka
======

Misaka is a chat client/bot for [Picarto.tv].

To get Misaka up and running, first install the dependencies:
```
cd misaka
npm install
```

Then create a config file for your bot. A config file is just a JSON
file, check `config/sample.json` for a sample:
```
{
  "username": "Misaka",
  "authkey": "SomeAuthkeyHere"
}
```

At the very least, a username and an authkey need to be defined.
The username is the username of the bot's account, and the authkey
needs to be extracted from the HTML.

Config fields
-------------

Name       | Description
---------- | ----------------------------------------------------------------------
authkey    | Used for authentication, not necessary if using password
color      | Chat name color
master     | Username of master account
modules    | Object with config objects for separate modules, mapped by module name
password   | Picarto account password, not necessary if using authkey
username   | Picarto account username

See `config/samples` for some sample config files.

Getting the authkey
-------------------

To find the authkey for an account, go to any channel while logged
in and view the HTML. Look for something like this:
```
<script>
    initChatStyle();
    var dataRef = new Firebase("https://picarto.firebaseio.com/");
    dataRef.auth("AReallyLongStringOfCharactersHere", function(error) {
    ...
</script>
```

The first argument for dataRef.auth will be the authkey. You'll need to
copy and paste that into the config file as the authkey value.

[Picarto.tv]:https://www.picarto.tv
