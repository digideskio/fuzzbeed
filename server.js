var express = require('express');
var app = express();
var swig = require('swig');
var Firebase = require("firebase");
var articleGenerator = require("./article");
var seed = require("seed-random");

var firebaseArticles = new Firebase("https://fuzzbeed.firebaseio.com/articles");
var firebaseProfiles = new Firebase("https://fuzzbeed.firebaseio.com/profiles");

// This is where all the magic happens!
app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Swig will cache templates for you, but you can disable
// that and use Express's caching instead, if you like:
app.set('view cache', false);
// To disable Swig's cache, do the following:
swig.setDefaults({ cache: false });
// NOTE: You should always cache templates in a production environment.
// Don't leave both of these to `false` in production!


app.param('username', function(req, res, next, username) {
  firebaseProfiles.child(username).once("value", function(snapshot) {
    var v = snapshot.val();
    if(v) {
      req.profile = v;
      firebaseArticles.orderByChild("username").equalTo(username).once("value", function(snapshot) {
        var vv = snapshot.val();
        if(!vv) return next();

        for (var prop in vv) {
          if(vv.hasOwnProperty(prop)) {
            vv[prop].timeAgo = timeAgo(vv[prop].timestamp);
          }
        }
        req.profile.articles = vv;
        req.profile.numArticles = Object.keys(vv).length;
        next();
      });
    } else {
      console.error("HACKER");
      return;
    }
  });
});

app.param('articleName', function(req, res, next, articleName) {
  firebaseArticles.orderByChild("articleName").equalTo(articleName).once("value", function(snapshot) {
    var v = snapshot.val();
    if(!v) return next();

    for (var prop in v) {
      if(v.hasOwnProperty(prop)) {
        req.article = v[prop];
        req.article.timestamp = new Date(req.article.timestamp).toGMTString();
        next();
        return;
      }
    }
  });
});

app.get('/', function (req, res) {
  firebaseArticles.orderByChild("timestamp").limitToFirst(10).once("value", function(snapshot) {
    var v = snapshot.val();
    for (var prop in v) {
      if(v.hasOwnProperty(prop)) {
        v[prop].timeAgo = timeAgo(v[prop].timestamp);
      }
    }
    var obj = {
      articles: v
    };
    injectSideStuff(obj, function() {
      obj.topBuzz = obj.__sideArticles[0];
      res.render('index', obj);
    });
  });
});
app.get('/users/:username/:articleName', function(req, res) {
  injectSideStuff(req.article, function() {
    res.render('article-view', req.article);
  });
});

app.get('/users/:username', function(req, res) {
  injectSideStuff(req.profile, function() {
    res.render('profile-view', addAwards(req.profile));
  });
});

app.get('/write-article', function(req, res) {
  res.render('write-article-view', {});
});

app.get('/write-an-article', function(req, res) {
  // Decide to create a new profile or not
  articleGenerator.loadArticleData(function(createArticle) {
    createArticle(function(article, author) {
      pushProfile(author, function() {
        firebaseArticles.push(article, function() {
          console.log("PUSHED", article, author);
          res.redirect(article.url);
        });
      });
    });
  });
});

app.use(express.static(__dirname + "/views"));

app.listen(1337);
console.log('Application Started on http://localhost:1337/');


function pushProfile(author, callback) {
  var obj = {};
  obj[author.username] = author;
  firebaseProfiles.update(obj, callback);
}

function shuffle(o, func){
  if(!func) func = Math.random;

  for(var j, x, i = o.length; i; j = Math.floor(func() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

function stringToIntHash(str){
  var hash = 0;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    char = str.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return (hash > 0)? hash : -hash;
}

var allAwards = ["/assets/classic_002.png", "/assets/post_wtf.png", "/assets/fail_002.png", "/assets/posts_silver.png", "/assets/collection.png", "/assets/reactions_bronze.png", "/assets/post_lol_bronze.png", "/assets/referrer_reddit_silver.png"];
function addAwards(profile) {
  profile.__awards = shuffle(allAwards, seed(profile.username));
  return profile;
}

function injectSideStuff(obj, callback) {
  firebaseArticles.once("value", function(snapshot) {
    var v = snapshot.val();
    var arr = [];
    var allKeys = Object.keys(v);
    var length = Object.keys(v).length >= 8 ? 8 : Object.keys(v).length;
    for (var i = 0; i < length; i++) {
      var r = rand(0, Object.keys(v).length);
      arr.push(v[Object.keys(v)[r]]);
      delete v[Object.keys(v)[r]];
    }
    obj.__sideArticles = arr;
    callback();
  });
}

function rand(min, max){
  return Math.floor(Math.random() * (max-min))+min;
}

function generateArticle() {
  // firebaseArticles.push({
  //   elements: [{
  //     num: 1,
  //     title: "You should know that being quiet doesn’t mean we’re judging you.",
  //     imageUrl: "http://s3-ec.buzzfed.com/static/2015-01/16/13/imagebuzz/webdr03/anigif_optimized-3238-1421434742-18.gif",
  //     body: "I mean. Unless we are."
  //   }],
  //   username: "alexalvarez",
  //   title: "22 Confessions Shy People Will Never Tell You",
  //   subtitle: "*Converses with you in total silence.*",
  //   authorName: "Alex Alvarez",
  //   profileUrl: "/users/alexalvarez",
  //   authorProfilePicture: "/article-view_files/alexalvarez-3154-1405446917-2_large.jpg",
  //   timestamp: Date.now(),
  //   responses: Math.floor(Math.random() * 1000),
  //   previewUrl: "/BuzzFeed%20Buzz_files/22-confessions-shy-people-will-never-tell-you-2-11223-142146.jpg",
  //   articleName: "quietly-judging-all-of-you",
  //   url: "/users/alexalvarez/quietly-judging-all-of-you"
  // });
}

function generateProfile() {
  // var profile1 = {
  //   authorName: "Alex Alvarez",
  //   authorDescription: "LOL but also WTF. Send pitches, tips, chisme, and Pitbull/Alex genderswap fanfic to alex.alvarez@buzzfeed.com.",
  //   authorEmail: "alex.alvarez@buzzfeed.com",
  //   profileUrl: "/users/alexalvarez",
  //   username: "alexalvarez"
  // };
  // var obj = {};
  // obj[profile1.username] = profile1;
  // firebaseProfiles.update(obj);
}

function timeAgo(time){
  var units = [
    { name: "second", limit: 60, in_seconds: 1 },
    { name: "minute", limit: 3600, in_seconds: 60 },
    { name: "hour", limit: 86400, in_seconds: 3600  },
    { name: "day", limit: 604800, in_seconds: 86400 },
    { name: "week", limit: 2629743, in_seconds: 604800  },
    { name: "month", limit: 31556926, in_seconds: 2629743 },
    { name: "year", limit: null, in_seconds: 31556926 }
  ];
  var diff = (new Date() - new Date(time)) / 1000;
  if (diff < 5) return "now";

  var i = 0;
  while (unit = units[i++]) {
    if (diff < unit.limit || !unit.limit){
      var diff2 =  Math.floor(diff / unit.in_seconds);
      return diff2 + " " + unit.name + (diff2>1 ? "s" : "") + " ago";
    }
  }
}
