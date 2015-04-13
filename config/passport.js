// config/passport.js

// load all the things we need
var LocalStrategy   = require('passport-local').Strategy;

// load things required for resetting the password ** remember to remove from routes
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'himynameistimli@gmail.com', // change this later...
        pass: 'Slapshot1!'
    }
});



// load up the user model
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
var dbconfig = require('./database');
//var connection = mysql.createConnection(dbconfig.connection);

var pool = mysql.createPool(dbconfig.connection);

pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }
    var sql = 'USE ' + dbconfig.database;
    connection.query(sql, function(err, results) {
      connection.release(); // always put connection back in pool after last query
      if(err) { console.log(err); return; }
    });
});



//connection.query('USE ' + dbconfig.database);
// expose this function to our app using module.exports
module.exports = function(passport) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        pool.getConnection(function(err, connection) {
            if(err) { console.log(err); return; }
            //console.log(connection);
            var sql = 'USE ' + dbconfig.database;
            connection.query(sql, function(err, results) {
                connection.query("SELECT * FROM users WHERE id = ? ",[id], function(err, rows){
                    if(err) { console.log(err); return; }
                      connection.release(); // always put connection back in pool after last query
                      done(err, rows[0]);
                });
            });



        });



//        connection.query("SELECT * FROM users WHERE id = ? ",[id], function(err, rows){
//            done(err, rows[0]);
//        });
    });

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use(
        'local-signup',
        new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField : 'username',
            passwordField : 'password',
            passReqToCallback : true // allows us to pass back the entire request to the callback
        },
        function(req, username, password, done) {
            // find a user whose email is the same as the forms email
            // we are checking to see if the user trying to login already exists
            console.log(req.body.email);


            // put this somewhere -->   connection.release(); // always put connection back in pool after last query


            pool.getConnection(function(err, connection) {

                connection.query("SELECT * FROM users WHERE username = ?",[username], function(err, rows) {
                    if (err) {
                        connection.release();
                        return done(err);
                    }
                    if (rows.length) {
                        connection.release();
                        return done(null, false, req.flash('signupMessage', 'That username is already taken.'));
                    } else {
                        // if there is no user with that username
                        // create the user
                        var newUserMysql = {
                            username: username,
                            password: bcrypt.hashSync(password, null, null)  // use the generateHash function in our user model
                        };

                        var insertQuery = "INSERT INTO users ( username, password, email ) values (?,?,?)";

                        connection.query(insertQuery,[newUserMysql.username, newUserMysql.password, req.body.email],function(err, rows) {
                            connection.release();
                            newUserMysql.id = rows.insertId;
                            return done(null, newUserMysql);
                        });
                    }
                });
            });

        })
    );

    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use(
        'local-login',
        new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField : 'username',
            passwordField : 'password',
            passReqToCallback : true // allows us to pass back the entire request to the callback
        },
        function(req, username, password, done) { // callback with email and password from our form
            
            pool.getConnection(function(err, connection) {

                connection.query("SELECT * FROM users WHERE username = ?",[username], function(err, rows){
                    connection.release();
                    if (err){
                        return done(err);
                    }
                    if (!rows.length) {
                        return done(null, false, req.flash('loginMessage', 'No user found.')); // req.flash is the way to set flashdata using connect-flash
                    }

                    // if the user is found but the password is wrong
                    if (!bcrypt.compareSync(password, rows[0].password))
                    {
                        console.log(password);
                        console.log(rows[0].password);
                        console.log(bcrypt.compareSync(password, rows[0].password));
                        return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata
                    } else {
                    // all is well, return successful user
                    return done(null, rows[0]);     
                    }

                });

            });

        })
    );
};
