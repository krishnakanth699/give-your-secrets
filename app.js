require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const findOrCreate = require('mongoose-findorcreate');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
// const encrypt = require('mongoose-encryption');
// const md5 = require("md5");
// const bcrypt = require('bcrypt');
//
// const saltRounds = 10; // if you increase this more harder for the computer to create it. refer docs.

const app = express();

//console.log(process.env.API_KEY);
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Thisismylittlesecret.",
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static("public"));

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(findOrCreate);

userSchema.plugin(passportLocalMongoose);

// userSchema.plugin(encrypt, { secret: process.env.SECRET , encryptedFields: ["password"]});

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
//
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});


passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({
            googleId: profile.id
        }, function(err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", function(req, res) {
    res.render("home");
});

app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/register", function(req, res) {
    res.render("register");
});

app.get("/secrets", function(req, res){
  User.find({"secret": {$ne: null}}, function(err, foundUsers){
    if (err){
      console.log(err);
    } else {
      if (foundUsers) {
        res.render("secrets", {usersWithSecrets: foundUsers});
      }
    }
  });
});

app.get("/submit",function(req,res){
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});


app.post("/submit",function(req,res){
    submittedSecret = req.body.secret;

    console.log(req.user);

    User.findById(req.user.id, function(err, foundUser){
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.secret = submittedSecret;
          foundUser.save(function(){
            res.redirect("/secrets");
          });
        }
      }
    });
})

app.get("/logout", function(req, res) {
    req.logout(function(err) {
        if (err) {
            console.log(err);
        }
    });
    res.redirect("/");
});

app.get("/auth/google",
    passport.authenticate("google", {
        scope: ['profile', 'email']
    }));

app.get("/auth/google/secrets",
    passport.authenticate("google", {
        failureRedirect: "/login"
    }),
    function(req, res) {
        // Successful authentication, redirect home.
        res.redirect("/secrets");
    });

app.post("/register", function(req, res) {
    User.register({
        username: req.body.username
    }, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }

    });

    // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    //     const newUser = new User({
    //         email: req.body.username,
    //         password: hash // Hash generated saved in the password feild
    //     });
    //
    //     newUser.save(function(err) {
    //         if (err) {
    //             console.log(err);
    //         } else {
    //             res.render("secrets");
    //         }
    //     });
    // });
});

app.post("/login", function(req, res) {

    const user = new User({
        email: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    });

    // User.findOne({
    //     email: req.body.username
    // }, function(err, results) {
    //     if (err) {
    //         console.log(err);
    //     } else {
    //         bcrypt.compare(req.body.password, results.password, function(err, result) {
    //             if (result === true) {
    //                 res.render("secrets");
    //             }
    //         });
    //
    //     }
    // });
});


app.listen(3000, function() {
    console.log("Server Started at port 3000");
})
