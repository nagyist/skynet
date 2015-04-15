// app/routes.js

var crypto = require('crypto');
var nodemailer = require('nodemailer');
var bcrypt = require('bcrypt-nodejs');
var csv = require('express-csv')
var transporter = nodemailer.createTransport({
    host:'mail.sunseap.com',
    name:'mail.sunseap.com',
    ignoreTLS:true,
    secure: false,
    port:'25',
    auth: {
        user: 'billing@sunseap.com',
        pass: 'sunseap123'
    }
});

var email_header = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> <html xmlns=http://www.w3.org/1999/xhtml> <head><meta name=viewport content=width=device-width><meta http-equiv=Content-Type content="text/html; charset=UTF-8"> <title>Sunseap Enterprise Leasing</title><link rel=stylesheet type=text/css href=http://localhost:3000/css/email.css></head> <body bgcolor=#FFFFFF> <!-- HEADER --> <table class=head-wrap bgcolor=#ffffff> <tr> <td></td> <td class="header container"> <div class=content> <table bgcolor=#ffffff> <tr class=border_bottom> <td><img src=http://localhost:3000/img/sunseap_logo_trans.jpg height=50px></td> <td align=right><h3 class=collapse>Sunseap Enterprise Leasing</h3></td> </tr> </table> </div> </td> <td></td> </tr> </table><!-- /HEADER --> <!-- BODY --> <table class=body-wrap> <tr> <td></td> <td class=container bgcolor=#ffffff> <div class=content> <table> <tr> <td> ';

var email_footer = '<table class=social width=100%> <tr> <td> <!-- column 1 --> <table align=left class=column> <tr> <td> <h5 class>Connect with Us:</h5> <p class><a href=https://www.facebook.com/pages/Sunseap-Leasing-Pte-Ltd/229265037238616 class="soc-btn fb">Facebook</a></p> </td> </tr> </table><!-- /column 1 --> <!-- column 2 --> <table align=left class=column> <tr> <td> <h5 class>Contact:</h5> <p>Phone: <strong>+65 6602 8086</strong><br> Email: <strong><a href=emailto:enquiries@sunseap-leasing.com>enquiries@sunseap-leasing.com</a></strong></p> </td> </tr> </table><!-- /column 2 --> <span class=clear></span> </td> </tr> </table><!-- /social & contact --> </td> </tr> </table> </div><!-- /content --> </td> <td></td> </tr> </table><!-- /BODY --> <!-- FOOTER --> <table class=footer-wrap> <tr> <td></td> <td class=container> <!-- content --> <div class=content> <table> <tr> <td align=center> <p> <a href=http://www.sunseap-leasing.com/news.html>News</a> | <a href=http://www.sunseap-leasing.com/aboutus.html>About Us</a> | <a href=http://www.sunseap-leasing.com/>Home</a> </p> </td> </tr> </table> </div><!-- /content --> </td> <td></td> </tr> </table><!-- /FOOTER --> </body> </html> ';
// pdf generation
var fs = require('fs');
var PDF = require('pdfkit');            //including the pdfkit module

// moment (time adjustments)
var moment = require('moment');

var mysql = require('mysql');
var dbconfig = require('../config/database');
// testing pooled connections
//var connection = mysql.createConnection(dbconfig.connection);
var pool = mysql.createPool(dbconfig.connection);



pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }
    var sql = 'USE ' + dbconfig.database;
    connection.query(sql, [], function(err, results) {
      connection.release(); // always put connection back in pool after last query
      if(err) { console.log(err); return; }
    });
});

// Additional Routes
//var user = require('./user');


module.exports = function(app, passport, io, siofu ) {

  // Call Additional Routes
  //user(app, passport, pool, transporter, mysql, pool);


io.on('connection', function (socket) {

  var uploader = new siofu();
  uploader.dir = "img/uploads";
  uploader.listen(socket);

  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});

  // =====================================
  // HOME PAGE (with login links) ========
  // =====================================
  app.get('/', function(req, res) {
    res.render('index.ejs',{ message: '' }); // load the index.ejs file
  });

  // =====================================
  // LOGIN ===============================
  // =====================================
  // show the login form
  app.get('/login', function(req, res) {
    // render the page and pass in any flash data if it exists
    res.render('login.ejs', { message: req.flash('loginMessage') });
  });

  // process the login form
  app.post('/login', passport.authenticate('local-login', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
    }),
        function(req, res) {
            if (req.body.remember) {
              req.session.cookie.maxAge = 1000 * 60 * 3;
            } else {
              req.session.cookie.expires = false;
            }
        res.redirect('/');
    });

  // =====================================
  // SIGNUP ==============================
  // =====================================
  // show the signup form (but this won't be in use, as we'll use the add account as the option)
  app.get('/signup', function(req, res) {
    // render the page and pass in any flash data if it exists
    res.render('signup.ejs', { message: req.flash('signupMessage') });
  });

  // process the signup form
  app.post('/signup', passport.authenticate('local-signup', {
    successRedirect : '/profile', // redirect to the secure profile section
    failureRedirect : '/signup', // redirect back to the signup page if there is an error
    failureFlash : true // allow flash messages
  }));


  // =====================================
  // CREATE USER  ========================
  // =====================================
  // this page is for administrators to create f_accounts for other clients or administrators
  app.get('/createuser/:accountname', isLoggedIn,function(req, res) {

      res.render('createuser.ejs', {
        message: ''
      });


  });

  // this creates a user outside of the passport
  app.post('/createuser',isLoggedIn, function(req, res, next ) {

  pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }

          // f_accounts // create account lookup with role
          var insertQuery = "INSERT INTO f_accounts ( username, roleid, accountid  ) values (?,?,?)";
          connection.query(insertQuery,[req.body.username, req.body.roleid, req.body.accountid],function(err, rows) {
            
                // users update
                var insertQuery = "INSERT INTO users ( username, password, email ) values (?,?,?)";
                connection.query(insertQuery,[req.body.username, bcrypt.hashSync(req.body.password, null, null), req.body.email],function(err, rows) {

                  if (err) { 
                      connection.release(); 
                      req.flash('createMessage', 'User Already Exists.');
                      res.render('createuser.ejs' , {
                        message: req.flash('createMessage')});
                  } else { 
                    
                    connection.query("SELECT * FROM f_accounts WHERE username = ?",req.user.username, function(err, rows) {
                      connection.release(); 
                      req.flash('createMessage', 'User Account Created.');
                      res.render('createuser.ejs' , {message: req.flash('createMessage')});
                    });
                  }
                }); // users
          }); // f_accounts

    }); // pool

  });



  // =====================================
  // EDIT USER SECTION ===================
  // =====================================
  // this lets you edit the user (only the access level)
  app.get('/edituser/:accountname/:username', isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("select * from f_accounts fa left join d_roles dr on fa.roleid = dr.roleid left join d_accounts da on fa.accountid = da.accountid where fa.username = ? and da.accountname = ?",[req.params.username, req.params.accountname], function(err, rows) {
        connection.query("select roleid from f_accounts where username= ?",[req.user.username], function(err, role) {
          connection.release();
          res.render('edituser.ejs', {
            username : req.params.username,  // get the user out of session and pass to template
            myrole: role[0].roleid,
            accountname: req.params.accountname,
            user: rows,
            message: ''
          });
        }); // roleid
      }); // rows
    });

  });

  app.post('/edituser/:accountname/:username', isLoggedIn, function(req, res) {
  

    if (req.body.submit == "edit") {
        pool.getConnection(function(err, connection) {
          if(err) { console.log(err); return; }
          var sql = "UPDATE f_accounts fa left join d_accounts da on fa.accountid = da.accountid set roleid = ? WHERE fa.username = ? and da.accountname = ?";
          connection.query(sql, [req.body.roleid, req.params.username, req.params.accountname], function(err, rows) {
              if(err) { console.log(err); return; }  
            connection.release(); // always put connection back in pool after last query
            
            res.redirect('/viewuser/'+req.params.accountname+'');

          });

        });

    } else if (req.body.submit == "delete") {

      // deletes from f_accounts
      // deletes from  users
      // deletes from f_groups_access
      // deletes from d_user_profile
        var sql = "DELETE fa, u, fg, du from f_accounts fa left join users u on fa.username = u.username \
                   left join f_groups_access fg on fa.username = fg.username left join d_user_profile du on du.username = fa.username where fa.username = ?";
        pool.getConnection(function(err, connection) {
          connection.query(sql, [req.body.username], function(err, rows) {
              if(err) { console.log(err); return; }  
            connection.release(); // always put connection back in pool after last query
            res.redirect('/viewuser/'+req.params.accountname+'');
          });
        });
    }

  });

  // =====================================
  // REQUEST USER ACCOUNT =====================
  // =====================================
  // show the request form
  app.get('/request', function(req, res) {
    // render the page and pass in any flash data if it exists
    res.render('request.ejs', {});
  });

  app.post('/requestuser', function(req, res) {
    transporter.sendMail({
        from: 'alert@sunseap.com',
        to: 'alert@sunseap.com',
        subject: 'Sunseap Enterprise Leasing Account Request',
        html: email_header+'<p class="lead">Sunseap Enterprise Leasing Account Request</p>A user account was requested by:<br> <br> Name: '+req.body.username+'<br>Email: '+req.body.email+'<br> Account: '+req.body.account +' <br><br>Please log in and create a user, or refer this request to the client administrator.<br><br><br><br><br><br>'+ email_footer
    });
    res.render('index.ejs', { message:'User Account Request was sent.' });

  });

  // =====================================
  // RESET PASSWORD ======================
  // =====================================
  // show the request form

  app.get('/resetpassword', function(req, res) {
    // render the page and pass in any flash data if it exists
    res.render('resetpassword.ejs', {message: ''});
  });

  app.post('/resetpassword', function(req, res) {


  pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }

    connection.query("SELECT * FROM users WHERE email = ?",[req.body.email], function(err, rows) {
        if (rows.length) {
                crypto.randomBytes(48, function(ex, buf) {
                var token = buf.toString('hex');
                  transporter.sendMail({
                    from: 'alert@sunseap.com',
                    to: req.body.email,
                    subject: 'Sunseap Password Reset',
                    html: '<img src="http://localhost:3000/img/sunseap_logo_trans.jpg"> Sunseap Enterprise Leasing <br><br> You recently requested to reset your password. Please <a href="http://130.211.243.86:3000/changepassword/'+token+'">click here</a> to reset your password. If this request was not from you, please ignore this e-mail. <br><br><br> - Sunseap Enterprise Leasing'
                  });

                var insertQuery = "INSERT INTO resetpass (email, token) values (?,?)";
                connection.query(insertQuery,[req.body.email, token], function(err, rows){
                  connection.release(); // always put connection back in pool after last query
                });
              });

            req.flash('resetMessage', 'An e-mail was sent to your inbox.');
            res.render('resetpassword.ejs',{message: req.flash('resetMessage')});
        } else {
            connection.release(); // always put connection back in pool after last query
            req.flash('resetMessage', 'That e-mail does not exist in our records.');
            res.render('resetpassword.ejs',{message: req.flash('resetMessage')});
        }
    });


  });


  });

  // =====================================
  // CHANGE PASSWORD =====================
  // =====================================
  // change the password and remove the token from the server

  app.get('/changepassword/:token',function(req, res){


  pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }

    connection.query("SELECT users.username, users.email, resetpass.token FROM resetpass  join users on resetpass.email = users.email WHERE token = ?",[req.params.token], function(err, rows) {
                  //console.log(req.params.token);
                  //console.log(rows);
                  connection.release(); // always put connection back in pool after last query
                  if (rows.length) {

                    res.render('changepassword.ejs' , {message: req.flash('changeMessage'), token: req.params.token, email: rows[0].email, user: rows[0].username});

                  } else {
                      req.flash('changeMessage', 'Sorry, this request has expired. Please reset again.');
                      res.render('changepassword.ejs',{message: req.flash('changeMessage'), token: req.params.token,email: null, user: null});
                  }
    });


  });






  });


  app.post('/changepassword',function(req, res){

  pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }
    
    connection.query("SELECT * FROM resetpass WHERE token = ?",[req.body.token], function(err, rows) {
      if (rows.length) {
        var removeQuery = "DELETE from resetpass where email = ?";
          connection.query(removeQuery,[rows[0].email], function(err, rows) { connection.release(); });
        
        var changeQuery = "UPDATE users set password = ? where username = ?";
          //console.log('plain text password', req.body.password)
          bcrypt.hash(req.body.password, null, null, function(err, hash) {
              connection.query(changeQuery,[hash, req.body.username], function(err, rows) { connection.release(); });
              //console.log(req.body.username);
              //console.log(req.body.password);
              //console.log(hash);
              req.flash('changeMessage', 'Password has been successfully changed.');
              res.render('changepassword.ejs' , {message: req.flash('changeMessage'), token: rows[0].token,email: rows[0].email, user: req.body.username});
          });

      } else {
          connection.release(); // always put connection back in pool after last query
          req.flash('changeMessage', 'Sorry, this request has expired. Please reset again.');
          res.render('changepassword.ejs',{message: req.flash('changeMessage'), token: rows[0].token,email: null, user: req.body.username});
      }
    });
  });

});




	// =====================================
	// PROFILE SECTION =========================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	app.get('/profile', isLoggedIn, function(req, res) {


    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      connection.query("select roleid from f_accounts fa where fa.username = ?",req.user.username, function(err, role) {

        if (role[0].roleid == 0) {
        accountquery = "SELECT fa.username,da.accountid,da.accountname,dr.roleid, dr.rolename FROM f_accounts as fa left join d_accounts as da on 1 = 1 left join d_roles as dr on fa.roleid = dr.roleid where fa.username = ?"
      } else {
        accountquery = "SELECT fa.username,da.accountid,da.accountname,dr.roleid, dr.rolename FROM f_accounts as fa left join d_accounts as da on fa.accountid = da.accountid left join d_roles as dr on fa.roleid = dr.roleid where fa.username = ?"
      }

        connection.query(accountquery,req.user.username, function(err, accounts) {
          // this will be for groups
          connection.query("select * from f_groups_access as fga left join d_groups as dg on dg.groupid = fga.groupid where fga.username = ? order by groupname ",req.user.username, function(err, groups) {

            connection.query("SELECT username,firstname,lastname,phone,address,city,postal,emailnotify,smsnotify FROM d_user_profile WHERE username = ?",req.user.username, function(err, profile) {
                connection.query("select timestamp,fal.accountid,fal.username,fal.announcement,da.accountname from f_alerts as fal left join d_accounts as da on da.accountid = fal.accountid left join f_accounts as fa on fa.accountid = da.accountid where fal.accountid = 0 or (fa.username = ?) order by timestamp desc limit 5",[req.user.username], function(err,alerts){
                  connection.query("SELECT fa.username,fa.roleid,fa.accountid,fas.assetid, da.assetname FROM f_accounts as fa left join f_asset as fas on fas.accountid = fa.accountid left join d_asset da on fas.assetid = da.assetid WHERE fa.username = ? ",[req.user.username], function(err,assets){

                 
                    connection.release(); // always put connection back in pool after last query
                    
                      if(profile == undefined || !profile.length) {


                        app.locals({
                          user : req.user,
                          accounts: accounts,
                          groups: groups,
                          assets: assets,
                          profile: '',
                          appmessage:''

                        });

                        req.flash('message', '<b>Welcome!</b> You haven\'t updated your contact information. Please update it <b><a href=\'/editprofile\'>here</a></b>');
                        res.render('profile.ejs', {
                          user : req.user, // get the user out of session and pass to template
                          accounts: accounts,
                          groups: groups,
                          assets: assets,
                          profile: '',
                          alerts: alerts,
                          message:req.flash('message')
                        });

                     } else {

                        app.locals({
                          user : req.user,
                          accounts: accounts,
                          groups: groups,
                          assets: assets,
                          profile: profile
                        });

                        res.render('profile.ejs', {
                          user : req.user, // get the user out of session and pass to template
                          accounts: accounts,
                          groups: groups,
                          assets: assets,
                          profile: profile,
                          alerts: alerts,
                          message:''
                        });
                    }

                }); //assets
              }); //alerts
            }); //profile
          }); //groups
        }); //accounts
      }); //role

    });
	});

  // =====================================
  // EDIT PROFILE SECTION =========================
  // =====================================
  // this lets you edit your profile
  app.get('/editprofile', isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("SELECT du.firstname,du.lastname,du.phone,du.address,du.city,du.postal,du.emailnotify,du.smsnotify from d_user_profile as du  WHERE du.username = ?",[req.user.username], function(err, rows) {
        if(err) { console.log(err); return; }
        connection.release();

        if(rows) { // if it exists
          res.render('editprofile.ejs', {
            user: rows,
            message: ''
          });
        } else {
            res.render('editprofile.ejs', {
            user: '',
            message: ''
          });
        }

      });
    });

  });

  

app.post('/editprofile',isLoggedIn, function(req, res, next ) {
      // user wants to rename an asset


    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("select * from d_user_profile where username = ? ",req.user.username,function(err, rows) {
          // checks to see if the row exists already
          if(!!rows.length) { // if it exists
            console.log('update row');
            var insertQuery = "UPDATE d_user_profile SET firstname = ?,lastname = ?,phone = ?,address = ?,city = ?,postal = ?,emailnotify = ?,smsnotify = ? where username = ?";
          } else { // if it doesnt exist
            console.log('insert row');
            var insertQuery = "INSERT into d_user_profile (firstname,lastname,phone,address,city,postal,emailnotify,smsnotify, username) values (?,?,?,?,?,?,?,?,?)";
          }
          
          connection.query(insertQuery,[req.body.firstname, req.body.lastname,req.body.phone,req.body.address,req.body.city,req.body.postal,req.body.emailnotify,req.body.smsnotify,req.user.username],function(err, rows) {
              if (err) {  console.log(err);
                  connection.query("SELECT du.firstname,du.lastname,du.phone,du.address,du.city,du.postal,du.emailnotify,du.smsnotify from d_user_profile as du  WHERE du.username = ?",[req.user.username], function(err, rows) {
                    connection.release(); // always put connection back in pool after last query
                    req.flash('message', 'There was an error. Please try again.');
                    res.render('editprofile.ejs' , {user: rows, message: req.flash('message')});
                  });
              } else { 
                  connection.query("SELECT du.firstname,du.lastname,du.phone,du.address,du.city,du.postal,du.emailnotify,du.smsnotify from d_user_profile as du  WHERE du.username = ?",[req.user.username], function(err, rows) {
                    connection.release(); // always put connection back in pool after last query
                    req.flash('message', 'Profile updated.');
                    res.render('editprofile.ejs' , {user: rows, message: req.flash('message')});
                  });
              }
          });
      });
    }); // pool

  });





	// =====================================
	// VIEW USERS SECTION =========================
	// =====================================
	// this lets you view users in your account
	app.get('/viewuser/:accountname', isLoggedIn, function(req, res) {
    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("SELECT  users.username, users.email, d_roles.rolename, d_accounts.accountname,du.firstname,du.lastname,du.phone,du.address,du.city,du.postal,du.emailnotify,du.smsnotify FROM f_accounts left join d_accounts on f_accounts.accountid = d_accounts.accountid left join d_roles on f_accounts.roleid = d_roles.roleid left join users on f_accounts.username = users.username left join d_user_profile as du on du.username = f_accounts.username WHERE d_accounts.accountname = ?",[req.params.accountname], function(err, rows) {
        connection.release(); // always put connection back in pool after last query
        res.render('viewuser.ejs', {
          accountname : req.params.accountname, // get the user out of session and pass to template
          users: rows
        });
      });
    });
	});


	// =====================================
	// EXPORT USER LIST SECTION ============
	// =====================================
	// this lets you view users in your account

	app.get('/viewuser/export/users_:accountname', isLoggedIn, function(req, res) {
    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("SELECT users.username, users.email, d_roles.rolename, d_accounts.accountname,du.firstname,du.lastname,du.phone,du.address,du.city,du.postal,du.emailnotify,du.smsnotify FROM f_accounts left join d_accounts on f_accounts.accountid = d_accounts.accountid left join d_roles on f_accounts.roleid = d_roles.roleid left join users on f_accounts.username = users.username left join d_user_profile as du on du.username = f_accounts.username WHERE d_accounts.accountname = ?",[req.params.accountname], function(err, rows) {
        connection.release(); // always put connection back in pool after last query
        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        rows.unshift(headers);
        res.csv(rows);
      });
    });
	});


  // =====================================
  // CREATE GROUP  =======================
  // =====================================
  // this page is for administrators to create f_accounts for other clients or administrators
  app.get('/creategroup',isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("select fa.assetid,da.assetname,da.blockno,da.unitno,da.street,da.postcode,da.remarks,da.lat,da.lng,fa.accountid,dac.accountname from f_asset fa left join d_asset da on da.assetid = fa.assetid left join d_accounts dac on dac.accountid = fa.accountid ",[], function(err, rows) {
         if(err) { console.log(err); return; }
         connection.release(); // always put connection back in pool after last query
         res.render('creategroup.ejs', {
          user : req.user, // get the user out of session and pass to template
          assets: rows,
          message: ''
        });
       });
    });

  });

  // this creates a user outside of the passport
  app.post('/creategroup',isLoggedIn, function(req, res, next ) {

    console.log(req.body.assetid)

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      // checks to see if group exists already
      connection.query("SELECT groupname from d_groups where groupname = ?",req.body.groupname, function(err, group) {
        if(err) { console.log(err); return; }
        if (!!group.length) { // if the group exists
        // return error
            req.flash('message', 'This group ('+req.body.groupname+') already exists.');
            res.render('creategroup.ejs' , {user:req.user,message: req.flash('message')});
        } else { // if the group doesnt exist
          
          // add to d_groups
          var insertQuery = "INSERT INTO d_groups ( groupname, description, blockno, unitno,street,postcode,remarks ) values (?,?,?,?,?,?,?)";
          connection.query(insertQuery,[req.body.groupname, req.body.description,req.body.blockno,req.body.unitno,req.body.street,req.body.postcode,req.body.remarks],function(err, rows) {
            if(err) { console.log(err); return; }

            // get the groupid from d_groups
            connection.query("SELECT groupid, groupname from d_groups where groupname = ?",req.body.groupname, function(err, groupid) {
            if(err) { console.log(err); return; }
                // add to groups_access
                var insertQuery = "INSERT INTO f_groups_access (groupid, username, notes) values (?,?,?)";
                connection.query(insertQuery,[groupid[0].groupid, req.user.username,'creator' ],function(err, rows) {
                  
                  var fgroup = [];

                  req.body.assetid.forEach(function(err, index) {

                    fgroup[index] = [groupid[0].groupid, req.body.accountid,req.body.assetid[index]]

                    })

                    console.log(fgroup);

                    // save to f_groups
                    connection.query("INSERT INTO f_groups (groupid, accountid, assetid) values ?",[fgroup], function(err, rows) {

                        connection.query("select fa.assetid,da.assetname,da.blockno,da.unitno,da.street,da.postcode,da.remarks,da.lat,da.lng,fa.accountid,dac.accountname from f_asset fa left join d_asset da on da.assetid = fa.assetid left join d_accounts dac on dac.accountid = fa.accountid ",[], function(err, rows) {

                          if (err) { 
                            console.log(err);
                            connection.release(); // always put connection back in pool after last query
                            req.flash('message', 'There is a problem with your request. Please try again.');
                            res.render('creategroup.ejs' , {user:req.user,assets: rows, message: req.flash('message')});
                          } else {
                            connection.release(); // always put connection back in pool after last query
                            req.flash('message', 'Group added successfully.');
                            res.render('creategroup.ejs' , {user:req.user,assets: rows, message: req.flash('message')});
                          }


                        }); // add to get_assets


                    }); // add to f_group

                }); // add to groups_access

            }); // select d_groups

          }); // add to d_groups

            }
        });  // groups check



    }); // pool

  });





  // ===============================================================================================================
  // ACCOUNT SECTION ===============================================================================================
  // ===============================================================================================================
  // we will want this protected so you have to be logged in to visit
  // we will use route middleware to verify this (the isLoggedIn function)
  app.get('/account/:accountname', isLoggedIn, function(req, res) {

  // provides start and end date for the report (move later)
  var startdate = moment(new Date()).subtract(8,'d').format("YYYY-MM-DD 00:00:00");
  var enddate = moment(new Date()).add(1,'d').format("YYYY-MM-DD 00:00:00");

  pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }

  connection.query("call hourly_gen_by_account(?,?)",[req.params.accountname,30], function(err, hourly) {

  connection.query("call current_power_by_account(?)",[req.params.accountname], function(err, power) {

    connection.query("call daily_gen_by_account(?,?) ",[req.params.accountname,10], function(err, rows) {
    
      connection.query("call weekly_gen_by_account(?,?) ",[req.params.accountname,10], function(err, weekly) {

        connection.query("call monthly_gen_by_account(?,?) ",[req.params.accountname,10], function(err, monthly) {

          connection.query("select fa.assetid, da.assetname, da.street, da.postcode, da.remarks, da.lat, da.lng, dac.accountid, dac.accountname from f_asset fa \
                          left join d_asset da on fa.assetid = da.assetid left join d_accounts dac on fa.accountid = dac.accountid where dac.accountname = ?",req.params.accountname, function(err, assets) {
            //console.log(rows);

            connection.query("select DAY(m.timestamp) as day,Month(m.timestamp) as month, Year(m.timestamp) as year, \
                              m.Energy_Importing, m.Energy_Exporting from MeterLog m left join d_asset da on da.assetid = m.MeterNo \
                              left join f_asset fa on fa.assetid = da.assetid left join d_accounts dac on dac.accountid = fa.accountid \
                              WHERE dac.accountname = ? and m.Timestamp between ? and ? \
                              group by year, month, day order by m.TimeStamp asc",[req.params.accountname,startdate,enddate], function(err, sum) {
              //console.log(sum);

                  var headers = {};
                  for (key in rows[0]) {
                      headers[key] = key;
                  }
                  connection.release();
                  res.render('account.ejs', {
                    moment:moment,
                    power:power,
                    data: rows,
                    hourly: hourly,
                    weekly: weekly,
                    monthly: monthly,
                    sum: sum,
                    header:headers, // no longer needed
                    accountname: req.params.accountname,
                    assets:assets,
                    start: startdate,
                    end: enddate,
                    message:''
                  });
                });
              });
        }); // query - sum
      }); // query - assets
    }); // query - rows
  }); // query - account
  }); // query - hourly
  }); // pool

});


app.post('/account/file-upload/:accountname', function(req, res, next) {
    console.log(req.body);
    console.log(req.files);

    var tmp_path = req.files.image.path;
    var type = '';
    if (req.files.image.type == 'image/jpeg'){
      type = '.jpg';
    }
    else if (req.files.image.type == 'image/png'){
      type = '.png';
    }
    else if (req.files.image.type == 'image/gif'){
      type = '.gif';
    }

    // set where the file should actually exists - in this case it is in the "images" directory
    var target_path = './public/img/company/' + req.params.accountname + type;
    // move the file from the temporary location to the intended location
    fs.rename(tmp_path, target_path, function(err) {
        if (err) throw err;
        // delete the temporary file, so that the explicitly set temporary upload dir does not get filled with unwanted files
        fs.unlink(tmp_path, function() {
            if (err) throw err;
        });
    });

    res.redirect('/account/'+req.params.accountname);


});

  app.post('/account/:accountname', isLoggedIn, function(req, res) {

      var startdate = moment(req.body.start,'DD/MM/YYYY').format("YYYY-MM-DD 00:00:00");
      var enddate = moment(req.body.end,'DD/MM/YYYY').format("YYYY-MM-DD 00:00:00");


    if(req.body.submit == "export") {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      connection.query("select * from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ? and MeterLog.TimeStamp between ? and ? order by MeterLog.TimeStamp",[req.params.assetid,startdate,enddate], function(err, rows) {
        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        connection.release();
        rows.unshift(headers);
        res.csv(rows);
      });
    });

    } else if(req.body.submit == "update") {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }


    connection.query("select m.ClientFK, m.MeterNo, m.TimeStamp, m.TotalActiveDemand_3P, m.TotalReactiveDemand_3P, m.PhaseVoltage_L1, m.PhaseCurrent_I3, \
                       m.PhaseVoltage_L2, m.PhaseVoltage_L3, m.LineVoltage_L12, m.LineVoltage_L31, m.LineVoltage_L23, m.PhaseCurrent_I1, m.PhaseCurrent_I2, \
                       m.TotalApparentPower_3P, m.TotalActivePower_3P, m.TotalReactivePower_3P, m.PhasePowerFactor_3P, m.SystemFrequency, m.Energy_Total, \
                       (PhaseVoltage_L1*PhaseCurrent_I1 + PhaseVoltage_L2*PhaseCurrent_I2 + PhaseVoltage_L2*PhaseCurrent_I2)/1000*PhasePowerFactor_3P/10 as Energy_Importing_Calc, \
                       m.Energy_Importing, m.Energy_Exporting, da.assetname, da.assetid from MeterLog m left join d_asset da on da.assetid = m.MeterNo \
                       left join f_asset fa on fa.assetid = da.assetid left join d_accounts dac on dac.accountid = fa.accountid \
                       WHERE dac.accountname = ? and m.TimeStamp between ? and ? order by m.TimeStamp desc ",[req.params.accountname,startdate,enddate], function(err, rows) {
      
      connection.query("select fa.assetid, da.assetname, da.street, da.postcode, da.remarks, da.lat, da.lng, dac.accountid, dac.accountname from f_asset fa \
                      left join d_asset da on fa.assetid = da.assetid left join d_accounts dac on fa.accountid = dac.accountid where dac.accountname = ?",req.params.accountname, function(err, assets) {
        //console.log(rows);

        connection.query("select DAY(m.timestamp) as day,Month(m.timestamp) as month, Year(m.timestamp) as year, \
                          m.Energy_Importing, m.Energy_Exporting from MeterLog m left join d_asset da on da.assetid = m.MeterNo \
                          left join f_asset fa on fa.assetid = da.assetid left join d_accounts dac on dac.accountid = fa.accountid \
                          WHERE dac.accountname = ? and m.Timestamp between ? and ? \
                          group by year, month, day order by m.TimeStamp asc",[req.params.accountname,startdate,enddate], function(err, sum) {


          var headers = {};
          for (key in rows[0]) {
              headers[key] = key;
          }
          connection.release();
          res.render('account.ejs', {
            moment:moment,
            sum: sum,
            data: rows,
            header:headers,
            accountname: req.params.accountname,
            assets:assets,
            start: req.body.start,
            end: req.body.end,
            message:''
          });
        }); // query - sums
      }); // query - assets
    }); // query - rows

    }); // pool
    } else if (req.body.submit == "report") {

   pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

        connection.query("select MeterLog.Energy_Total, (MeterLog.PhaseVoltage_L1*MeterLog.PhaseCurrent_I1 + MeterLog.PhaseVoltage_L2*MeterLog.PhaseCurrent_I2 + MeterLog.PhaseVoltage_L2*MeterLog.PhaseCurrent_I2)/1000 as Energy_Importing, MeterLog.Energy_Exporting,MeterLog.TimeStamp, d_asset.assetid, d_asset.assetname from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ?  and MeterLog.TimeStamp between ? and ? order by MeterLog.TimeStamp desc",[req.params.assetid, startdate, enddate], function(err, rows) {

          var energy_gen = 0;

          rows.forEach(function(err, index) {
            energy_gen = energy_gen + rows[index].Energy_Importing;
          });

          var current_tariff = 0.2329;
          var grid_charge = 0.15;
          var sp_rate = 0.2329;
          var discount = 0.12;

          //console.log(req.body.svgimg);

          var headline = 'Tax Invoice';
          var business = 'SUNSEAP LEASING PTE LTD';
          var address1 = '18 Boon Lay Way #06-135';
          var address2 = 'Singapore 609966';
          var address3 = 'General Enquiries: +65 67954465';
          var address4 = 'www.sunseap-leasing.com';
          var address5 = 'Co. Registration No.: '+'201107952W';
          var address6 = 'GST Reg No. '+'201107952W';

          var location = 'Blk 214 Jurong East St 21, Singapore 600214';
          var text2 = 'Energy Generation for this Period: '+Math.round(req.body.sum_impt*1000)/1000+' kWh';

          var dates = 'Generated between ' + req.body.start+ ' and ' + req.body.end;
          doc = new PDF({size:'A4'});  

          res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'attachment; filename=Report.pdf'
            });


          // header - top
          doc.font('Helvetica-Bold');
          doc.fontSize(13);
          doc.text(headline, 260, 30);             //adding the text to be written, 


          // header - left
          doc.image('public/img/sunseap_logo_trans.jpg',30,70, {width:50});
          doc.font('Helvetica');
          doc.fontSize(10);

          doc.text(business, 95, 70);             //adding the text to be written, 
          doc.text(address1, 95, 85);             //adding the text to be written, 
          doc.text(address2, 95, 100);             //adding the text to be written, 
          doc.text(address3, 95, 115);             //adding the text to be written, 
          doc.text(address4, 95, 130);             //adding the text to be written, 
          // header - right


          //console.log((req.body.daily_img));
          doc.image(req.body.daily_img,40, 410);

          //doc.rect(10, 10, 575, 815); total width is 585 and height is 825
          //doc.rect(10, 10, 575, 200);
          doc.text(text2, 40, 410);             //adding the text to be written, 


          doc.rect(30, 180, 400, 250);

          doc.rect(30, 450, 400, 280);
          doc.stroke();

          doc.scale(0.7).translate(40,220);
          doc.path(req.body.svgimg).stroke();

          doc.translate(0,420);
          doc.path(req.body.svgimg2).stroke();
          doc.path(req.body.svgimg3).stroke();


          doc.addPage({margin: 50,size:'A4'}) // invoice page 2

          // header - top
          doc.font('Helvetica-Bold');
          doc.fontSize(13);
          doc.text(headline, 260, 30);             //adding the text to be written, 

          // header - left
          doc.image('public/img/sunseap_logo_trans.jpg',30,70, {width:50});

          doc.fontSize(8);
          doc.text(business, 95, 70);             //adding the text to be written, 
          doc.font('Helvetica');
          doc.text(address1, 95, 85);             //adding the text to be written, 
          doc.text(address2, 95, 100);             //adding the text to be written, 
          doc.text(address3, 95, 115);             //adding the text to be written, 
          doc.text(address4, 95, 130);             //adding the text to be written, 
          
          doc.text(address5, 95, 145);             //adding the text to be written, 
          doc.text(address6, 95, 160);             //adding the text to be written, 



          // address of the company


          // header - right

          doc.fontSize(8);
          var bill = moment(new Date()).format('MMM YYYY')+' Bill';
          var dated = 'Dated '+moment(new Date()).format('DD MMM YYYY');
          doc.font('Helvetica-Bold');
          doc.text(bill, 390, 70);             //adding the text to be written, 
          doc.text(dated, 450, 70);             //adding the text to be written, 

          doc.moveTo(350,85 ).lineTo(545, 85).stroke();
          doc.font('Helvetica');
          doc.text('Invoice Number: ' + '0001', 400, 100);             //adding the text to be written, 
          doc.text('Type: ' + 'xxxxxx', 400, 115);             //adding the text to be written, 
          doc.text('Account No: ' + 'Solar 0001', 400, 130);             //adding the text to be written, 
          doc.text('Jurong Town Council', 400, 145);             
          doc.text('BLK 255 Jurong East St 24 #01-303', 400, 160); 
          doc.text('This is your tax invoice for: ', 400, 190);             //adding the text to be written, 
          
          // address of the meter/s
          doc.text('BLK 214 Jurong East St 21', 400, 205);             //adding the text to be written, 
          doc.text('Singapore 600214', 400, 220);             //adding the text to be written, 



          // summary of charges box
          doc.rect(30, 200, 300, 115);
          doc.rect(250, 200, 80, 115);        
          doc.rect(30, 200, 300, 15);
          doc.rect(250, 200, 80, 15);   
          doc.rect(30, 295, 300, 20);
          doc.stroke();
          // text
          doc.text('SUMMARY OF CHARGES ' + req.body.start + ' to ' + req.body.end, 35, 205);             //adding the text to be written, 
          doc.text('Amount ($)', 265, 205);             //adding the text to be written, 

          // line items
          doc.text('Balance B/F from Previous Bill', 35, 235);
          doc.text('Outstanding Balance', 35, 265);           
          doc.text('Total Current Charges due on ' + req.body.end, 35, 280);   
          doc.font('Helvetica-Bold');
          doc.fontSize(10);

          doc.text('Total Amount Payable', 35, 300); 

          doc.fontSize(8);
          doc.font('Helvetica');
          doc.text('Payment received on or after '+moment(req.body.end,'DD/MM/YYYY').add(1,'d').format('DD MMM YYYY')+' may not be included in this bill', 30, 345);           

          // top row
          doc.text('CURRENT MONTH CHARGES', 40, 385);           
          doc.text('Electricity charges w/o Sunseap solar', 255, 380);           
          doc.text('Electricity charges w/ Sunseap solar', 415, 380);           
          // second row
          doc.text('Electricity (kWh)', 175, 395);           
          doc.text('Effective Rate ($)', 255, 395);           
          doc.text('Amount ($)', 335, 395);           
          doc.text('Effective Rate ($)', 415, 395);           
          doc.text('Amount ($)', 495, 395);           

          // top row
          doc.rect(30, 375, 140, 30);  // current monthly charges
          doc.rect(170, 375, 80, 15);  // blank 
          doc.rect(250, 375, 160, 15); // with 
          doc.rect(410, 375, 160, 15); // without

          // second row
          doc.rect(170, 390, 80, 15);  // elect 
          doc.rect(250, 390, 80, 15); // effect 
          doc.rect(330, 390, 80, 15); // amount 
          doc.rect(410, 390, 80, 15); // effect
          doc.rect(490, 390, 80, 15); // amount

          // third row
          doc.rect(30, 405, 140, 60);  // current monthly charges
          doc.rect(170, 405, 80, 60);  // blank 
          doc.rect(250, 405, 80, 60); // with 
          doc.rect(330, 405, 80, 60); // with 
          doc.rect(410, 405, 80, 60); // without
          doc.rect(490, 405, 80, 60); // without
  
          doc.text('Reading taken on '+ req.body.end, 35, 410);           
          doc.text('Exported', 40, 440);           
          doc.text('Usage', 40, 455);           

          doc.text(Math.round(req.body.sum_impt*1000)/1000, 175, 440);           
          doc.text(Math.round(req.body.sum_expt*1000)/1000, 175, 455);           

          //effective rates
          doc.text(current_tariff - grid_charge, 255, 440);           
          doc.text((current_tariff), 255, 455);           

          // amount
          doc.text(Math.round(req.body.sum_impt * (current_tariff - grid_charge)*1000)/1000, 335, 440);           
          doc.text(Math.round(req.body.sum_expt * (current_tariff)*1000)/1000, 335, 455);           

          //effective rates
          doc.text(current_tariff - grid_charge, 415, 440);           
          doc.text(sp_rate * (1 - discount), 415, 455);           

          //amount
          doc.text(current_tariff - grid_charge, 415, 440);           
          doc.text(sp_rate * (1 - discount), 415, 455);           

          // amount
          doc.text(Math.round(req.body.sum_impt * (current_tariff - grid_charge)*1000)/1000, 495, 440);           
          doc.text(Math.round(req.body.sum_expt * (sp_rate * (1 - discount))*1000)/1000, 495, 455);           

          // fourth row
          doc.rect(30, 465, 140, 40);  // current monthly charges
          doc.rect(170, 465, 80, 40);  // blank 
          doc.rect(250, 465, 80, 40); // with 
          doc.rect(330, 465, 80, 40); // with 
          doc.rect(410, 465, 80, 40); // without
          doc.rect(490, 465, 80, 40); // without
  
          doc.text('Total charges subjected to GST', 35, 470);           
          doc.text('Goods & Services Tax', 35, 485);           

          // fifth row
          doc.rect(30, 505, 380, 15);  // current monthly charges

          doc.rect(410, 505, 160, 15); // without

          doc.stroke();


          var start_tax_date = '1 January';
          var end_tax_date = '31 Mar';

          doc.font('Helvetica-Bold');
          doc.fontSize(10);
          doc.text('From '+start_tax_date+' to '+end_tax_date+': ', 30, 540);           

          doc.fontSize(8);
          doc.font('Helvetica');
          doc.text('Effective Export Rate = Current Tariff - Grid Charge = '+'current_tariff'+' - '+'grid_charge' + ' = ' + (current_tariff - grid_charge), 30, 555);           
          doc.text('Effective Usage Rate = SP Rate x Discount Rate = '+'sp_rate'+' * '+'(1-discount)' + ' = ' + sp_rate * (1-discount), 30, 570);           
          doc.text('Please make full payment by the due date to avoid late payment charges.', 30, 600);           
          doc.text('Please visit www.sunseap-leasing.com for more information on our service and conditions of service.', 30, 615);           
          doc.text('This bill services as a tax invoice for the collection of Solar Leasing Charges for SUNSEAP LEASING PTE LTD.', 30, 630);           

          doc.text('for '+'SUNSEAP LEASING PTE LTD', 30, 660);     

          doc.moveTo(30,700).lineTo(250, 700).stroke();
          doc.moveTo(300,700 ).lineTo(500, 700).stroke();
                
          doc.text('Authorised Signature', 100, 705);  
          doc.text('Company Stamp', 370, 705);
          doc.pipe(res);
                                //creating a new PDF object
          //doc.pipe(fs.createWriteStream('testfile2.pdf'));  //creating a write stream 
                      //to write the content on the file system
                      // more things can be added here including new pages
          doc.end(); //we end the document writing.
      }); // query
    }); // pool

    }

  });





  // ===============================================================================================================
  // REPORT SECTION ================================================================================================
  // ===============================================================================================================
  // this lets you view users in your account



  app.get('/createreport/:accountname', isLoggedIn, function(req, res) {

  // provides start and end date for the report
  var startdate = moment(new Date()).subtract(8,'d').format("YYYY-MM-DD 00:00:00");
  var enddate = moment(new Date()).add(1,'d').format("YYYY-MM-DD 00:00:00");


  }); // create report




  app.post('/createreport/:accountname', isLoggedIn, function(req, res) {

  // pulls in the start and end date from the page / this should be date-time
  var startdate = moment(req.body.start,'DD/MM/YYYY').format("YYYY-MM-DD 00:00:00");
  var enddate = moment(req.body.end,'DD/MM/YYYY').format("YYYY-MM-DD 00:00:00");

    // this is for an export of the data to excel
    if(req.body.submit == "export") {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      connection.query("select * from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ? and MeterLog.TimeStamp between ? and ? order by MeterLog.TimeStamp",[req.params.assetid,startdate,enddate], function(err, rows) {
        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        connection.release();
        rows.unshift(headers);
        res.csv(rows);
      });
    });

    // this is to update any parameters on the page
    } else if(req.body.submit == "update") {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }


    connection.query("select m.ClientFK, m.MeterNo, m.TimeStamp, m.TotalActiveDemand_3P, m.TotalReactiveDemand_3P, m.PhaseVoltage_L1, m.PhaseCurrent_I3, \
                       m.PhaseVoltage_L2, m.PhaseVoltage_L3, m.LineVoltage_L12, m.LineVoltage_L31, m.LineVoltage_L23, m.PhaseCurrent_I1, m.PhaseCurrent_I2, \
                       m.TotalApparentPower_3P, m.TotalActivePower_3P, m.TotalReactivePower_3P, m.PhasePowerFactor_3P, m.SystemFrequency, m.Energy_Total, \
                       (PhaseVoltage_L1*PhaseCurrent_I1 + PhaseVoltage_L2*PhaseCurrent_I2 + PhaseVoltage_L2*PhaseCurrent_I2)/1000*PhasePowerFactor_3P/10 as Energy_Importing_Calc, \
                       m.Energy_Importing, m.Energy_Exporting, da.assetname, da.assetid from MeterLog m left join d_asset da on da.assetid = m.MeterNo \
                       left join f_asset fa on fa.assetid = da.assetid left join d_accounts dac on dac.accountid = fa.accountid \
                       WHERE dac.accountname = ? and m.TimeStamp between ? and ? order by m.TimeStamp desc ",[req.params.accountname,startdate,enddate], function(err, rows) {
      
      connection.query("select fa.assetid, da.assetname, da.street, da.postcode, da.remarks, da.lat, da.lng, dac.accountid, dac.accountname from f_asset fa \
                      left join d_asset da on fa.assetid = da.assetid left join d_accounts dac on fa.accountid = dac.accountid where dac.accountname = ?",req.params.accountname, function(err, assets) {
        //console.log(rows);

        connection.query("select DAY(m.timestamp) as day,Month(m.timestamp) as month, Year(m.timestamp) as year, \
                          m.Energy_Importing, m.Energy_Exporting from MeterLog m left join d_asset da on da.assetid = m.MeterNo \
                          left join f_asset fa on fa.assetid = da.assetid left join d_accounts dac on dac.accountid = fa.accountid \
                          WHERE dac.accountname = ? and m.Timestamp between ? and ? \
                          group by year, month, day order by m.TimeStamp asc",[req.params.accountname,startdate,enddate], function(err, sum) {


          var headers = {};
          for (key in rows[0]) {
              headers[key] = key;
          }
          connection.release();
          res.render('account.ejs', {
            moment:moment,
            sum: sum,
            data: rows,
            header:headers,
            accountname: req.params.accountname,
            assets:assets,
            start: req.body.start,
            end: req.body.end,
            message:''
          });
        }); // query - sums
      }); // query - assets
    }); // query - rows

    }); // pool


    // this is to generate the report
    } else if (req.body.submit == "report") {

   pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

        connection.query("select MeterLog.Energy_Total, (MeterLog.PhaseVoltage_L1*MeterLog.PhaseCurrent_I1 + MeterLog.PhaseVoltage_L2*MeterLog.PhaseCurrent_I2 + MeterLog.PhaseVoltage_L2*MeterLog.PhaseCurrent_I2)/1000 as Energy_Importing, MeterLog.Energy_Exporting,MeterLog.TimeStamp, d_asset.assetid, d_asset.assetname from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ?  and MeterLog.TimeStamp between ? and ? order by MeterLog.TimeStamp desc",[req.params.assetid, startdate, enddate], function(err, rows) {

          var energy_gen = 0;

          rows.forEach(function(err, index) {
            energy_gen = energy_gen + rows[index].Energy_Importing;
          });

          var current_tariff = 0.2329;
          var grid_charge = 0.15;
          var sp_rate = 0.2329;
          var discount = 0.12;

          //console.log(req.body.svgimg);

          var headline = 'Tax Invoice';
          var business = 'SUNSEAP LEASING PTE LTD';
          var address1 = '18 Boon Lay Way #06-135';
          var address2 = 'Singapore 609966';
          var address3 = 'General Enquiries: +65 67954465';
          var address4 = 'www.sunseap-leasing.com';
          var address5 = 'Co. Registration No.: '+'201107952W';
          var address6 = 'GST Reg No. '+'201107952W';

          var location = 'Blk 214 Jurong East St 21, Singapore 600214';
          var text2 = 'Energy Generation for this Period: '+Math.round(req.body.sum_impt*1000)/1000+' kWh';

          var dates = 'Generated between ' + req.body.start+ ' and ' + req.body.end;
          doc = new PDF({size:'A4'});  

          res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'attachment; filename=Report.pdf'
            });


          // header - top
          doc.font('Helvetica-Bold');
          doc.fontSize(13);
          doc.text(headline, 260, 30);             //adding the text to be written, 


          // header - left
          doc.image('public/img/sunseap_logo_trans.jpg',30,70, {width:50});
          doc.font('Helvetica');
          doc.fontSize(10);

          doc.text(business, 95, 70);             //adding the text to be written, 
          doc.text(address1, 95, 85);             //adding the text to be written, 
          doc.text(address2, 95, 100);             //adding the text to be written, 
          doc.text(address3, 95, 115);             //adding the text to be written, 
          doc.text(address4, 95, 130);             //adding the text to be written, 
          // header - right


          //console.log((req.body.daily_img));
          doc.image(req.body.daily_img,40, 410);

          //doc.rect(10, 10, 575, 815); total width is 585 and height is 825
          //doc.rect(10, 10, 575, 200);
          doc.text(text2, 40, 410);             //adding the text to be written, 


          doc.rect(30, 180, 400, 250);

          doc.rect(30, 450, 400, 280);
          doc.stroke();

          doc.scale(0.7).translate(40,220);
          doc.path(req.body.svgimg).stroke();

          doc.translate(0,420);
          doc.path(req.body.svgimg2).stroke();
          doc.path(req.body.svgimg3).stroke();


          doc.addPage({margin: 50,size:'A4'}) // invoice page 2

          // header - top
          doc.font('Helvetica-Bold');
          doc.fontSize(13);
          doc.text(headline, 260, 30);             //adding the text to be written, 

          // header - left
          doc.image('public/img/sunseap_logo_trans.jpg',30,70, {width:50});

          doc.fontSize(8);
          doc.text(business, 95, 70);             //adding the text to be written, 
          doc.font('Helvetica');
          doc.text(address1, 95, 85);             //adding the text to be written, 
          doc.text(address2, 95, 100);             //adding the text to be written, 
          doc.text(address3, 95, 115);             //adding the text to be written, 
          doc.text(address4, 95, 130);             //adding the text to be written, 
          
          doc.text(address5, 95, 145);             //adding the text to be written, 
          doc.text(address6, 95, 160);             //adding the text to be written, 



          // address of the company


          // header - right

          doc.fontSize(8);
          var bill = moment(new Date()).format('MMM YYYY')+' Bill';
          var dated = 'Dated '+moment(new Date()).format('DD MMM YYYY');
          doc.font('Helvetica-Bold');
          doc.text(bill, 390, 70);             //adding the text to be written, 
          doc.text(dated, 450, 70);             //adding the text to be written, 

          doc.moveTo(350,85 ).lineTo(545, 85).stroke();
          doc.font('Helvetica');
          doc.text('Invoice Number: ' + '0001', 400, 100);             //adding the text to be written, 
          doc.text('Type: ' + 'xxxxxx', 400, 115);             //adding the text to be written, 
          doc.text('Account No: ' + 'Solar 0001', 400, 130);             //adding the text to be written, 
          doc.text('Jurong Town Council', 400, 145);             
          doc.text('BLK 255 Jurong East St 24 #01-303', 400, 160); 
          doc.text('This is your tax invoice for: ', 400, 190);             //adding the text to be written, 
          
          // address of the meter/s
          doc.text('BLK 214 Jurong East St 21', 400, 205);             //adding the text to be written, 
          doc.text('Singapore 600214', 400, 220);             //adding the text to be written, 



          // summary of charges box
          doc.rect(30, 200, 300, 115);
          doc.rect(250, 200, 80, 115);        
          doc.rect(30, 200, 300, 15);
          doc.rect(250, 200, 80, 15);   
          doc.rect(30, 295, 300, 20);
          doc.stroke();
          // text
          doc.text('SUMMARY OF CHARGES ' + req.body.start + ' to ' + req.body.end, 35, 205);             //adding the text to be written, 
          doc.text('Amount ($)', 265, 205);             //adding the text to be written, 

          // line items
          doc.text('Balance B/F from Previous Bill', 35, 235);
          doc.text('Outstanding Balance', 35, 265);           
          doc.text('Total Current Charges due on ' + req.body.end, 35, 280);   
          doc.font('Helvetica-Bold');
          doc.fontSize(10);

          doc.text('Total Amount Payable', 35, 300); 

          doc.fontSize(8);
          doc.font('Helvetica');


          doc.text('Payment received on or after '+moment(req.body.end,'DD/MM/YYYY').add(1,'d').format('DD MMM YYYY')+' may not be included in this bill', 30, 345);           

          // top row
          doc.text('CURRENT MONTH CHARGES', 40, 385);           
          doc.text('Electricity charges w/o Sunseap solar', 255, 380);           
          doc.text('Electricity charges w/ Sunseap solar', 415, 380);           
          // second row
          doc.text('Electricity (kWh)', 175, 395);           
          doc.text('Effective Rate ($)', 255, 395);           
          doc.text('Amount ($)', 335, 395);           
          doc.text('Effective Rate ($)', 415, 395);           
          doc.text('Amount ($)', 495, 395);           

          // top row
          doc.rect(30, 375, 140, 30);  // current monthly charges
          doc.rect(170, 375, 80, 15);  // blank 
          doc.rect(250, 375, 160, 15); // with 
          doc.rect(410, 375, 160, 15); // without

          // second row
          doc.rect(170, 390, 80, 15);  // elect 
          doc.rect(250, 390, 80, 15); // effect 
          doc.rect(330, 390, 80, 15); // amount 
          doc.rect(410, 390, 80, 15); // effect
          doc.rect(490, 390, 80, 15); // amount



          // third row
          doc.rect(30, 405, 140, 60);  // current monthly charges
          doc.rect(170, 405, 80, 60);  // blank 
          doc.rect(250, 405, 80, 60); // with 
          doc.rect(330, 405, 80, 60); // with 
          doc.rect(410, 405, 80, 60); // without
          doc.rect(490, 405, 80, 60); // without
  
          doc.text('Reading taken on '+ req.body.end, 35, 410);           
          doc.text('Exported', 40, 440);           
          doc.text('Usage', 40, 455);           

          doc.text(Math.round(req.body.sum_impt*1000)/1000, 175, 440);           
          doc.text(Math.round(req.body.sum_expt*1000)/1000, 175, 455);           

          //effective rates
          doc.text(current_tariff - grid_charge, 255, 440);           
          doc.text((current_tariff), 255, 455);           

          // amount
          doc.text(Math.round(req.body.sum_impt * (current_tariff - grid_charge)*1000)/1000, 335, 440);           
          doc.text(Math.round(req.body.sum_expt * (current_tariff)*1000)/1000, 335, 455);           

          //effective rates
          doc.text(current_tariff - grid_charge, 415, 440);           
          doc.text(sp_rate * (1 - discount), 415, 455);           

          //amount
          doc.text(current_tariff - grid_charge, 415, 440);           
          doc.text(sp_rate * (1 - discount), 415, 455);           

          // amount
          doc.text(Math.round(req.body.sum_impt * (current_tariff - grid_charge)*1000)/1000, 495, 440);           
          doc.text(Math.round(req.body.sum_expt * (sp_rate * (1 - discount))*1000)/1000, 495, 455);           



          // fourth row
          doc.rect(30, 465, 140, 40);  // current monthly charges
          doc.rect(170, 465, 80, 40);  // blank 
          doc.rect(250, 465, 80, 40); // with 
          doc.rect(330, 465, 80, 40); // with 
          doc.rect(410, 465, 80, 40); // without
          doc.rect(490, 465, 80, 40); // without
  
          doc.text('Total charges subjected to GST', 35, 470);           
          doc.text('Goods & Services Tax', 35, 485);           

          // fifth row
          doc.rect(30, 505, 380, 15);  // current monthly charges

          doc.rect(410, 505, 160, 15); // without

          doc.stroke();


          var start_tax_date = '1 January';
          var end_tax_date = '31 Mar';

          doc.font('Helvetica-Bold');
          doc.fontSize(10);
          doc.text('From '+start_tax_date+' to '+end_tax_date+': ', 30, 540);           

          doc.fontSize(8);
          doc.font('Helvetica');
          doc.text('Effective Export Rate = Current Tariff - Grid Charge = '+'current_tariff'+' - '+'grid_charge' + ' = ' + (current_tariff - grid_charge), 30, 555);           
          doc.text('Effective Usage Rate = SP Rate x Discount Rate = '+'sp_rate'+' * '+'(1-discount)' + ' = ' + sp_rate * (1-discount), 30, 570);           
          doc.text('Please make full payment by the due date to avoid late payment charges.', 30, 600);           
          doc.text('Please visit www.sunseap-leasing.com for more information on our service and conditions of service.', 30, 615);           
          doc.text('This bill services as a tax invoice for the collection of Solar Leasing Charges for SUNSEAP LEASING PTE LTD.', 30, 630);           

          doc.text('for '+'SUNSEAP LEASING PTE LTD', 30, 660);     

          doc.moveTo(30,700).lineTo(250, 700).stroke();
          doc.moveTo(300,700 ).lineTo(500, 700).stroke();
                
          doc.text('Authorised Signature', 100, 705);  
          doc.text('Company Stamp', 370, 705);
          doc.pipe(res);
                                //creating a new PDF object
          //doc.pipe(fs.createWriteStream('testfile2.pdf'));  //creating a write stream 
                      //to write the content on the file system
                      // more things can be added here including new pages
          doc.end(); //we end the document writing.
      }); // query
    }); // pool

    }

  });


















  // =====================================
  // ASSIGN GROUP  =======================
  // =====================================
  // Allows administrators or managers to assign people to groups
  app.get('/assigngroup/:accountname',isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

        var thisaccountid;
        var thisroleid;


      connection.query("select roleid from f_accounts fa where fa.username = ?",req.user.username, function(err, role) {

        if (role[0].roleid == 0) {
        accountquery = "SELECT fa.username,da.accountid,da.accountname,dr.roleid, dr.rolename FROM f_accounts as fa left join d_accounts as da on 1 = 1 left join d_roles as dr on fa.roleid = dr.roleid where fa.username = ?"
      } else {
        accountquery = "SELECT fa.username,da.accountid,da.accountname,dr.roleid, dr.rolename FROM f_accounts as fa left join d_accounts as da on fa.accountid = da.accountid left join d_roles as dr on fa.roleid = dr.roleid where fa.username = ?"
      }


        //var getaccounts = "select fa.username,da.accountid,da.accountname,fa.roleid from f_accounts fa left join d_accounts da on fa.accountid = da.accountid where fa.username = ?";
        connection.query(accountquery,[req.user.username],function(err, accounts) {

        accounts.forEach(function(err, index) {
          if (accounts[index].accountname == req.params.accountname) {
            thisaccountid = accounts[index].accountid;
            thisroleid = accounts[index].roleid;
          }
        });

          //console.log('thisaccountid: ', thisaccountid);
          //console.log('thisroleid: ', thisroleid);
            // pull groups in the account (that you have access to)        
            //administrators have access to all accounts
            if(thisroleid < 2) {

              var sql = "SELECT distinct dg.groupid,dg.groupname from d_accounts da left join f_groups fg on fg.accountid = da.accountid left join d_groups dg on fg.groupid = dg.groupid where da.accountname = ?";
              connection.query(sql,[req.params.accountname],function(err, groups) {


                // pull users in the account
                  var sql2 = "SELECT fa.username, fa.roleid, dr.rolename, du.firstname, du.lastname  from f_accounts fa left join d_roles dr on dr.roleid = fa.roleid left join d_user_profile as du on fa.username = du.username  where fa.accountid = '?' order by username";
                  connection.query(sql2,[thisaccountid],function(err, users) {               

                    // pull user access
                    var sql3 = "select groupid, username from f_groups_access";
                    connection.query(sql3,[],function(err, useraccess) {               


                      connection.release(); // always put connection back in pool after last query
                      res.render('assigngroup.ejs' , {accountname:req.params.accountname,users:users, access:useraccess,groups:groups,message:''});
                    }); // user access

                  });

              });

            // managers have access to accounts that they can see
            } else {

              var sql = "SELECT distinct dg.groupid,dg.groupname from d_accounts da left join f_groups fg on fg.accountid = da.accountid left join d_groups dg on fg.groupid = dg.groupid where da.accountname = ?";
              connection.query(sql,[req.params.accountname],function(err, groups) {
                  // pull users in the account
                  var sql2 = "SELECT fa.username, fa.roleid, dr.rolename, du.firstname, du.lastname  from f_accounts fa left join d_roles dr on dr.roleid = fa.roleid left join d_user_profile as du on fa.username = du.username  where fa.accountid = '?' order by username";
                  connection.query(sql2,[thisaccountid],function(err, users) {

                    var sql3 = "select groupid, username from f_groups_access";
                    connection.query(sql3,[],function(err, useraccess) {               

                      connection.release(); // always put connection back in pool after last query
                      res.render('assigngroup.ejs' , {accountname:req.params.accountname,users:users, access:useraccess,groups:groups,message:''});
                    }); // user access
                  });
              });


            } // else

        }); // accounts
        }); // role

    }); // pool



  });



app.post('/assigngroup',isLoggedIn, function(req, res, next ) {
      // assign groups
      // vars: act,username,groupid
    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      console.log(req.body.groupid);
      console.log(req.body.username);
      console.log(moment(new Date()).format('YYYY-MM-DD'));
      if(req.body.act == 'Add') {
        console.log('inside add');
          var insertQuery = "INSERT f_groups_access (groupid,username,notes) VALUES (?,?,?)";
          connection.query(insertQuery,[req.body.groupid, req.body.username,moment(new Date()).format('YYYY-MM-DD')],function(err, rows) {
            connection.release(); // always put connection back in pool after last query
            res.redirect('/assigngroup/'+req.body.accountname);
          });

      } else if (req.body.act == 'Remove') {
 console.log('inside remove');
          var removeQuery = "DELETE from f_groups_access where groupid = ? and username = ?";
          connection.query(removeQuery,[req.body.groupid, req.body.username],function(err, rows) {
            connection.release(); // always put connection back in pool after last query
            res.redirect('/assigngroup/'+req.body.accountname);
          });

      } else {

            res.redirect('/assigngroup/'+req.body.accountname);

      }


    }); // pool

  });















  // =====================================
  // VIEW GROUPS SECTION =================
  // =====================================
  // this lets you view users in your account

  app.get('/viewgroup/:accountname', isLoggedIn, function(req, res) {
    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      if(req.params.groupid == 'all') { // this is in case we want to see all of the assets and groups in this account.
      connection.query("select dg.groupname,dg.groupid,da.assetname,da.assetid from f_groups fg left join d_groups dg on dg.groupid = fg.groupid left join f_groups_access fga on fga.groupid = fg.groupid left join d_asset da on da.assetid = fg.assetid where fga.username = ?",[req.user.username], function(err, rows) {
        connection.release(); // always put connection back in pool after last query
        res.render('viewgroup.ejs', {
          username : req.user.username,
          groupid : req.params.groupid,  // get the user out of session and pass to template
          groups: rows
        });
      });
      } else {
      connection.query("select dg.groupname,dg.groupid,da.assetname,da.assetid from f_groups fg left join d_groups dg on dg.groupid = fg.groupid left join f_groups_access fga on fga.groupid = fg.groupid left join d_asset da on da.assetid = fg.assetid left join f_asset fa on da.assetid = fa.assetid left join d_accounts dac on dac.accountid = fa.accountid where accountname = ? and fga.username = ?",[req.params.accountname, req.user.username], function(err, rows) {
        connection.release(); // always put connection back in pool after last query
        res.render('viewgroup.ejs', {
          username : req.user.username,
          groupid : req.params.groupid,  // get the user out of session and pass to template
          groups: rows
        });
      });
      } // else

    });
  });



	// =====================================
	// CREATE ASSET  =======================
	// =====================================
	// this page is for administrators to create f_accounts for other clients or administrators
	app.get('/createasset',isLoggedIn, function(req, res) {

        res.render('createasset.ejs', {
          message: ''
        });


	});

	// this creates a user outside of the passport
	app.post('/createasset',isLoggedIn, function(req, res, next ) {
      // user wants to add an asset
      // check to make sure asset if not already allocated, if so return error
      // if not already allocated, add information to d_asset and f_asset
      // return user to asset page

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

        connection.query("SELECT assetid FROM d_asset WHERE assetid = ?",req.body.assetid, function(err, asset) {
        //console.log(rolename[0].rolename);
          if (!asset.length)
          {

          var insertQuery = "INSERT INTO d_asset ( assetid, assetname, blockno, unitno, street, postcode, remarks, lat, lng ) values (?,?,?,?,?,?,?,?,?)";
          connection.query(insertQuery,[req.body.assetid, req.body.assetname, req.body.blockno, req.body.unitno, req.body.street, req.body.postcode, req.body.remarks, req.body.lat, req.body.lng],function(err, rows) {

            // if not already allocated, add information to d_asset and f_asset
            var insertQuery = "INSERT INTO f_asset ( assetid, accountid ) values (?,?)";
            connection.query(insertQuery,[req.body.assetid, req.body.accountid],function(err, rows) {

              if (err) { 
                connection.query("SELECT * FROM f_accounts WHERE username = ?",req.user.username, function(err, rows) {
                  connection.release(); // always put connection back in pool after last query
                  req.flash('message', 'The meter could not be added. Try again.');
                  res.render('createasset.ejs' , {message: req.flash('message')});
                });
              } else { 
                connection.query("SELECT * FROM f_accounts WHERE username = ?",req.user.username, function(err, rows) {
                  connection.release(); // always put connection back in pool after last query
                  req.flash('message', 'The meter was added.');
                  res.render('createasset.ejs' , {message: req.flash('message')});
                });
              }
            });

          });
          } else {
            connection.query("SELECT * FROM f_accounts WHERE username = ?",req.user.username, function(err, rows) {
              connection.release(); // always put connection back in pool after last query
              req.flash('message', 'Sorry, the meter has already been allocated.');
              res.render('createasset.ejs', {
                message: req.flash('message')
              });
            });

          }

        });

    }); // pool

	});


  // =====================================
  // EDIT ASSET SECTION =========================
  // =====================================
  // this lets you view users in your account
  app.get('/editasset/:accountname/:assetid', isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("select fa.assetid,da.assetname,da.blockno,da.unitno,da.street,da.postcode,da.remarks,da.lat,da.lng,fa.accountid,dac.accountname from f_asset fa left join d_asset da on da.assetid = fa.assetid left join d_accounts dac on dac.accountid = fa.accountid WHERE dac.accountname = ?",[req.params.accountname], function(err, rows) {
        connection.release();
        res.render('editasset.ejs', {
          accountname : req.params.accountname,  // get the user out of session and pass to template
          assetid:req.params.assetid,
          assets: rows,
          message: ''
        });
      });
    });

  });



app.post('/editasset/:accountname/:assetid',isLoggedIn, function(req, res, next ) {
      // user wants to rename an asset

    if (req.body.submit == "edit") {

        pool.getConnection(function(err, connection) {
          if(err) { console.log(err); return; }

              var insertQuery = "UPDATE d_asset da SET assetname = ?,blockno = ?, unitno= ?,street= ?,postcode= ?,remarks= ?,lat= ?,lng= ? where assetid = ?";
              connection.query(insertQuery,[req.body.assetname, req.body.blockno,req.body.unitno,req.body.street,req.body.postcode,req.body.remarks,req.body.lat,req.body.lng,req.body.assetid],function(err, rows) {
                  if (err) { 
      connection.query("select fa.assetid,da.assetname,da.blockno,da.unitno,da.street,da.postcode,da.remarks,da.lat,da.lng,fa.accountid,dac.accountname from f_asset fa left join d_asset da on da.assetid = fa.assetid left join d_accounts dac on dac.accountid = fa.accountid WHERE dac.accountname = ?",[req.params.accountname], function(err, rows) {
                      connection.release(); // always put connection back in pool after last query
                      req.flash('message', 'Sorry, something went wrong. Try again.');
                      res.render('editasset.ejs' , {accountname: req.params.accountname, assetid:req.params.assetid, assets:rows, message: req.flash('message')});
                    });
                  } else { 
      connection.query("select fa.assetid,da.assetname,da.blockno,da.unitno,da.street,da.postcode,da.remarks,da.lat,da.lng,fa.accountid,dac.accountname from f_asset fa left join d_asset da on da.assetid = fa.assetid left join d_accounts dac on dac.accountid = fa.accountid WHERE dac.accountname = ?",[req.params.accountname], function(err, rows) {
                      connection.release(); // always put connection back in pool after last query
                      req.flash('message', 'Asset was updated.');
                      res.render('editasset.ejs' , {accountname: req.params.accountname, assetid:req.params.assetid, assets:rows, message: req.flash('message')});
                    });
                  }
              });
        }); // pool
    }
    else if (req.body.submit == "delete") {
      // d_asset
      // f_asset
      // f_groups

        var sql = "DELETE da, fa, fg from d_asset da left join f_asset fa on fa.assetid = da.assetid \
                   left join f_groups fg on fa.assetid = fg.assetid  where fa.assetid = ?";
        pool.getConnection(function(err, connection) {
          connection.query(sql, [req.body.assetid], function(err, rows) {
              if(err) { console.log(err); return; }  
            connection.release(); // always put connection back in pool after last query
            res.redirect('/viewasset/'+req.params.accountname+'');
          });
        });



  }
  });




	// =====================================
	// VIEW ASSET SECTION =========================
	// =====================================
	// this lets you view users in your account
	app.get('/viewasset/:accountname', isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("select fa.assetid,da.assetname,da.blockno,da.unitno,da.street,da.postcode,da.remarks,da.lat,da.lng,dac.accountid,dac.accountname from f_asset fa left join d_asset da on da.assetid = fa.assetid left join d_accounts dac on dac.accountid = fa.accountid WHERE dac.accountname = ?",[req.params.accountname], function(err, rows) {
        connection.release();
        res.render('viewasset.ejs', {
          accountname : req.params.accountname, // get the user out of session and pass to template
          assets: rows
        });
      });
    });

	});



	// =====================================
	// EXPORT ASSET LIST SECTION ============
	// =====================================
	// this lets you view users in your account
	app.get('/viewasset/export/assets_:accountname', isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("select fa.assetid,da.assetname,da.blockno,da.unitno,da.street,da.postcode,da.remarks,da.lat,da.lng,dac.accountid,dac.accountname from f_asset fa left join d_asset da on d_asset.assetid = f_asset.assetid left join d_accounts dac on d_accounts.accountid = f_asset.accountid WHERE d_accounts.accountname = ?",[req.params.accountname], function(err, rows) {
        connection.release();
        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        rows.unshift(headers);
        res.csv(rows);
      });
    });



	});


  // =====================================
  // CREATE EVENT  ========================
  // =====================================
  // this page is for users to create events that trigger based off of data or results

  app.get('/createevent',isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      connection.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='"+dbconfig.database+"' AND TABLE_NAME='MeterLog';", function(err, cols) {
        connection.release(); // always put connection back in pool after last query
        res.render('createevent.ejs', {
          user : req.user, // get the user out of session and pass to template
          metrics: cols,
          message: ''
        });
      });
    });

  });

  // this creates a user outside of the passport
  app.post('/createevent',isLoggedIn, function(req, res, next ) {
      // user wants to add an asset
      // check to make sure asset if not already allocated, if so return error
      // if not already allocated, add information to d_asset and f_asset
      // return user to asset page

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }



      connection.query("SELECT accountid FROM d_accounts WHERE accountname = ?",req.body.accountname, function(err, accountid) {
      //console.log(accountid[0].accountid);
        connection.query("SELECT assetid FROM d_asset WHERE assetid = ?",req.body.assetid, function(err, asset) {
        //console.log(rolename[0].rolename);
          if (!asset.length)
          {

          var insertQuery = "INSERT INTO d_asset ( assetid, assetname ) values (?,?)";
          connection.query(insertQuery,[req.body.assetid, req.body.assetname],function(err, rows) {

            // if not already allocated, add information to d_asset and f_asset
            var insertQuery = "INSERT INTO f_asset ( assetid, accountid ) values (?,?)";

            connection.query(insertQuery,[req.body.assetid, accountid[0].accountid],function(err, rows) {

              if (err) { 
                connection.query("SELECT * FROM f_accounts WHERE username = ?",req.user.username, function(err, rows) {
                  connection.release(); // always put connection back in pool after last query
                  req.flash('message', 'Sorry, something went wrong. Try again.');
                  res.render('createevent.ejs' , {user:req.user,accounts: rows,message: req.flash('message')});
                });
              } else { 
                connection.query("SELECT * FROM f_accounts WHERE username = ?",req.user.username, function(err, rows) {
                  connection.release(); // always put connection back in pool after last query
                  req.flash('message', 'Asset was added.');
                  res.render('createevent.ejs' , {user:req.user,accounts: rows ,message: req.flash('message')});
                });
              }
            });

          });
          } else {
            connection.query("SELECT * FROM f_accounts WHERE username = ?",req.user.username, function(err, rows) {
              connection.release(); // always put connection back in pool after last query
              req.flash('message', 'Sorry, the asset has already been allocated.');
              res.render('createevent.ejs', {
                user : req.user, // get the user out of session and pass to template
                accounts: rows,
                message: req.flash('message')
              });
            });

          }

        });
      });

    }); // pool

  });




	// =====================================
	// VIEW DATA SECTION ===================
	// =====================================
	// this lets you view users in your account
	app.get('/viewdata/:assetid', isLoggedIn, function(req, res) {

    var startdate = moment(new Date()).subtract(10,'d').format("YYYY-MM-DD 00:00:00");
    var enddate = moment(new Date()).add(1,'d').format("YYYY-MM-DD 00:00:00");


    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      connection.query("select MeterLog.Energy_Total, (PhaseVoltage_L1*PhaseCurrent_I1 + PhaseVoltage_L2*PhaseCurrent_I2 + PhaseVoltage_L2*PhaseCurrent_I2)/1000 as Energy_Importing, MeterLog.Energy_Exporting,MeterLog.TimeStamp, d_asset.assetid, d_asset.assetname from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ? and MeterLog.TimeStamp between ? and ? order by MeterLog.TimeStamp desc",[req.params.assetid,startdate,enddate], function(err, rows) {
        console.log(rows);
              console.log(startdate);
                      console.log(enddate);  
        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        connection.release();
        res.render('viewdata.ejs', {
          moment:moment,
          data: rows,
          header:headers,
          start: moment(new Date()).format('DD/MM/YYYY'),
          end: moment(new Date()).add(1,'d').format('DD/MM/YYYY'),
          message:''
        });
      }); // query

    }); // pool

	});

  app.post('/viewdata/:assetid', isLoggedIn, function(req, res) {

      var startdate = moment(req.body.start,'DD/MM/YYYY').format("YYYY-MM-DD 00:00:00");
      var enddate = moment(req.body.end,'DD/MM/YYYY').format("YYYY-MM-DD 00:00:00");


    if(req.body.submit == "export") {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      connection.query("select * from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ? and MeterLog.TimeStamp between ? and ? order by MeterLog.TimeStamp",[req.params.assetid,startdate,enddate], function(err, rows) {
        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        connection.release();
        rows.unshift(headers);
        res.csv(rows);
      });
    });

    } else if(req.body.submit == "update") {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      connection.query("select MeterLog.Energy_Total, (MeterLog.PhaseVoltage_L1*MeterLog.PhaseCurrent_I1 + MeterLog.PhaseVoltage_L2*MeterLog.PhaseCurrent_I2 + MeterLog.PhaseVoltage_L2*MeterLog.PhaseCurrent_I2)/1000 as Energy_Importing, MeterLog.Energy_Exporting,MeterLog.TimeStamp, d_asset.assetid, d_asset.assetname from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ?  and MeterLog.TimeStamp between ? and ? order by MeterLog.TimeStamp desc",[req.params.assetid, startdate, enddate], function(err, rows) {

        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        connection.release();
        res.render('viewdata.ejs', {
          moment:moment,
          data: rows,
          header:headers,
          start: req.body.start,
          end: req.body.end,
          message:''
        });
      }); // query
    }); // pool
    } else if (req.body.submit == "report") {

   pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

        connection.query("select MeterLog.Energy_Total, (MeterLog.PhaseVoltage_L1*MeterLog.PhaseCurrent_I1 + MeterLog.PhaseVoltage_L2*MeterLog.PhaseCurrent_I2 + MeterLog.PhaseVoltage_L2*MeterLog.PhaseCurrent_I2)/1000 as Energy_Importing, MeterLog.Energy_Exporting,MeterLog.TimeStamp, d_asset.assetid, d_asset.assetname from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ?  and MeterLog.TimeStamp between ? and ? order by MeterLog.TimeStamp desc",[req.params.assetid, startdate, enddate], function(err, rows) {

          var energy_gen = 0;

          rows.forEach(function(err, index) {
            energy_gen = energy_gen + rows[index].Energy_Importing;
          });


          //console.log(req.body.svgimg);

          var text = 'Sample Report';
          var text2 = 'Energy Generation for this Period: '+Math.round(energy_gen*100)/100+' W';

          var dates = 'Generated between ' + req.body.start+ ' and ' + req.body.end;
          doc = new PDF({size:'A4'});  

          res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'attachment; filename=Report.pdf'
            });
          //doc.rect(10, 10, 575, 815); total width is 585 and height is 825
          //doc.rect(10, 10, 575, 200);
          doc.rect(30, 100, 535, 250);
          doc.rect(30, 400, 535, 50);

          doc.stroke();
          doc.image('public/img/cc_logo.png',15,15, {width:250});
          doc.fontSize(18);
          doc.text(text, 400, 30);             //adding the text to be written, 
          doc.fontSize(12);
          doc.text(dates, 30, 70);             //adding the text to be written, 
          doc.text(text2, 40, 420);             //adding the text to be written, 

          doc.scale(0.7).translate(40,120);
          doc.path(req.body.svgimg).stroke();

          doc.pipe(res);
                                //creating a new PDF object
          //doc.pipe(fs.createWriteStream('testfile2.pdf'));  //creating a write stream 
                      //to write the content on the file system
                      // more things can be added here including new pages
          doc.end(); //we end the document writing.
      }); // query
    }); // pool

    }

  });







  // =====================================
  // VIEW DATA SECTION ===================
  // =====================================
  // this lets you view users in your account
  app.get('/viewlivedata/:assetid', isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }

      connection.query("select m.ClientFK, m.MeterNo, m.TimeStamp, m.TotalActiveDemand_3P, m.TotalReactiveDemand_3P, m.PhaseVoltage_L1, m.PhaseVoltage_L2, m.PhaseVoltage_L3, m.LineVoltage_L12, m.LineVoltage_L31, m.LineVoltage_L23, m.PhaseCurrent_I1, m.PhaseCurrent_I2, m.PhaseCurrent_I3, m.TotalApparentPower_3P, m.TotalActivePower_3P, m.TotalReactivePower_3P, m.PhasePowerFactor_3P, m.SystemFrequency, m.Energy_Total, (PhaseVoltage_L1*PhaseCurrent_I1 + PhaseVoltage_L2*PhaseCurrent_I2 + PhaseVoltage_L2*PhaseCurrent_I2)/1000 as Energy_Importing, m.Energy_Exporting, da.assetname, da.assetid from MeterLog m left join d_asset da  on da.assetid = m.MeterNo WHERE da.assetid = ? order by m.TimeStamp desc limit 1",[req.params.assetid], function(err, rows) {
        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        connection.release();
        res.render('viewlivedata.ejs', {
          moment:moment,
          data: rows,
          header:headers
        });
      }); // query

    }); // pool

  });



	// =====================================
	// EXPORT DATA SECTION =================
	// =====================================
	// this lets you view users in your account
	app.get('/viewdata/export/data_:assetid', isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      
      connection.query("select MeterLog.Energy_Total, MeterLog.Energy_Importing, MeterLog.Energy_Exporting,MeterLog.TimeStamp, d_asset.assetid, d_asset.assetname from MeterLog left join d_asset on d_asset.assetid = MeterLog.MeterNo WHERE d_asset.assetid = ? order by MeterLog.TimeStamp",[req.params.assetid], function(err, rows) {
        var headers = {};
        for (key in rows[0]) {
            headers[key] = key;
        }
        connection.release();
        rows.unshift(headers);
        res.csv(rows);
      });
    });
	});

  // =====================================
  // PDF DATA SECTION =================
  // =====================================
  // this lets you view users in your account
  app.get('/viewdata/export/pdf/data_:assetid', isLoggedIn, function(req, res) {

    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      
  
          var text = 'test here file'+req.params.assetid;

          doc = new PDF({size:'A4'});  

          res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'attachment; filename='+req.params.assetid+'.pdf'
            });
          doc.rect(10, 10, 575, 815);
          doc.rect(10, 10, 575, 200);

          doc.stroke();
          doc.image('public/img/cc_logo.png',15,15, {width:250});
          doc.text(text, 100, 100);             //adding the text to be written, 

          doc.pipe(res);
                                //creating a new PDF object
          //doc.pipe(fs.createWriteStream('testfile2.pdf'));  //creating a write stream 
                      //to write the content on the file system
                      // more things can be added here including new pages
          doc.end(); //we end the document writing.

        //res.redirect('/');
    });

  });

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});
};

// route middleware to make sure
function isLoggedIn(req, res, next) {

  // if user is authenticated in the session, carry on
  if (req.isAuthenticated())
    return next();

  // if they aren't redirect them to the home page
  res.redirect('/');
}
