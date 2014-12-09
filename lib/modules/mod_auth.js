function AuthModule() {
  this.info = {
    name: 'Auth',
    description: 'Provides commands for firebase authentication',
    command: { name: 'unauth', callback: AuthModule.prototype.onUnauth.bind(this) },
    master: true,
    chatVersions: 6
  };
}

AuthModule.prototype.onUnauth = function(data) {
  data.parent.client.firebase.unauth();
};

module.exports = AuthModule;
