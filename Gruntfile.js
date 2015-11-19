module.exports = function(grunt) {
  grunt.initConfig({
    ts: {
      default: {
        src: [
          'bin/misaka.ts',
          'lib/Bot.ts',
          'lib/ClientManager.ts',
          'lib/Command.ts',
          'lib/CommandProcessor.ts',
          'lib/Config.ts',
          'lib/DbManager.ts',
          'lib/Logger.ts',
          'lib/MessageQueue.ts',
          'lib/Module.ts',
          'lib/ModuleHelper.ts',
          'lib/ModuleManager.ts',
          'lib/OnlineWatcher.ts',
          'lib/Picarto.ts',
          'lib/UserList.ts',
          'lib/Util.ts',
          'lib/interfaces/SocketInterface.ts'
        ],
        outDir: 'build',
        options: {
          target: 'es5',
          module: 'commonjs'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-ts');
  grunt.registerTask('default', ['ts']);
};
