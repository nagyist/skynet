// app/user.js

// has home, login, and user functions

module.exports = function (app, passport, pool, transporter, mysql, pool) {
 

  // =====================================
  // HOME PAGE (with login links) ========
  // =====================================
  app.get('/', function(req, res) {
    res.render('index.ejs'); // load the index.ejs file
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

  pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }
    var sql = "SELECT f_accounts.username, f_accounts.roleid, f_accounts.accountid, d_accounts.accountname, d_roles.rolename FROM f_accounts left join d_accounts on d_accounts.accountid = f_accounts.accountid left join d_roles on d_roles.roleid = f_accounts.roleid WHERE f_accounts.username = ? and f_accounts.roleid < 3 and d_accounts.accountname = ?";
    connection.query(sql, [req.user.username, req.params.accountname], function(err, rows) {
        if(err) { console.log(err); return; }  
      connection.release(); // always put connection back in pool after last query
      res.render('createuser.ejs', {
        user : req.user, // get the user out of session and pass to template
        accounts: rows,
        message: ''
      });

    });
  });

  });

  // this creates a user outside of the passport
  app.post('/createuser',isLoggedIn, function(req, res, next ) {

  pool.getConnection(function(err, connection) {
    if(err) { console.log(err); return; }

      // replace with better call backs ... this is callback hell

      connection.query("SELECT accountid FROM d_accounts WHERE accountname = ?",req.body.accountname, function(err, accountid) {
        connection.query("SELECT rolename FROM d_roles WHERE roleid = ?",req.body.roleid, function(err, rolename) {
          // f_accounts // create account lookup with role
          var insertQuery = "INSERT INTO f_accounts ( username, roleid, accountid  ) values (?,?,?)";
          connection.query(insertQuery,[req.body.username, req.body.roleid, accountid[0].accountid],function(err, rows) {
            
                // users update
                var insertQuery = "INSERT INTO users ( username, password, email ) values (?,?,?)";
                connection.query(insertQuery,[req.body.username, bcrypt.hashSync(req.body.password, null, null), req.body.email],function(err, rows) {

                  if (err) { 
                      connection.release(); 
                      req.flash('createMessage', 'Sorry, something went wrong.');
                      res.render('createuser.ejs' , {message: req.flash('createMessage')});
                  } else { 
                    
                    connection.query("SELECT * FROM f_accounts WHERE username = ?",req.user.username, function(err, rows) {
                      connection.release(); 
                      req.flash('createMessage', 'User Account Created.');
                      res.render('createuser.ejs' , {user:req.body.username,accounts: rows ,message: req.flash('createMessage')});
                    });
                  }
                }); // users
          }); // f_accounts
        });
      }); // accountid
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
  
    pool.getConnection(function(err, connection) {
      if(err) { console.log(err); return; }
      var sql = "UPDATE f_accounts fa left join d_accounts da on fa.accountid = da.accountid set roleid = ? WHERE fa.username = ? and da.accountname = ?";
      connection.query(sql, [req.body.roleid, req.params.username, req.params.accountname], function(err, rows) {
          if(err) { console.log(err); return; }  
        connection.release(); // always put connection back in pool after last query
        
        res.redirect('/viewuser/'+req.params.accountname+'');


      });

    });
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
        from: 'admin@cloudconnectall.com',
        to: 'himynameistimli@gmail.com',
        subject: 'Cloud Connect Account Request',
        text: 'An account was requested by'+req.body.username+' from '+req.body.email+' about Account: '+req.body.account
    });
    res.redirect('/');

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
                    from: 'admin@cloudconnectall.com',
                    to: req.body.email,
                    subject: 'Password Reset',
                    html: 'You recently requested to reset your password. Please <a href="http://130.211.243.86:3000/changepassword/'+token+'">click here</a> to reset your password. If this request was not from you, please ignore this e-mail. <br><br><br> - Cloud Connect'
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




}

// route middleware to make sure
function isLoggedIn(req, res, next) {

  // if user is authenticated in the session, carry on
  if (req.isAuthenticated())
    return next();

  // if they aren't redirect them to the home page
  res.redirect('/');
}