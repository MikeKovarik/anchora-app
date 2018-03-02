'use strict'

var path = require('path')
var gulp = require('gulp')
var sourcemaps = require('gulp-sourcemaps')
var babel = require('gulp-babel')
var plumber = require('gulp-plumber')
var notify = require('gulp-notify')
var htmlmin = require('gulp-htmlmin')
var fn = require('gulp-fn')
var concat = require('gulp-concat')


// Must be absolute or relative to source map
var sourceRoot = __dirname
var paths = {
	es6: 'src/**/*.js',
	html: 'src/**/*.html',
	dest: 'dist',
}

var babelConfig = {
	//retainLines: true,
	moduleIds: true,
	plugins: [
		//'external-helpers',
		'transform-es2015-modules-amd',
		'transform-decorators-legacy',
		'transform-class-properties',
	]
}

gulp.task('es6', function() {
	return gulp.src(paths.es6)
		.pipe(plumber({errorHandler: notify.onError("FRONTEND: <%= error.message %>")}))
		.pipe(sourcemaps.init())
		.pipe(babel(babelConfig))
		.pipe(concat('bundle-scripts.js'))
		.pipe(sourcemaps.write('.', {sourceRoot}))
		.pipe(gulp.dest(paths.dest))
})
gulp.task('es6-watch', ['es6'], function() {
	gulp.watch(paths.es6, ['es6'])
})

gulp.task('templates', function() {
	return gulp.src(paths.html)
		.pipe(plumber({errorHandler: notify.onError("FRONTEND: <%= error.message %>")}))
		.pipe(htmlmin({
			removeComments: true,
			collapseWhitespace: true,
			minifyCSS: true,
			minifyJS: true
		}))
		.pipe(fn(amdTextPluginTransformer))
		.pipe(concat('bundle-templates.js'))
		.pipe(gulp.dest(paths.dest))
})
gulp.task('templates-watch', ['templates'], function() {
	gulp.watch(paths.html, ['templates'])
})

function amdTextPluginTransformer(file) {
	var content = file._contents ? sanitizeTemplate(file._contents.toString()) : ''
	var modulename = path.normalize(path.relative(file.base, file.path)).replace(/\\/g, '/')
	var newContent = `define('${modulename}!text', ['module'], function(module) {module.exports = "${content}";});`
	file._contents = new Buffer(newContent)
}

function sanitizeTemplate(content) {
	return content
		.replace(/(["\\])/g, '\\$1')
		.replace(/[\f]/g, "\\f")
		.replace(/[\b]/g, "\\b")
		.replace(/[\n]/g, "\\n")
		.replace(/[\t]/g, "\\t")
		.replace(/[\r]/g, "\\r")
		.replace(/[\u2028]/g, "\\u2028")
		.replace(/[\u2029]/g, "\\u2029")
}


gulp.task('default', ['es6-watch', 'templates-watch'])
gulp.task('build', ['es6', 'templates'])
