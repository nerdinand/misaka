function AdminModule() {
  this.info = {
    name: 'Admin',
    description: 'Provides commands for admin functionality',
    commands: [
      { name: 'clear', callback: AdminModule.prototype.onClear.bind(this) }
    ],
    master: true
  };
};

AdminModule.prototype.onClear = function(data) {
  // Todo
};

module.exports = AdminModule;
