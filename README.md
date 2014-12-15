Misaka
======

Misaka is a chat client/bot for [Picarto.tv].

To get Misaka up and running, first install the dependencies:
```
cd misaka
npm install
```

Then create a config file for your bot. A config file is just a JSON
file, check the `config/samples` directory for a few samples. At the
very least, the bot needs some way to authenticate, which requires a
username and either an authkey (V6-only) or a password.


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
