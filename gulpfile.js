var fs = require('fs');
var gulp = require('gulp');
var rg = require('rangle-gulp');
var inject = require('gulp-inject');
var colors = require('colors');
var runSequence = require('run-sequence');
var angularFileSort = require('gulp-angular-filesort');
var watch = require('gulp-watch');
var bower = require('gulp-bower');
var sass = require('gulp-sass');
var del = require('del');
var cp = require('ncp').ncp;
var through = require('through2');


var sassFiles = ['src/app/**/*sass', 'src/app/**/*scss'];
var htmlFiles = ['src/app/**/*html', 'src/index.html'];
var angularFiles = ['!src/app/**/*.test.js',
  'src/app/app.js',
  'src/app/services/*.js',
  'src/app/**/*-directive.js',
  'src/app/**/*-controller.js'
];

var appFiles = ['src/app/app.js', 'src/app/**/*.js', '!./src/app/**/*.test.js'];
var testFiles = ['./src/app/**/*.test.js'];
var karmaFile = './testing/karma.conf.js';

var karamConfig = {
  karmaConf: karmaFile,
  files: testFiles,
  vendor: [
    'src/bower_components/angular/angular.js',
    'src/bower_components/angular-mocks/angular-mocks.js',
    'src/bower_components/q/q.js',
    'src/bower_components/lodash/dist/lodash.js',
    'src/bower_components/koast-angular/dist/koast.js',
  ],
  showStack: true
};


//Buildrules for specific file sets. These help ensure that the file structure
//remains consistent throughout the project (file not explicitly included
//will simply be ignored by the server).

gulp.task('build_bower', function (done) {
  bower().on('end', function () {
    fs.symlinkSync(__dirname + '/src/bower_components', 'build/bower_components');
    done();
  });
});

gulp.task('build_html', function () {
  return gulp.src(['src/app/**/*html', 'src/index.html'], {
      base: 'src'
    })
    .pipe(inject(
      gulp.src(angularFiles) .pipe(angularFileSort()),
      {relative: true}
     ))
    .pipe(gulp.dest('build'));
});

gulp.task('build_angular', function () {
  return gulp.src(angularFiles, {
      base: 'src'
    })
    .pipe(gulp.dest('build'));
});

gulp.task('build_css', function () {
  return gulp.src(sassFiles, {
      base: 'src'
    })
    .pipe(sass())
    .pipe(gulp.dest('build'));
});

gulp.task('build', function () {
  del.sync('build');
  fs.mkdirSync('build');
  runSequence('build_html', 'build_css', 'build_angular', 'build_bower');
});

gulp.task('watch', function () {
  watch(sassFiles, { base: 'src' })
    .pipe(sass({errLogToConsole:true}))
    .pipe(gulp.dest('build'));

  watch(htmlFiles, { base: 'src' })
    .pipe(inject(
      gulp.src(angularFiles).pipe(angularFileSort()), {
        relative: true
      })
     )
     .pipe(gulp.dest('build'));

  watch(angularFiles, { base: 'src' }, function (files) {
    files.pipe(gulp.dest('build'));
    return gulp.src(htmlFiles, { base: 'src' })
      .pipe(inject(gulp.src(angularFiles) .pipe(angularFileSort()), {
          relative: true
        }))
      .pipe(gulp.dest('build'));
  });
});


//Prepared dist for server

gulp.task('server', function () {
  runSequence('build', 'watch');
  var reload = rg.connectWatch({
    root: './build',
    glob: './build/**/*',
    livereload: true
  });
});

gulp.task('dev', function () {
  rg.connectWatch({
    root: './src',
    livereload: true,
    glob: './src/**/*'
  });
  rg.karmaWatch(karamConfig)();
});

gulp.task('jshint', rg.jshint({
  files: appFiles
}));

gulp.task('beautify', rg.beautify({
  files: [appFiles[0]]
}));

//Run this before comitting

gulp.task('lint', function () {
  return runSequence('jshint', 'beautify');
});


gulp.task('test', rg.karma(karamConfig));

gulp.task('default', function () {
  console.log('***********************'.yellow);
  console.log(
    '  gulp dev: start a server in the  root folder and watch dev files'.yellow
  );
  console.log('  gulp test: run unit tests'.yellow);
  console.log('  gulp build: hint, lint, and minify files into ./dist '.yellow);
  console.log('***********************'.yellow);
});
