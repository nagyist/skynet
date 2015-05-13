// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var siofu    = require("socketio-file-upload");
var app      = express().use(siofu.router);
var port     = process.env.PORT || 3000;
var path     = require('path');
var passport = require('passport');
var flash    = require('connect-flash');
var server   = app.listen(port);
var io       = require('socket.io').listen(server);
// configuration ===============================================================
// connect to our database

require('./config/passport')(passport); // pass passport for configuration

var oneDay = 86400000;

app.configure(function() {

	// set up our express application
	app.use(express.logger('dev')); // log every request to the console
	app.use(express.cookieParser()); // read cookies (needed for auth)
	app.use(express.bodyParser({uploadDir:'./public/img/uploads'})); // get information from html forms
	app.use(express.favicon('./cc_icon.ico'));
	app.set('view engine', 'ejs'); // set up ejs for templating

	// required for passport
	app.use(express.compress());
	app.use(express.static(path.join(__dirname, 'public'), { maxAge: oneDay }));
	app.use(express.session({ secret: 'mummykoala' } )); // session secret
	app.use(passport.initialize());
	app.use(passport.session()); // persistent login sessions
	app.use(flash()); // use connect-flash for flash messages stored in session

});

// routes ======================================================================
require('./app/routes.js')(app, passport, io, siofu); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
console.log('The magic happens on port ' + port);
