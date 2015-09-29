Misaka
======

[![Dependency Status](https://david-dm.org/saneki/misaka.svg)](https://david-dm.org/saneki/misaka) [![optionalDependency Status](https://david-dm.org/saneki/misaka/optional-status.svg)](https://david-dm.org/saneki/misaka#info=optionalDependencies)

Misaka is a chat client/bot for [Picarto.tv].

To get Misaka up and running, first install the dependencies:
```
cd misaka
npm install
```

Then create a config file for your bot. A config file is just a JSON
file, check the `config/samples` directory for a few samples. At the
very least, the bot needs to authenticate, which requires a username
and a password.


Config fields
-------------

Name       | Description
---------- | ----------------------------------------------------------------------
color      | Chat name color
master     | Username of master account
modules    | Object with config objects for separate modules, mapped by module name
password   | Picarto account password
username   | Picarto account username

See `config/samples/sample.json` for a sample config file.


[Picarto.tv]:https://www.picarto.tv
