module.exports = function(grunt) {
  grunt.initConfig({
    ts: {
      default: {
        src: ['bin/misaka.ts', 'lib/Config.ts', 'lib/Logger.ts',
              'lib/Command.ts', 'lib/Module.ts', 'lib/ModuleManager.ts',
              'lib/UserList.ts'],
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
