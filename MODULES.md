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
in this case), it will be sent as a chat message.

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
