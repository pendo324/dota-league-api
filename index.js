require('dotenv').config(); // load local .env file into process.ENV

const db = require('./db');
const passport = require('passport');
const SteamStrategy = require('passport-steam');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');
const pgSession = require('connect-pg-simple')(expressSession);
const cors = require('cors');
const app = require('./server').app;
const server = require('./server').server;
const io = require('./server').io;
const ioSession = require('express-socket.io-session');

const secret = process.env.COOKIE_SECRET;
// const ports = [80, 443];

server.listen(9001);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Use the SteamStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.
passport.use(new SteamStrategy({
  returnURL: 'http://localhost/auth/steam/return',
  realm: 'http://localhost/',
  apiKey: process.env.STEAM_API_KEY
},
  (identifier, profile, done) =>
    db.getUser(profile._json.steamid)
      .then((result) => {
        if (result.rowCount > 0) {
          return db.setProfile(profile._json.steamid, profile).then(() =>
            done(null, profile)
          ).catch((err) => {
            console.log(err);
          });
        }
        /* eslint no-underscore-dangle: 0 */
        return db.createUser(profile._json.steamid, profile).then(() => done(null, profile));
      })
      .catch((err) => {
        console.log(err);
      })
));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// cookieParser and session should use the same secret
app.use(cookieParser(secret));

const session = expressSession({
  store: new pgSession({
    pool: db.pool,
    schemaName: 'dotaleague'
  }),
  rolling: false,
  resave: true,
  secret,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
});

app.use(session);

io.use(ioSession(session));

io.use((socket, next) => {
  if (socket.handshake.session) return next();
  return next(new Error('Authentication error'));
});

app.use(passport.initialize());
app.use(passport.session());

// app.listen(8000);

// set headers for all routes
/* const whitelist = ['http://73.46.189.15'];
const corsOptions = {
  origin(origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};*/

app.all('/*', cors(), (req, res, next) => {
  /* res.header('Access-Control-Allow-Origin', 'http://localhost:8000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
  res.header('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');*/
  next();
});

app.use(require('./auth'));
app.use(require('./api'));
