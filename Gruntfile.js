module.exports = function(grunt) {
  grunt.initConfig({
    ts: {
      default: {
        src: ['bin/misaka.ts', 'lib/Config.ts', 'lib/logger.ts'],
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
