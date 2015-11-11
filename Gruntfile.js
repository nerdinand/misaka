module.exports = function(grunt) {
  grunt.initConfig({
    ts: {
      default: {
        src: ['bin/misaka.ts', 'lib/Config.ts', 'lib/Logger.ts',
              'lib/Command.ts', 'lib/Module.ts', 'lib/ModuleManager.ts',
              'lib/UserList.ts', 'lib/OnlineWatcher.ts', 'lib/Picarto.ts',
              'lib/CommandProcessor.ts', 'lib/ClientManager.ts', 'lib/Bot.ts',
              'lib/MessageQueue.ts'],
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
