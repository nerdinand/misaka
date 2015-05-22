Modules
=======

Misaka is a module-based bot. Modules are currently loaded from
the `lib/modules` directory, as well as `lib/modules/private` for
modules that aren't tracked by git. All module files start with
`mod_` and end with the `.js` file extension.


Info field
----------

Module instances must provide an `info` field with information
about the module, including its name, description, commands, and
other things.

Name        | Necessary | Purpose
----------- | :-------: | -----------------------------------------------------------------------------------
description | Yes       | Module description 
name        | Yes       | Module name
callbacks   | No        | Specify [callbacks](Module Callbacks)
chatVersion | No        | Chat version(s) this module supports (Number or Array of Numbers) (default: [6, 7])
command     | No        | Command that this module presents
commands    | No        | Array of commands that this module presents
master      | No        | Whether or not this module is usable by master only (default: false)
unloadable  | No        | Whether or not this module can be unloaded (default: true)


Sample Module
-------------

This exports a sample module that provides a 'something' command.
The 'something' command will have Misaka send 'Something!' to the
chat. If a String is returned in a module callback (`onSomething`
in this case), it will be sent as a response.

```
function SampleModule() {
  this.info = {
    name: 'Sample',
    description: 'Sends text',
    command: { name: 'something', callback: SampleModule.prototype.onSomething.bind(this) }
  };
};

SampleModule.prototype.onSomething = function(data) {
  return 'Something!';
};

module.exports = SampleModule;
```


Command Callbacks
-----------------

Command callbacks are provided a data object with the following properties:

Property | Description
-------- | --------------------------------------------------------------------------
client   | Picarto client instance (lib/picarto.js).
database | Database manager (lib/db_manager.js).
helper   | Module helper instance (lib/module_helper.js).
logger   | Logger (lib/logger.js).
message  | Full message.
mode     | Message mode, either 'chat' or 'whisper'.
parent   | Parent Misaka instance.
parsed   | Parsed message, the result of ModuleHelper#parseCommandMessage.
respond  | Function to respond depending on the mode.
room     | Object with one property, 'name'. Provided for older modules.
roomname | Channel name.
send     | Function to send a chat message: `send('hello')`.
sender   | Username of the sender.
user     | User object of the sender.
whisper  | Function to whisper back: `whisper('hi')`, or: `whisper('user123', 'hi')`.


Module Callbacks
----------------

##### 'join' event

The 'join' event is fired after the channel has been initially joined.

Property | Description
-------- | -------------------------------------------------------------
client   | Picarto client instance (lib/picarto.js).
config   | Module-specific config object.
database | Database manager (lib/db_manager.js).
logger   | Logger (lib/logger.js).
parent   | Parent Misaka instance.
room     | Object with one property, 'name'. Provided for older modules.
roomname | Channel name.
send     | Function to send a chat message: `send('hello')`.
whisper  | Function to whisper to someone: `whisper('user123', 'hi')`.

##### 'load' event

The 'load' event is fired after the module has been loaded.

Property | Description
-------- | ------------------------------------
channel  | Channel name
config   | Module-specific config object
database | Database manager (lib/db_manager.js)
parent   | Parent Misaka instance

##### 'unload' event

The 'unload' event is fired after a module is manually unloaded, and (currently)
takes no parameters.
