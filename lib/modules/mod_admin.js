function AdminModule() {
  this.info = {
    name: 'Admin',
    commands: [
      { name: 'clear', callback: AdminModule.prototype.onClear.bind(this) }
    ],
    description: 'Provides commands for admin functionality',
    master: true
  };
};

AdminModule.prototype.onClear = function(data) {
  // Todo
};

module.exports = AdminModule;
