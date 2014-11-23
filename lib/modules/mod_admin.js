function AdminModule() {
  this.info = {
    name: 'Admin',
    commands: [
      { name: 'clear', callback: AdminModule.prototype.onClear.bind(this) }
    ],
    description: 'Provides commands for admin functionality'
  };
};

AdminModule.prototype.onClear = function(data) {
  data.clear();
};

module.exports = AdminModule;
