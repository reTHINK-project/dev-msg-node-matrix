var gulp = require('gulp');
var exec = require('child_process').exec;
var shell = require('gulp-shell');


// Gulp task to generate development documentation;
gulp.task('doc_alt', function(done) {

  console.log('Generating documentation... (this exec stuff does not really work)');
  exec('node_modules/.bin/jsdoc -R readme.md -d docs src/*', function(err, stdout, stderr) {
    if (err) return done(err);
    console.log('Documentation generated in "docs" directory');
    done();
  });

});

gulp.task('doc', [], shell.task([
  'node_modules/.bin/jsdoc -R README.md -d docs src/**'
]));

// Task and dependencies to distribute for all environments;
var babel = require('babelify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var exec = require('child_process');

gulp.task('build', function() {

  var bundler = browserify('./src/mn/MatrixMN.js',
  {
    standalone: 'MatrixMN',
    debug: false
  }).transform(babel);
  // exclude modules that are included directly in the implementation
  bundler.exclude('websocket');
  bundler.exclude('http');
  bundler.exclude('finalhandler');
  bundler.exclude('serve-static');
  bundler.exclude('matrix-js-sdk');
  bundler.exclude('matrix-appservice');
  bundler.exclude('matrix-appservice-bridge');

  var stubBundler = browserify('./src/stub/ProtoStubMatrix.js',
  {
    standalone: 'ProtoStubMatrix',
    debug: false
  }).transform(babel);

  function rebundle() {
    bundler.bundle()
      .on('error', function(err) {
        console.error(err);
        this.emit('end');
      })
      .pipe(source('MatrixMN.js'))
      .pipe(gulp.dest('./dist'));

    stubBundler.bundle()
      .on('error', function(err) {
        console.error(err);
        this.emit('end');
      })
      .pipe(source('ProtoStubMatrix.js'))
      .pipe(gulp.dest('./dist'));
  }

  rebundle();

});

gulp.task('dist', ['build'], shell.task([
  'mkdir -p dist',
  'cd ./dist && mkdir -p node_modules',
  'cd ./dist/node_modules && ln -s -f ../../node_modules/matrix-js-sdk',
  'cd ./dist/node_modules && ln -s -f ../../node_modules/promise',
  'cd ./dist/node_modules && ln -s -f ../../node_modules/url',
  'cd ./dist/node_modules && ln -s -f ../../node_modules/websocket',
  'cd ./dist && ln -s -f ../src/mn/rethink-mn-registration.yaml',
]))

gulp.task('startmn', ['dist'], shell.task([
  'cd dist && node MatrixMN -p 8011'
]));

gulp.task('test', [], shell.task([
  'karma start'
]));

gulp.task('help', function() {
  console.log('\nThe following gulp tasks are available:\n');
  console.log('gulp' + ' ' + 'help\t\t' + '# show this help\n');
  console.log('gulp' + ' ' + 'doc\t\t' + '# generates documentation in docs folder\n');
  console.log('gulp' + ' ' + 'build\t\t' + '# transpile and bundle the MatrixMN and ProtoStubMatrix\n');
  console.log('gulp' + ' ' + 'dist\t\t' + '# creates dist folder with transpiled code (depends on build)\n');
  console.log('gulp' + ' ' + 'startmn\t\t' + '# starts the MatrixMN from dist folder (depends on dist)\n');
  console.log('gulp' + ' ' + 'test\t\t' + '# executes the test cases\n');
})
